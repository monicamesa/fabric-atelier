# evaluate_agent: runs one hearing. Cells are separated by "# %%". It only reads Hearings and HearingCases and only
# INSERTs into Verdicts and HearingEvents (scripts/notebook-sql-policy.mjs checks this). Batches of 1 question, so the
# verdicts and progress reach the app as they happen.
# %% parameters
HEARING_ID = ""
AGENT_NAME = ""
AGENT_WORKSPACE_ID = ""
STAGE = "production"
APP_SQL_SERVER = ""
APP_SQL_DATABASE = ""
# %% install
%pip install fabric-data-agent-sdk==0.1.36a0
# %% run
import json
import struct
import time
import importlib.metadata as md

import pandas as pd
import pyodbc
import sempy.fabric as fabric
from fabric.dataagent.evaluation import evaluate_data_agent, get_evaluation_details

TABLE = "hearing_evaluation"


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
    cursor.execute(
        "INSERT INTO dbo.[Verdicts] (id, hearing_id, case_id, agentAnswer, judgeVerdict, judgeMessage, evaluationId, "
        "dataAgentVersion, dataAgentEtag, dataAgentLastUpdated, createdAt) "
        "VALUES (NEWID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, SYSUTCDATETIME())",
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
        try:
            evaluation_id = evaluate_data_agent(
                frame, AGENT_NAME, workspace_name=workspace_name, table_name=TABLE, data_agent_stage=STAGE
            )
            row = get_evaluation_details(evaluation_id, TABLE, get_all_rows=True, verbose=False).to_dict("records")[0]
            verdict(
                str(case_id),
                row.get("actual_answer"),
                judge_from(row.get("evaluation_message")),
                row.get("evaluation_message"),
                evaluation_id,
                row.get("data_agent_version"),
                row.get("data_agent_etag"),
                row.get("data_agent_last_updated"),
            )
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
