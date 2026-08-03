# NEET Companion

Native app for NEET UG aspirants: predict your All India Rank from your score, and see which medical colleges are actually reachable at that rank.

Built with Expo (React Native). Runs on Android, iOS, and the web, fully offline.

## What it does

- **Predict** — score to rank to reachable seats, or enter a rank directly
- **Colleges** — 604 institutes, searchable, filterable by region
- **States** — 33 states, drill into every college
- **Choices** — an ordered counselling preference list, aspirational first
- **College detail** — closing ranks by year, round-by-round cutoffs with seat counts, per-category breakdown, and generated FAQs

## Data

All predictions come from real counselling results, not modelled curves.

| Source | Rows |
|---|---|
| MCC closing ranks, 2019–2025 | 17,066 |
| Round-level cutoffs with seat counts | 43,132 |
| Institutes | 604 across 33 states |
| Score-to-rank ledger (TS-KNRUHS) | 492 curve points |

The app ships a single compacted bundle at `src/data/neet-data.json` (~1.7 MB) and needs no network at runtime.

**Known limits.** Cutoffs cover the quotas in this dataset only — state-quota counselling is run by each state and is not included. The score-to-rank ledger is a state sample with a documented reliable range of AIR 150,000; past that the app says so rather than implying precision.

## Getting started

```bash
npm install
npm run dev          # Expo dev server
npm run android      # Android
npm run ios          # iOS (needs macOS or EAS Build)
npm run web          # browser
```

```bash
npm test             # engine tests
npm run typecheck    # strict TypeScript
```

## Rebuilding the dataset

Requires read access to the production database.

```bash
python scripts/db.py schema                  # inspect
python scripts/db.py export --out data/db    # export (allowlisted tables only)
python scripts/build_dataset.py              # compact into src/data/neet-data.json
```

`scripts/db.py` opens the connection read-only and exports through an explicit allowlist, because several tables hold real users' names, emails and phone numbers. Those must never reach a client bundle.

## Design

See [DESIGN.md](DESIGN.md). Flat Touch-First system, no shadows, light and dark, amber primary on neutral greys. Every colour pairing in that file was measured against WCAG, not estimated.

## Disclaimer

Predictions are indicative. Past cutoffs do not guarantee future ones. Verify every choice against [MCC](https://mcc.nic.in) and your state counselling authority before acting on it.
