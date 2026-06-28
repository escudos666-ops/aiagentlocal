import argparse
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Repair Open WebUI tool rows whose specs value is null/empty."
    )
    parser.add_argument("db", help="Path to Open WebUI webui.db")
    parser.add_argument("--apply", action="store_true", help="Apply the repair")
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")

    connection = sqlite3.connect(str(db_path))
    cursor = connection.cursor()

    tables = {
        row[0]
        for row in cursor.execute(
            "select name from sqlite_master where type = 'table' order by name"
        )
    }
    if "tool" not in tables:
        print("No tool table found; nothing to repair.")
        return 0

    columns = [row[1] for row in cursor.execute("pragma table_info(tool)")]
    if "specs" not in columns:
        print("Tool table has no specs column; nothing to repair.")
        return 0

    name_column = "name" if "name" in columns else "id"
    problem_rows = cursor.execute(
        f"select id, {name_column}, specs from tool "
        "where specs is null or specs = '' or specs = 'null'"
    ).fetchall()

    print(f"Problem tool rows: {len(problem_rows)}")
    for row in problem_rows:
        print(f"- id={row[0]!r} {name_column}={row[1]!r} specs={row[2]!r}")

    if not problem_rows:
        return 0

    if not args.apply:
        print("Dry run only. Re-run with --apply to repair.")
        return 0

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_path = db_path.with_name(f"{db_path.name}.before-mcp-tool-specs.{timestamp}.bak")
    connection.close()
    shutil.copy2(db_path, backup_path)
    print(f"Backup written: {backup_path}")

    connection = sqlite3.connect(str(db_path))
    cursor = connection.cursor()
    cursor.execute(
        "update tool set specs = '[]' "
        "where specs is null or specs = '' or specs = 'null'"
    )
    print(f"Rows repaired: {cursor.rowcount}")
    connection.commit()
    connection.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())