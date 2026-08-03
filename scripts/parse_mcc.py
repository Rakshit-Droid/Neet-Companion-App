"""
Derive NEET-UG closing ranks from MCC's public round-wise allotment PDFs.

MCC publishes every allotted candidate (rank, institute, course, category, quota).
The closing rank for a college is simply the worst rank that still got a seat, so
this takes the max rank per (institute, course, quota, category, round).

Source: https://mcc.nic.in/archive-ug/  — public government data.

usage:
  python scripts/parse_mcc.py --pdf r1.pdf=1 --pdf r3.pdf=3 --out data/mcc.json
  python scripts/parse_mcc.py --pdf r1.pdf=1 --limit 60      # quick structure check
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import pdfplumber

HEADER_CELLS = {"SNo", "Rank", "Allotted Quota", "Allotted Institute"}

# "NAME,ADDRESS..., STATE, PIN" — state is the last comma field before the pincode.
PIN_RE = re.compile(r"\b\d{6}\b")


def parse_institute(raw: str) -> tuple[str, str]:
    """Split the institute blob into (name, state). Falls back to ("", "") safely."""
    flat = " ".join(raw.split())
    parts = [p.strip() for p in flat.split(",") if p.strip()]
    if not parts:
        return "", ""

    name = parts[0]

    # Walk backwards past the pincode to find the state.
    state = ""
    for part in reversed(parts):
        if PIN_RE.fullmatch(part):
            continue
        if part.isdigit():
            continue
        state = part
        break

    return name, state


def iter_rows(pdf_path: Path, limit: int | None):
    """Yield normalised data rows from an MCC allotment PDF."""
    with pdfplumber.open(pdf_path) as pdf:
        pages = pdf.pages if limit is None else pdf.pages[:limit]
        for page_no, page in enumerate(pages):
            for table in page.extract_tables():
                for row in table:
                    if not row or len(row) < 7:
                        continue
                    # Cells wrap mid-value, so "Delhi University\nQuota" is one value.
                    cells = [" ".join((c or "").split()) for c in row]
                    if HEADER_CELLS & set(cells):
                        continue
                    rank_raw = cells[1].replace(",", "")
                    if not rank_raw.isdigit():
                        continue
                    yield {
                        "rank": int(rank_raw),
                        "quota": cells[2],
                        "institute": cells[3],
                        "course": cells[4],
                        "alloted_category": cells[5],
                        "candidate_category": cells[6],
                        "remarks": cells[7] if len(cells) > 7 else "",
                        "page": page_no,
                    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--pdf",
        action="append",
        required=True,
        metavar="PATH=ROUND",
        help="allotment PDF and its round number, e.g. r1.pdf=1",
    )
    ap.add_argument("--out", type=Path, help="write aggregated JSON here")
    ap.add_argument("--limit", type=int, help="only read the first N pages (smoke test)")
    args = ap.parse_args()

    # (institute, state, course, quota, category) -> {round: closing_rank}
    closing: dict[tuple[str, str, str, str, str], dict[int, int]] = defaultdict(dict)
    seats: dict[tuple[str, str, str, str, str], int] = defaultdict(int)

    quota_counts: dict[str, int] = defaultdict(int)
    course_counts: dict[str, int] = defaultdict(int)
    category_counts: dict[str, int] = defaultdict(int)
    total = 0

    for spec in args.pdf:
        path_str, _, round_str = spec.partition("=")
        path = Path(path_str)
        rnd = int(round_str or 0)
        print(f"reading {path} (round {rnd})", file=sys.stderr)

        for row in iter_rows(path, args.limit):
            if row["remarks"] and "allot" not in row["remarks"].lower():
                continue

            name, state = parse_institute(row["institute"])
            if not name:
                continue

            key = (name, state, row["course"], row["quota"], row["alloted_category"])
            prev = closing[key].get(rnd, 0)
            if row["rank"] > prev:
                closing[key][rnd] = row["rank"]
            seats[key] += 1

            quota_counts[row["quota"]] += 1
            course_counts[row["course"]] += 1
            category_counts[row["alloted_category"]] += 1
            total += 1

            if total % 25000 == 0:
                print(f"  {total} rows", file=sys.stderr)

    print(f"\nrows parsed: {total}", file=sys.stderr)
    print(f"unique college/course/quota/category groups: {len(closing)}", file=sys.stderr)

    def top(counter, n=15):
        return sorted(counter.items(), key=lambda kv: -kv[1])[:n]

    print("\ncourses:", top(course_counts), file=sys.stderr)
    print("\ncategories:", top(category_counts), file=sys.stderr)
    print("\nquotas:", top(quota_counts), file=sys.stderr)

    colleges = sorted({(k[0], k[1]) for k in closing})
    print(f"\nunique institutes: {len(colleges)}", file=sys.stderr)

    if args.out:
        records = [
            {
                "college": k[0],
                "state": k[1],
                "course": k[2],
                "quota": k[3],
                "category": k[4],
                "closing": rounds,
                "seats": seats[k],
            }
            for k, rounds in sorted(closing.items())
        ]
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(records, indent=1), encoding="utf-8")
        print(f"\nwrote {len(records)} records to {args.out}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
