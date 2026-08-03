# NEET Companion

Counselling companion for NEET UG aspirants: build an ordered choice-filling list from seven years of real MCC results.

Built with Expo (React Native). Runs on Android, iOS, and the web, fully offline.

## What it does

The website covers the free tools: predictors, the college directory and state
browsing. This app deliberately does not duplicate any of that. It is the paid
companion for the part the website does not do.

- **Dashboard** — your saved rank, category and course; seats within reach; what
  has moved on your watchlist
- **All India Quota** — an ordered counselling list built from seven years of
  real MCC results, weighted by what you actually want, with round-by-round
  history and a warning when your list has no safe anchor
- **Watchlist** — track colleges and see what changed since you added them
- **State quota** — Telangana next, other states in progress

Navigation adapts: bottom tabs on phones, a side rail on tablets.

Browsing works signed out; the tools require an account.

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
