// Round-aware choice filling.
//
// choice-filling.ts orders colleges by desirability for a rank. This adds the
// dimension counselling actually runs on: rounds. For every seat in that list it
// reports where the seat closed in each round of every year on record, and where
// the candidate's rank sits inside that observed spread.
//
// STILL NO PROBABILITIES, for the same reason choice-filling.ts has none. The
// backtest in scripts/backtest.mjs failed its calibration gate because the drift
// it was fitted on is not stationary: median year-over-year movement ran +10.5%
// (2021), +4.4%, +3.3%, +1.3%, then reversed to -5.5% in 2025. A percentage
// derived from that history would state a confidence the data cannot support.
// So the output here is ordinal, plus the sample size it rests on, so a screen
// can show the evidence instead of a number.

import data from "../data/neet-data.json"
import { COLLEGES, LATEST_CUTOFF_YEAR, type Category, type Course, type Tier } from "./predictors"
import { buildChoiceList, type Choice, type ChoiceGuidance, type ChoiceInput } from "./choice-filling"

/** Preference options are the ones the choice list already defines, not a second set. */
export { DEFAULT_WEIGHTS, type PreferenceWeights, type ChoiceInput } from "./choice-filling"

/**
 * Where a rank sits against a round's measured history. Ordinal on purpose:
 *   clear      cleared this round in every year on record
 *   likely     cleared it in the typical year
 *   contested  only the loosest years on record reached this rank
 *   unlikely   no year on record reached this rank
 *   no-data    this seat has never been recorded in this round
 * Read it with `n`: "clear" off one year is one year's anecdote, not a promise.
 */
export type RoundVerdict = "clear" | "likely" | "contested" | "unlikely" | "no-data"

export const VERDICT_LABEL: Record<RoundVerdict, string> = {
  clear: "Clear",
  likely: "Likely",
  contested: "Contested",
  unlikely: "Unlikely",
  "no-data": "No data",
}

/** Ordinal ladder, weakest first. "no-data" is deliberately not on it. */
const LADDER: RoundVerdict[] = ["unlikely", "contested", "likely", "clear"]

/** Position on the ladder; -1 for "no-data", which cannot be compared. */
export function verdictStrength(verdict: RoundVerdict): number {
  return LADDER.indexOf(verdict)
}

/**
 * Observed closing ranks for one round, from the candidate's point of view: a
 * higher closing rank admitted a worse rank, so it is the more favourable year.
 */
export interface RoundSpread {
  /** Tightest year on record — the smallest closing rank, hardest to clear. */
  worst: number
  median: number
  /** Loosest year on record — the largest closing rank, easiest to clear. */
  best: number
}

export interface RoundStats {
  round: string
  /** Years this round was recorded for this seat, oldest first. */
  years: number[]
  /** years.length. A verdict resting on 1 year must not read like one on 7. */
  n: number
  /** null exactly when n is 0, so a missing round cannot be mistaken for a wide one. */
  spread: RoundSpread | null
  /** Seats this round released in the most recent year that ran it. */
  seats: number
}

export interface RoundEvidence extends RoundStats {
  verdict: RoundVerdict
}

// -- indexes ------------------------------------------------------------------
//
// One pass over all 43,132 round rows at import, mirroring predictors.ts. Rows
// are kept in their packed form: decoding them into objects would triple the
// resident size of the table for no benefit, since a search reads a few dozen
// seats out of 4,183.

/** [institute, course, category, quota, year, round, roundOrder, closing, seats] */
type Row = [number, number, number, number, number, number, number, number, number]

const ROUND_NAMES: string[] = data.roundNames

const ROWS_BY_SEAT = new Map<string, Row[]>()
const LATEST_ROUND_ORDER = new Map<string, number>()

for (const row of data.rounds as Row[]) {
  const key = `${row[0]}|${row[1]}|${row[2]}|${row[3]}`
  const list = ROWS_BY_SEAT.get(key)
  if (list) list.push(row)
  else ROWS_BY_SEAT.set(key, [row])

  if (row[4] === LATEST_CUTOFF_YEAR) LATEST_ROUND_ORDER.set(ROUND_NAMES[row[5]], row[6])
}

/**
 * The rounds MCC ran in the most recent year, in counselling order.
 *
 * Taken from the latest year rather than from every year on record because the
 * schedule changes: Mop-Up ran 2020-2022 and was replaced by Round 3 from 2023.
 * Its rows are left out rather than folded into Round 3 — the two behaved
 * differently, and a candidate cannot attend a round that no longer exists.
 */
export const ROUND_SCHEDULE: string[] = [...LATEST_ROUND_ORDER.entries()]
  .sort((a, b) => a[1] - b[1])
  .map(([round]) => round)

const COURSE_INDEX = new Map((data.courses as Course[]).map((c, i) => [c, i] as const))
const CATEGORY_INDEX = new Map((data.categories as Category[]).map((c, i) => [c, i] as const))
const QUOTA_INDEX = new Map(data.quotas.map((q, i) => [q, i] as const))
const COLLEGE_INDEX = new Map(COLLEGES.map((c, i) => [c.slug, i] as const))

const NO_HISTORY: RoundStats[] = ROUND_SCHEDULE.map((round) => ({
  round,
  years: [],
  n: 0,
  spread: null,
  seats: 0,
}))

function medianOf(ascending: number[]): number {
  const mid = ascending.length >> 1
  if (ascending.length % 2 === 1) return ascending[mid]
  return Math.round((ascending[mid - 1] + ascending[mid]) / 2)
}

// Stats do not depend on the candidate, so they are computed once per seat and
// reused across every rank the user tries.
const STATS_CACHE = new Map<string, RoundStats[]>()

