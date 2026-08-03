"""
Harvest the full college/cutoff dataset from the NEET Companion production API.

`POST /api/predict` returns every institute reachable at the given rank, so a
single call at rank 1 returns the complete set for a category, each entry
carrying its full year/round history. One request per category is enough.

usage:
  python scripts/harvest_api.py --out data/api-dump.json
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.request
from pathlib import Path

BASE = "https://neetcompanion.com/api/predict"

CATEGORIES = [
    "UR",
    "OBC",
    "SC",
    "ST",
    "EWS",
    "UR-PwD",
    "OBC-PwD",
    "SC-PwD",
    "ST-PwD",
    "EWS-PwD",
]


def fetch(category: str, timeout: int) -> list[dict]:
    payload = json.dumps(
        {"rank": 1, "category": category, "quota": "auto", "course": "all"}
    ).encode()
    req = urllib.request.Request(
        BASE,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read()).get("predictions", [])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--delay", type=float, default=1.5, help="seconds between requests")
    ap.add_argument("--timeout", type=int, default=90)
    args = ap.parse_args()

    dump: dict[str, list[dict]] = {}
    for i, category in enumerate(CATEGORIES):
        if i:
            time.sleep(args.delay)
        try:
            rows = fetch(category, args.timeout)
        except Exception as exc:  # noqa: BLE001 - report and continue
            print(f"{category}: FAILED ({exc})")
            continue
        dump[category] = rows
        print(f"{category}: {len(rows)} institutes")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(dump, indent=1), encoding="utf-8")

    institutes = {r["institute"] for rows in dump.values() for r in rows}
    courses = {r["course"] for rows in dump.values() for r in rows}
    years = {
        y["year"]
        for rows in dump.values()
        for r in rows
        for y in r.get("yearRoundData", [])
    }
    print(f"\ncategories: {len(dump)}")
    print(f"unique institutes: {len(institutes)}")
    print(f"courses: {sorted(courses)}")
    print(f"years: {sorted(years)}")
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
