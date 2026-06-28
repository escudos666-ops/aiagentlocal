import json
import sqlite3
from pathlib import Path


db_path = Path("/data/webui.db")
connection = sqlite3.connect(str(db_path))
cursor = connection.cursor()

tables = [
    row[0]
    for row in cursor.execute(
        "select name from sqlite_master where type = 'table' order by name"
    )
]
print("tables:", tables)

for table in ("config", "tool"):
    if table not in tables:
        print(f"{table}: missing")
        continue

    columns = [row[1] for row in cursor.execute(f"pragma table_info({table})")]
    print(f"{table}_columns:", columns)

    if table == "config":
        rows = cursor.execute("select * from config").fetchall()
        print("config_rows:", len(rows))
        for row in rows[:10]:
            print("config_row:", row)
            for value in row:
                if isinstance(value, str) and ("tool_server" in value.lower() or "TOOL_SERVER" in value):
                    try:
                        print("decoded:", json.dumps(json.loads(value), indent=2)[:4000])
                    except Exception:
                        pass

    if table == "tool":
        rows = cursor.execute("select id, name, specs from tool order by id").fetchall()
        print("tool_rows:", len(rows))
        for row in rows:
            print("tool_row:", row)