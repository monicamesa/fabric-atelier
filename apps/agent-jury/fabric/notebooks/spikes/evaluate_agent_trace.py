# I4 trace spike: what does the SDK keep about HOW the agent answered? ONE question, run once. Not the final evaluate_agent.
# Cells are separated by "# %%". It writes nothing to the app database; the raw rows go only to Files/spike/trace.json in jury_lh.
# %% parameters
AGENT_NAME = "Sales Agent"
WORKSPACE_NAME = "FabricApp-AgentJury-Demo"
STAGE = "production"
QUESTION = "How many customers do we have in Spain?"
EXPECTED = "141"
# %% install
%pip install fabric-data-agent-sdk==0.1.36a0
# %% run
import json
import os
import time
import importlib.metadata as md

import pandas as pd
from fabric.dataagent.evaluation import evaluate_data_agent, get_evaluation_details
from fabric.dataagent.evaluation._storage import _get_data

TABLE = "trace_spike"
result = {"sdk": md.version("fabric-data-agent-sdk"), "started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

started = time.time()
evaluation_id = evaluate_data_agent(
    pd.DataFrame([[QUESTION, EXPECTED]], columns=["question", "expected_answer"]),
    AGENT_NAME,
    workspace_name=WORKSPACE_NAME,
    table_name=TABLE,
    data_agent_stage=STAGE,
)
result["evaluate_seconds"] = round(time.time() - started, 1)

details = get_evaluation_details(evaluation_id, TABLE, get_all_rows=True, verbose=False)
detail_row = details.to_dict("records")[0]
result["details_columns"] = [str(c) for c in details.columns]
result["details_row"] = {str(k): str(v) for k, v in detail_row.items()}

steps = _get_data(f"{TABLE}_steps")
result["steps_found"] = steps is not None
if steps is not None:
    result["steps_columns"] = [str(c) for c in steps.columns]
    result["steps_rows_total"] = int(len(steps))
    mine = steps[steps["thread_id"] == detail_row.get("thread_id")]
    result["steps_rows_for_this_question"] = int(len(mine))
    row = mine.to_dict("records")[0] if len(mine) else {}
    result["steps_chars_per_column"] = {str(k): len(str(v)) for k, v in row.items()}
    result["steps_row"] = {str(k): str(v) for k, v in row.items()}

result["finished"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
os.makedirs("/lakehouse/default/Files/spike", exist_ok=True)
with open("/lakehouse/default/Files/spike/trace.json", "w", encoding="utf-8") as handle:
    json.dump(result, handle, indent=2)
notebookutils.notebook.exit(json.dumps({"seconds": result["evaluate_seconds"], "steps_found": result["steps_found"], "chars": result.get("steps_chars_per_column")})[:3500])
