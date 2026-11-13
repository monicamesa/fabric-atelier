# evaluate_agent: runs one hearing. Cells are separated by "# %%". It only reads Hearings and HearingCases and only
# INSERTs into Verdicts, HearingEvents and VerdictTraces (scripts/notebook-sql-policy.mjs checks this). Batches of 1
# question, so the verdicts and progress reach the app as they happen.
# %% parameters
HEARING_ID = ""
AGENT_NAME = ""
AGENT_WORKSPACE_ID = ""
STAGE = "production"
APP_SQL_SERVER = ""
APP_SQL_DATABASE = ""
# Empty: the SDK's default critic prompt. The app sends it only for a custom prompt (CRITIC_PROMPT in rules/judge-trust.ts).
CRITIC_PROMPT = ""
# %% install
%pip install fabric-data-agent-sdk==0.1.36a0 deltalake==0.25.5
# %% trace helpers
# How the agent got to its answer, from the "<table>_steps" table the SDK writes. Only the tools used, the plain-words
# request and the generated DAX/SQL/KQL are kept. function_outputs (query results) is never read, and no URL or id is kept.
# BEGIN TRACE BUILDER
import ast
import json
import re

TRACE_MAX = 4000
CODE_MAX = 1500
REQUEST_MAX = 300
_URL = re.compile(r"https?://\S+", re.IGNORECASE)
_GUID = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.IGNORECASE)


def _as_list(value):
    if isinstance(value, (list, tuple)):
        return list(value)
    if value is None:
        return []
    try:
        parsed = ast.literal_eval(str(value))
    except (ValueError, SyntaxError):
        return []
    return list(parsed) if isinstance(parsed, (list, tuple)) else []


def _clean(value, limit):
    text = _GUID.sub("", _URL.sub("", str(value))).strip()
    return text[:limit], len(text) > limit


def _encode(steps):
    return json.dumps(steps, ensure_ascii=False, separators=(",", ":"))


