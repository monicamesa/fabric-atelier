# Spike notebook for I3a (S2, S6, S7). Cells are separated by "# %%". Not the final evaluate_agent.
# %% parameters
AGENT_NAME = "Sales Agent"
WORKSPACE_NAME = "FabricApp-AgentJury-Demo"
STAGE = "production"
# %% install
%pip install fabric-data-agent-sdk
# %% run
import json
import time
import importlib.metadata as md
import pandas as pd

result = {"sdk": md.version("fabric-data-agent-sdk"), "started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
try:
    import sys
    result["python"] = sys.version.split()[0]
    result["spark_session"] = "spark" in globals()
    from fabric.dataagent.evaluation import evaluate_data_agent, get_evaluation_details, get_evaluation_summary
except Exception as ex:
    result["import_error"] = repr(ex)[:500]
    raise

rows = [
    ["What was our revenue in fiscal year 2026?", "2,183,973.48"],
    ["How many customers do we have in Spain?", "265"],
]
df = pd.DataFrame(rows, columns=["question", "expected_answer"])


def cut(value):
    text = str(value)
    return text if len(text) <= 160 else text[:160] + "..."


def run(label, frame, table):
    info = {"label": label, "table": table, "questions": len(frame)}
    start = time.time()
    try:
        info["evaluation_id"] = evaluate_data_agent(
            frame, AGENT_NAME, workspace_name=WORKSPACE_NAME, table_name=table, data_agent_stage=STAGE
        )
    except Exception as ex:
        info["error"] = repr(ex)[:500]
    info["seconds"] = round(time.time() - start, 1)
    return info


result["runs"] = [
    run("A_one_batch_of_2", df, "spike_a"),
    run("B_batch_of_1_first", df.iloc[[0]], "spike_b"),
    run("B_batch_of_1_second", df.iloc[[1]], "spike_b"),
]

result["details"] = {}
for info in result["runs"]:
    eid = info.get("evaluation_id")
    if not eid:
        continue
    try:
        details = get_evaluation_details(eid, info["table"], get_all_rows=True, verbose=False)
        result["details"][info["label"]] = {
            "columns": [str(c) for c in details.columns],
            "dtypes": {str(c): str(t) for c, t in details.dtypes.items()},
            "rows": [{str(k): cut(v) for k, v in row.items()} for row in details.to_dict("records")],
        }
    except Exception as ex:
        result["details"][info["label"]] = {"error": repr(ex)[:500]}
try:
    summary = get_evaluation_summary("spike_a")
    result["summary_columns"] = [str(c) for c in summary.columns]
    result["summary_rows"] = [{str(k): cut(v) for k, v in row.items()} for row in summary.to_dict("records")]
except Exception as ex:
    result["summary_error"] = repr(ex)[:500]

result["finished"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
import os

os.makedirs("/lakehouse/default/Files/spike", exist_ok=True)
with open("/lakehouse/default/Files/spike/result.json", "w", encoding="utf-8") as handle:
    json.dump(result, handle, indent=2)
notebookutils.notebook.exit(json.dumps({"runs": result["runs"], "sdk": result["sdk"]})[:3500])