function statsFor(key: string): RoundStats[] {
  const cached = STATS_CACHE.get(key)
  if (cached) return cached

  const byRound = new Map<string, Row[]>()
  for (const row of ROWS_BY_SEAT.get(key) ?? []) {
    const name = ROUND_NAMES[row[5]]
    const list = byRound.get(name)
    if (list) list.push(row)
    else byRound.set(name, [row])
  }

  const stats = ROUND_SCHEDULE.map<RoundStats>((round) => {
    const rows = byRound.get(round)
    if (!rows || rows.length === 0) return { round, years: [], n: 0, spread: null, seats: 0 }

    // The bundle holds at most one row per seat per year per round, so every row
    // here is a distinct year and no year is counted twice.
    const years = rows.map((r) => r[4]).sort((a, b) => a - b)
    const closings = rows.map((r) => r[7]).sort((a, b) => a - b)
    const newest = rows.reduce((a, b) => (b[4] > a[4] ? b : a))

    return {
      round,
      years,
      n: years.length,
      spread: {
        worst: closings[0],
        median: medianOf(closings),
        best: closings[closings.length - 1],
      },
      seats: newest[8],
    }
  })

  STATS_CACHE.set(key, stats)
  return stats
}

function rawVerdict(spread: RoundSpread, rank: number): RoundVerdict {
  if (rank <= spread.worst) return "clear"
  if (rank <= spread.median) return "likely"
  if (rank <= spread.best) return "contested"
  return "unlikely"
}

/**
 * Verdicts are carried forward across the schedule: a candidate sitting in round
 * r has already been through every earlier round, so their standing at r is the
 * best standing up to and including r.
 *
 * That is also what keeps the round progression readable. Late rounds hand out a
 * handful of seats, so their closing rank is whoever happened to take one — in
 * 2023 a stray round closed at 17,224 for a seat whose round 3 had closed at
 * 21,742. Reporting that as a downgrade would be reading noise as a trend.
 */
function withVerdicts(stats: RoundStats[], rank: number): RoundEvidence[] {
  // A non-finite rank would survive Math.round and then lose every comparison,
  // grading a seat "unlikely" on nothing. Callers guard against it, so reaching
  // here with one is a bug worth surfacing rather than papering over.
  if (!Number.isFinite(rank)) throw new Error(`rank must be a finite number, got ${rank}`)
  const r = Math.max(1, Math.round(rank))
  let carried: RoundVerdict = "no-data"

  return stats.map((s) => {
    // years and spread are lifted out of the shared stats cache, not aliased
    // into it. A caller sorting years in place or clamping a spread would
    // otherwise corrupt every later lookup for this seat, including the
    // verdicts computed from it.
    const copy = {
      ...s,
      years: [...s.years],
      spread: s.spread ? { ...s.spread } : null,
    }

    if (!copy.spread) return { ...copy, verdict: "no-data" as const }
    let verdict = rawVerdict(copy.spread, r)
    if (verdictStrength(carried) > verdictStrength(verdict)) verdict = carried
    carried = verdict
    return { ...copy, verdict }
  })
}

/**
 * Per-round history for one exact seat type, in counselling order. Always
 * returns the full schedule: a round this seat has never appeared in comes back
 * as "no-data" rather than being dropped, because "never recorded" and "out of
 * reach" are different answers.
 */
export function roundEvidence(
  slug: string,
  category: Category,
  course: Course,
  quota: string,
  rank: number,
): RoundEvidence[] {
  const college = COLLEGE_INDEX.get(slug)
  const c = COURSE_INDEX.get(course)
  const cat = CATEGORY_INDEX.get(category)
  const q = QUOTA_INDEX.get(quota)

  const stats =
    college === undefined || c === undefined || cat === undefined || q === undefined
      ? NO_HISTORY
      : statsFor(`${college}|${c}|${cat}|${q}`)

  return withVerdicts(stats, rank)
}

export interface RoundPlan {
  /** The ordered preference entry this expands, from buildChoiceList. */
  choice: Choice
  /** One entry per scheduled round, in order. Never empty, never filtered. */
  rounds: RoundEvidence[]
  /** First round where the verdict reaches "likely". The reason to list a reach. */
  likelyFromRound: string | null
  /** Strongest verdict anywhere on the schedule. */
  bestVerdict: RoundVerdict
}

export interface RoundPlanList {
  /** Round names in counselling order — the columns a plan table renders. */
  schedule: string[]
  plans: RoundPlan[]
  counts: Record<Tier, number>
  total: number
  guidance: ChoiceGuidance
}

/**
 * The choice list, expanded round by round.
 *
 * Order comes straight from buildChoiceList and is not re-sorted: counselling
 * allots the highest preference you clear, so the list must run by how much the
 * candidate wants a seat. The rounds are what say when they might get it — a
 * college that is unlikely in round 1 and likely by the stray round belongs on
 * the list, high up, precisely because listing it costs nothing.
 */
export function buildRoundPlan(input: ChoiceInput): RoundPlanList {
  const list = buildChoiceList(input)

  const plans = list.choices.map<RoundPlan>((choice) => {
    const { slug, category, course, quota } = choice.college
    const rounds = roundEvidence(slug, category, course, quota, input.rank)
    const likely = rounds.find((r) => verdictStrength(r.verdict) >= verdictStrength("likely"))
    // Verdicts never weaken along the schedule, so the last round with any data
    // holds the strongest one.
    const strongest = [...rounds].reverse().find((r) => r.verdict !== "no-data")

    return {
      choice,
      rounds,
      likelyFromRound: likely?.round ?? null,
      bestVerdict: strongest?.verdict ?? "no-data",
    }
  })

  return {
    schedule: ROUND_SCHEDULE,
    plans,
    counts: list.counts,
    total: list.total,
    guidance: list.guidance,
  }
}