def build_trace(row):
    """Returns (json_text or None, truncated). Source steps come first, then the generated queries."""
    names = _as_list(row.get("function_names"))
    requests = _as_list(row.get("function_queries"))
    truncated = False
    sources, seen = [], set()
    for index, name in enumerate(names):
        tool = str(name)
        # The execute step is the one that returns the data, so it is left out entirely.
        if tool.lower().endswith(".execute"):
            continue
        request, cut = _clean(requests[index] if index < len(requests) else "", REQUEST_MAX)
        truncated = truncated or cut
        if (tool, request) in seen:
            continue
        seen.add((tool, request))
        step = {"k": "source", "tool": tool[:100]}
        if request:
            step["request"] = request
        sources.append(step)
    queries, codes = [], set()
    for lang, key in (("dax", "dax_steps"), ("sql", "sql_steps"), ("kql", "kql_steps")):
        for item in _as_list(row.get(key)):
            code, cut = _clean(item, CODE_MAX)
            if not code or code.lower() in ("none", "nan") or code in codes:
                continue
            codes.add(code)
            truncated = truncated or cut
            queries.append({"k": "query", "lang": lang, "code": code})
    steps = sources + queries
    text = _encode(steps)
    while len(text) > TRACE_MAX and steps:
        truncated = True
        last = steps[-1]
        if len(last.get("code", "")) > 200:
            last["code"] = last["code"][: len(last["code"]) // 2].rstrip() + "…"
        else:
            steps.pop()
        text = _encode(steps)
    return (text if steps else None), truncated


# END TRACE BUILDER
# %% run
import json
import struct
import time
import uuid
import importlib.metadata as md

import pandas as pd
import pyodbc
import sempy.fabric as fabric
from fabric.dataagent.evaluation import evaluate_data_agent, get_evaluation_details

TABLE = "hearing_evaluation"
SDK_VERSION = md.version("fabric-data-agent-sdk")


def connect():
    raw = notebookutils.credentials.getToken("https://database.windows.net/").encode("utf-16-le")
    packed = struct.pack(f"<I{len(raw)}s", len(raw), raw)
    driver = next(name for name in pyodbc.drivers() if "SQL Server" in name)
    return pyodbc.connect(
        f"Driver={{{driver}}};Server={APP_SQL_SERVER};Database={APP_SQL_DATABASE};Encrypt=yes;TrustServerCertificate=no;",
        attrs_before={1256: packed},
        timeout=60,
        autocommit=True,
    )


connection = connect()
cursor = connection.cursor()


def event(kind, detail=None):
    cursor.execute(
        "INSERT INTO dbo.[HearingEvents] (id, hearing_id, kind, detail, createdAt) VALUES (NEWID(), ?, ?, ?, SYSUTCDATETIME())",
        HEARING_ID,
        kind,
        None if detail is None else str(detail)[:500],
    )


def verdict(case_id, answer, judge, message, evaluation_id, version, etag, updated):
    verdict_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO dbo.[Verdicts] (id, hearing_id, case_id, agentAnswer, judgeVerdict, judgeMessage, evaluationId, "
        "dataAgentVersion, dataAgentEtag, dataAgentLastUpdated, createdAt) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, SYSUTCDATETIME())",
        verdict_id,
        HEARING_ID,
        case_id,
        str(answer)[:4000],
        judge,
        str(message)[:50],
        str(evaluation_id)[:100],
        None if version is None else str(version)[:50],
        None if etag is None else str(etag)[:100],
        None if updated is None else str(updated)[:50],
    )
    return verdict_id


def steps_row(detail_row):
    # The SDK keeps one "<table>_steps" row per question, with the same id and thread as the evaluation row.
    from deltalake import DeltaTable

    frame = DeltaTable(f"/lakehouse/default/Tables/{TABLE}_steps").to_pandas()
    for key in ("id", "thread_id"):
        if key in frame.columns and detail_row.get(key) is not None:
            found = frame[frame[key] == detail_row.get(key)]
            if len(found):
                return found.to_dict("records")[0]
    return None


def save_trace(verdict_id, detail_row):
    # Best effort: a missing trace never changes the verdict or stops the hearing.
    try:
        found = steps_row(detail_row)
        text, truncated = build_trace(found) if found else (None, False)
        if text:
            cursor.execute(
                "INSERT INTO dbo.[VerdictTraces] (id, verdict_id, steps, truncated, sdkVersion, createdAt) "
                "VALUES (NEWID(), ?, ?, ?, ?, SYSUTCDATETIME())",
                verdict_id,
                text,
                1 if truncated else 0,
                SDK_VERSION[:50],
            )
        else:
            print("trace: no steps found for this question")
    except Exception as ex:
        print("trace skipped:", repr(ex)[:200])


def judge_from(message):
    text = str(message).strip().lower()
    return "correct" if text == "yes" else "incorrect" if text == "no" else "unclear"


try:
    event("started", "sdk " + md.version("fabric-data-agent-sdk"))
    questions = cursor.execute(
        "SELECT position, case_id, question, expectedAnswer FROM dbo.[HearingCases] WHERE hearing_id = ? ORDER BY position",
        HEARING_ID,
    ).fetchall()
    workspace_name = fabric.resolve_workspace_name(AGENT_WORKSPACE_ID)
    total = len(questions)
    done = 0
    for position, case_id, question, expected in questions:
        frame = pd.DataFrame([[question, expected]], columns=["question", "expected_answer"])
        extra = {"critic_prompt": CRITIC_PROMPT} if CRITIC_PROMPT else {}
        try:
            evaluation_id = evaluate_data_agent(
                frame, AGENT_NAME, workspace_name=workspace_name, table_name=TABLE, data_agent_stage=STAGE, **extra
            )
            row = get_evaluation_details(evaluation_id, TABLE, get_all_rows=True, verbose=False).to_dict("records")[0]
            saved_id = verdict(
                str(case_id),
                row.get("actual_answer"),
                judge_from(row.get("evaluation_message")),
                row.get("evaluation_message"),
                evaluation_id,
                row.get("data_agent_version"),
                row.get("data_agent_etag"),
                row.get("data_agent_last_updated"),
            )
            save_trace(saved_id, row)
        except Exception as ex:
            verdict(str(case_id), "(no answer: " + repr(ex)[:200] + ")", "unclear", "error", "none", None, None, None)
        done += 1
        event("progress", f"{done} of {total}")
    event("completed", f"{done} verdicts")
    result = {"ok": True, "verdicts": done}
except Exception as ex:
    event("failed", repr(ex)[:400])
    result = {"ok": False}
finally:
    connection.close()

notebookutils.notebook.exit(json.dumps(result))
