# S5 spike: can the notebook (owner identity) read and write the app database? Cells separated by "# %%".
# %% parameters
APP_SQL_SERVER = ""
APP_SQL_DATABASE = ""
# %% run
import json
import os
import struct
import time

result = {"started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "server_given": bool(APP_SQL_SERVER)}


def attempt(name, work):
    try:
        result[name] = work()
        return True
    except Exception as ex:
        result[name + "_error"] = repr(ex)[:500]
        return False


def get_token():
    return notebookutils.credentials.getToken("https://database.windows.net/")


def connect():
    import pyodbc

    result["odbc_drivers"] = pyodbc.drivers()
    raw = get_token().encode("utf-16-le")
    packed = struct.pack(f"<I{len(raw)}s", len(raw), raw)
    driver = next((d for d in pyodbc.drivers() if "SQL Server" in d), None)
    result["odbc_driver_used"] = driver
    return pyodbc.connect(
        f"Driver={{{driver}}};Server={APP_SQL_SERVER};Database={APP_SQL_DATABASE};Encrypt=yes;TrustServerCertificate=no;",
        attrs_before={1256: packed},
        timeout=60,
    )


connection = None
started = time.time()
try:
    connection = connect()
    result["connect_seconds"] = round(time.time() - started, 1)
except Exception as ex:
    result["connect_error"] = repr(ex)[:600]

if connection is not None:
    cursor = connection.cursor()
    attempt("identity", lambda: [str(v) for v in cursor.execute("SELECT SUSER_SNAME(), USER_NAME()").fetchone()])
    attempt(
        "counts",
        lambda: {
            table: cursor.execute(f"SELECT COUNT(*) FROM dbo.[{table}]").fetchone()[0]
            for table in ("Cases", "Testimonies", "Votes", "Agents", "Jurors")
        },
    )
    attempt(
        "agent_cases",
        lambda: [
            [str(v)[:80] for v in row]
            for row in cursor.execute(
                "SELECT TOP 6 c.text, t.answer FROM dbo.[Cases] c JOIN dbo.[Testimonies] t ON t.case_id = c.id "
                "JOIN dbo.[Agents] a ON a.id = c.agent_id WHERE a.name = N'Sales Agent' ORDER BY c.text"
            ).fetchall()
        ],
    )

    def write_test():
        cursor.execute("IF OBJECT_ID('dbo.SpikeWrite') IS NOT NULL DROP TABLE dbo.SpikeWrite")
        cursor.execute("CREATE TABLE dbo.SpikeWrite (id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(), note NVARCHAR(50), createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME())")
        cursor.execute("INSERT INTO dbo.SpikeWrite (note) VALUES (N'written by the notebook')")
        connection.commit()
        rows = cursor.execute("SELECT COUNT(*) FROM dbo.SpikeWrite").fetchone()[0]
        cursor.execute("DROP TABLE dbo.SpikeWrite")
        connection.commit()
        return rows

    attempt("write_rows_read_back", write_test)
    connection.close()

result["finished"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
os.makedirs("/lakehouse/default/Files/spike", exist_ok=True)
with open("/lakehouse/default/Files/spike/s5.json", "w", encoding="utf-8") as handle:
    json.dump(result, handle, indent=2)
notebookutils.notebook.exit(json.dumps({"ok": connection is not None})[:300])
