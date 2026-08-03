"""
Compact the exported tables into a single bundle the app ships offline.

The raw export is ~26 MB, far too much for a mobile bundle. Strings repeat
heavily (604 institutes across 17k cutoff rows), so everything is de-duplicated
into lookup arrays and rows become integer tuples.

usage:
  python scripts/build_dataset.py --src data/db --out src/data/neet-data.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

# Sorting cutoffs by closing rank keeps the app's "best first" queries cheap.
CUTOFF_FIELDS = ("institute", "course", "category", "quota", "year", "closing_rank")


def load(src: Path, name: str) -> list[dict]:
    return json.loads((src / f"{name}.json").read_text(encoding="utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=Path("data/db"))
    ap.add_argument("--out", type=Path, default=Path("src/data/neet-data.json"))
    args = ap.parse_args()

    profiles = load(args.src, "institute_profiles")
    cutoffs = load(args.src, "closing_ranks")
    rounds = load(args.src, "round_closing_ranks")
    curve = load(args.src, "neet_score_curve")
    exam_meta = load(args.src, "neet_exam_meta")

    # Institutes, indexed by name so cutoff rows can reference them by position.
    profiles.sort(key=lambda p: p["institute"])
    inst_index = {p["institute"]: i for i, p in enumerate(profiles)}
    institutes = [
        [
            p["institute"],
            p.get("short_name") or "",
            p.get("state") or "",
            p.get("type") or "",
            p.get("slug") or "",
        ]
        for p in profiles
    ]

    courses: list[str] = []
    categories: list[str] = []
    quotas: list[str] = []

    def idx(pool: list[str], value: str) -> int:
        if value not in pool:
            pool.append(value)
        return pool.index(value)

    rows: list[list[int]] = []
    dropped = 0
    for c in cutoffs:
        name = c["institute"]
        if name not in inst_index:
            dropped += 1
            continue
        rows.append(
            [
                inst_index[name],
                idx(courses, c["course"]),
                idx(categories, c["category"]),
                idx(quotas, c["quota"]),
                int(c["year"]),
                int(c["closing_rank"]),
            ]
        )
    rows.sort(key=lambda r: (r[5], r[0]))

    # Round-level detail powers the per-college cutoff pages: which round a seat
    # closed in, and how many seats went in each. Rounds are pooled like courses.
    round_names: list[str] = []
    round_rows: list[list[int]] = []
    for r in rounds:
        name = r["institute"]
        if name not in inst_index:
            continue
        round_rows.append(
            [
                inst_index[name],
                idx(courses, r["course"]),
                idx(categories, r["category"]),
                idx(quotas, r["quota"]),
                int(r["year"]),
                idx(round_names, r["round"]),
                int(r["round_order"] or 0),
                int(r["closing_rank"]),
                int(r["seat_count"] or 0),
            ]
        )
    round_rows.sort(key=lambda r: (r[0], -r[4], r[6]))

    # Score curve: latest year only, that is what a prediction should use.
    latest = max(int(r["year"]) for r in curve)
    curve_rows = sorted(
        (
            [int(r["score"]), int(r["median_rank"])]
            for r in curve
            if int(r["year"]) == latest and r.get("median_rank") is not None
        ),
        key=lambda r: -r[0],
    )

    # The rank ledger is a state sample, so it stops being dependable past a
    # documented cap. The app surfaces that rather than implying false precision.
    meta_for_year = next(
        (m for m in exam_meta if int(m["year"]) == latest),
        None,
    )

    bundle = {
        "meta": {
            "curveYear": latest,
            "cutoffYears": sorted({r[4] for r in rows}),
            "reliableRankCap": (meta_for_year or {}).get("reliable_rank_cap"),
            "maxObservedRank": (meta_for_year or {}).get("max_observed_rank"),
            "topperScore": (meta_for_year or {}).get("topper_score"),
            "source": "MCC counselling results; score curve from TS-KNRUHS rank ledger",
            "instituteFields": ["name", "shortName", "state", "type", "slug"],
            "cutoffFields": ["institute", "course", "category", "quota", "year", "closingRank"],
            "roundFields": [
                "institute",
                "course",
                "category",
                "quota",
                "year",
                "round",
                "roundOrder",
                "closingRank",
                "seatCount",
            ],
        },
        "institutes": institutes,
        "courses": courses,
        "categories": categories,
        "quotas": quotas,
        "roundNames": round_names,
        "cutoffs": rows,
        "rounds": round_rows,
        "curve": curve_rows,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(bundle, separators=(",", ":")), encoding="utf-8")

    size = args.out.stat().st_size
    print(f"institutes: {len(institutes)}")
    print(f"cutoffs:    {len(rows)} rows (dropped {dropped} with unknown institute)")
    print(f"rounds:     {len(round_rows)} rows across {len(round_names)} round names")
    print(f"courses:    {courses}")
    print(f"categories: {categories}")
    print(f"quotas:     {len(quotas)}")
    print(f"curve:      {len(curve_rows)} points for {latest}")
    print(f"\nwrote {args.out} ({size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
