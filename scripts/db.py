"""
Read-only helper for inspecting and exporting the NEET Companion database.

Opens the connection in read-only mode so nothing here can mutate production.
Credentials are read from a file (default C:/Users/Raksh/Desktop/key.txt) or the
DATABASE_URL environment variable. The URL is never printed.

usage:
  python scripts/db.py schema
  python scripts/db.py query "select count(*) from cutoffs"
  python scripts/db.py export --out data/db
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

import psycopg

DEFAULT_KEY = Path("C:/Users/Raksh/Desktop/key.txt")

# Explicit allowlist. Everything else stays on the server.
# The submissions tables hold real users' names, emails and phone numbers and
# must never reach a client bundle, so export refuses anything not listed here.
EXPORTABLE = {
    "institute_profiles",
    "closing_ranks",
    "round_closing_ranks",
    "neet_score_rank",
    "neet_score_curve",
    "neet_exam_meta",
    "college_faqs",
}


def load_url(key_path: Path) -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url.strip().strip('"')
    if key_path.exists():
        text = key_path.read_text(encoding="utf-8")
        match = re.search(r'DATABASE_URL\s*=\s*"?([^"\s]+)"?', text)
        if match:
            return match.group(1)
    raise SystemExit("No DATABASE_URL found (set env var or provide key file).")


def connect(url: str) -> psycopg.Connection:
    # read_only blocks any accidental write at the server level.
    conn = psycopg.connect(url, connect_timeout=30)
    conn.read_only = True
    return conn


def cmd_schema(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            select table_name
            from information_schema.tables
            where table_schema = 'public'
            order by table_name
            """
        )
        tables = [r[0] for r in cur.fetchall()]
        print(f"tables ({len(tables)}): {', '.join(tables)}\n")

        for table in tables:
            cur.execute(
                """
                select column_name, data_type
                from information_schema.columns
                where table_schema = 'public' and table_name = %s
                order by ordinal_position
                """,
                (table,),
            )
            cols = cur.fetchall()
            cur.execute(f'select count(*) from "{table}"')
            count = cur.fetchone()[0]
            print(f"== {table}  ({count} rows)")
            for name, dtype in cols:
                print(f"   {name}: {dtype}")
            print()


def cmd_query(conn: psycopg.Connection, sql: str) -> None:
    if not sql.lstrip().lower().startswith(("select", "with", "explain")):
        raise SystemExit("Only SELECT / WITH / EXPLAIN are allowed.")
    with conn.cursor() as cur:
        cur.execute(sql)
        cols = [d.name for d in cur.description or []]
        rows = cur.fetchall()
        print(" | ".join(cols))
        for row in rows[:200]:
            print(" | ".join("" if v is None else str(v) for v in row))
        print(f"\n({len(rows)} rows)")


def cmd_export(conn: psycopg.Connection, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    with conn.cursor() as cur:
        cur.execute(
            """
            select table_name
            from information_schema.tables
            where table_schema = 'public'
            order by table_name
            """
        )
        found = [r[0] for r in cur.fetchall()]

    tables = [t for t in found if t in EXPORTABLE]
    skipped = [t for t in found if t not in EXPORTABLE]
    if skipped:
        print(f"skipping (not exportable): {', '.join(skipped)}\n")

    for table in tables:
        with conn.cursor() as cur:
            cur.execute(f'select * from "{table}"')
            cols = [d.name for d in cur.description or []]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        path = out / f"{table}.json"
        path.write_text(json.dumps(rows, indent=1, default=str), encoding="utf-8")
        print(f"{table}: {len(rows)} rows -> {path}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["schema", "query", "export"])
    ap.add_argument("sql", nargs="?", help="SQL for the query command")
    ap.add_argument("--key", type=Path, default=DEFAULT_KEY)
    ap.add_argument("--out", type=Path, default=Path("data/db"))
    args = ap.parse_args()

    url = load_url(args.key)
    with connect(url) as conn:
        if args.command == "schema":
            cmd_schema(conn)
        elif args.command == "query":
            if not args.sql:
                raise SystemExit("query command needs a SQL string")
            cmd_query(conn, args.sql)
        else:
            cmd_export(conn, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
