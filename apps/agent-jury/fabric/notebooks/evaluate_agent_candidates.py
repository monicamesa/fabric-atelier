# Candidate questions for the I3a end-to-end check. Cells are separated by "# %%".
# %% parameters
AGENT_NAME = "Sales Agent"
WORKSPACE_NAME = "FabricApp-AgentJury-Demo"
STAGE = "production"
# %% install
%pip install fabric-data-agent-sdk
# %% run
import json
import os
import time
import importlib.metadata as md
import pandas as pd
from fabric.dataagent.evaluation import evaluate_data_agent, get_evaluation_details

# Expected answers come from DAX against the semantic model (net revenue, fiscal year from July).
CANDIDATES = [
    ["What is the average order value?", "2,226.97"],
    ["What was our revenue in fiscal year 2025?", "2,147,910.60"],
    ["How many active customers did we have at the end of June 2026?", "245"],
    ["How many orders were placed in fiscal year 2026?", "997"],
]

result = {"sdk": md.version("fabric-data-agent-sdk"), "started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "rows": []}
for index, (question, expected) in enumerate(CANDIDATES):
    frame = pd.DataFrame([[question, expected]], columns=["question", "expected_answer"])
    entry = {"question": question, "expected": expected}
    start = time.time()
    try:
        evaluation_id = evaluate_data_agent(
            frame, AGENT_NAME, workspace_name=WORKSPACE_NAME, table_name="spike_candidates", data_agent_stage=STAGE
        )
        details = get_evaluation_details(evaluation_id, "spike_candidates", get_all_rows=True, verbose=False)
        row = details.to_dict("records")[0]
        for key in ("actual_answer", "evaluation_judgement", "evaluation_message", "execution_time_sec", "data_agent_version", "data_agent_etag", "data_agent_last_updated"):
            entry[key] = str(row.get(key))[:400]
    except Exception as ex:
        entry["error"] = repr(ex)[:500]
    entry["seconds"] = round(time.time() - start, 1)
    result["rows"].append(entry)

result["finished"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
os.makedirs("/lakehouse/default/Files/spike", exist_ok=True)
with open("/lakehouse/default/Files/spike/candidates.json", "w", encoding="utf-8") as handle:
    json.dump(result, handle, indent=2)
notebookutils.notebook.exit(json.dumps({"rows": len(result["rows"])}))
