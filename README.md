# NEET Companion

Counselling companion for NEET UG aspirants: build an ordered choice-filling list from seven years of real MCC results.

Built with Expo (React Native). Runs on Android, iOS, and the web, fully offline.

## What it does

The website covers the free tools: predictors, the college directory and state
browsing. This app deliberately does not duplicate any of that. It is the paid
companion for the part the website does not do.

- **Dashboard** — your saved rank, category and course; seats within reach; what
  has moved on your watchlist; your credit balance
- **All India Quota** — an ordered counselling list built from seven years of
  real MCC results, weighted by what you actually want, with a round-by-round
  verdict for every seat and a warning when your list has no safe anchor
- **Watchlist** — track colleges, see what changed since you added them, and
  watch how each seat behaves across the counselling rounds
- **State quota** — Telangana next, other states in progress
- **Credits** — ₹100 buys 50 credits; a choice list costs 2, a watchlist add
  costs 1. Ten free on signup. Every movement is on an append-only ledger you
  can read.
- **Referrals** — your friend signs up with your code and buys their first pack,
  you get 50 credits. A signup alone pays nothing.

Navigation adapts: bottom tabs on phones, a side rail on tablets.

The tools require an account.

### On charging

Building a list is an explicit button, never a live recompute. The list used to
rebuild on every keystroke, which at 2 credits a search would have billed roughly
₹48 a minute for typing a five-digit rank. Repeating an identical query inside 24
hours is free.

Credits currently live on the device. That is deliberate and temporary: the whole
cutoff dataset already ships inside the app, so there is nothing secret left to
protect, and gating every screen behind a network call before there is a server
would make the app worse. `LedgerStore` in `src/lib/credits.ts` is the seam —
swapping AsyncStorage for a Firestore transaction does not touch a single caller.

### On round verdicts

Rounds are reported as ordinal verdicts (Clear, Likely, Contested, Unlikely, No
data) carrying the years and the observed spread behind them — never a
percentage. Calibrated one-year-ahead probabilities were built, backtested
(`npm run backtest`) and withheld: median year-on-year drift ran +10.5% (2021),
+4.4%, +3.3%, +1.3%, then reversed to −5.5% in 2025. No model fitted to that
passes a reliability gate, so the app shows evidence and sample size instead of a
confident number.

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
npm test             # engine, ledger and referral tests
npm run typecheck    # strict TypeScript
```

### Signing in during development

Firebase is not wired up yet. Until it is, a local stand-in accepts:

```
dev@neetcompanion.test / devpass123
```

Accounts you create yourself work too, and everything persists on the device. The
stand-in is gated on `__DEV__ && !isFirebaseConfigured`, so a release build cannot
reach it and pasting real Firebase config disables it independently.

See [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) for wiring up the real thing.

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
