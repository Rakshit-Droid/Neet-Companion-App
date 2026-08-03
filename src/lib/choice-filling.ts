// Choice-Filling Assistant.
//
// Turns a rank into an ordered counselling preference list from real MCC data.
//
// DELIBERATELY NO PROBABILITIES. A calibrated allotment probability was built
// and backtested (src/lib/probability.ts, scripts/backtest.mjs) and it FAILED
// the calibration gate: cutoffs loosened +10.5% in 2021, decelerating each year,
// then reversed to -5.5% in 2025. A model fitted on prior years cannot know that,
// so stated probabilities were wrong by up to 32 points in the middle of the
// range. Everything below is measured history, not a forecast.

import {
  CATEGORIES,
  rankToColleges,
  roundsFor,
  formatIndian,
  type Category,
  type CollegeMatch,
  type Course,
  type Tier,
} from "./predictors"

export interface PreferenceWeights {
  /** Tighter cutoffs read as more sought-after. */
  prestige: number
  /** Bonus for a college in one of the preferred states. */
  state: number
  /** Bonus for government over deemed, which is mostly about fees. */
  government: number
}

export const DEFAULT_WEIGHTS: PreferenceWeights = {
  prestige: 1,
  state: 0.6,
  government: 0.8,
}

export interface ChoiceInput {
  rank: number
  category: Category
  course: Course | "all"
  /** Restrict to these state codes; empty means all India. */
  states?: string[]
  /** State codes the candidate would prefer, used for ordering not filtering. */
  preferredStates?: string[]
  weights?: Partial<PreferenceWeights>
  limit?: number
}

export interface RoundRow {
  round: string
  closing: number
  seats: number
}

export interface Choice {
  order: number
  college: CollegeMatch
  /** Round-by-round closing ranks in the latest year, earliest round first. */
  rounds: RoundRow[]
  /** The first round whose closing rank reached this candidate's rank. */
  clearsFromRound: string | null
  /** Seats recorded for this seat type in the latest year. */
  seats: number
  advice: string
}

export interface ChoiceGuidance {
  /** 1-based position where the list stops being aspirational. */
  realisticBandStartsAt: number | null
  /** True when at least one Safe seat is present. */
  hasAnchor: boolean
  warning: "NO_ANCHOR" | null
}

export interface ChoiceList {
  choices: Choice[]
  counts: Record<Tier, number>
  total: number
  guidance: ChoiceGuidance
}

const ADVICE: Record<Tier, string> = {
  Reach: "Aspirational. List it high, cutoffs can loosen in later rounds.",
  Moderate: "On-target. The core of a competitive list.",
  Safe: "Anchor. Locks a confirmed seat as a backstop.",
}

/**
 * Desirability score used for ordering. Counselling allots the highest
 * preference you clear, so the list must be ordered by how much the candidate
 * wants a seat, not by how likely it is.
 */
function score(
  match: CollegeMatch,
  tightest: number,
  loosest: number,
  preferred: Set<string>,
  w: PreferenceWeights,
): number {
  const span = Math.max(1, Math.log(loosest) - Math.log(tightest))
  const prestige = 1 - (Math.log(match.closing) - Math.log(tightest)) / span
  const isGovernment = match.type.toLowerCase().includes("govt")
  return (
    w.prestige * prestige +
    w.state * (preferred.has(match.stateCode) ? 1 : 0) +
    w.government * (isGovernment ? 1 : 0)
  )
}

export function buildChoiceList(input: ChoiceInput): ChoiceList {
  const weights = { ...DEFAULT_WEIGHTS, ...input.weights }
  const preferred = new Set(input.preferredStates ?? [])
  const limit = input.limit ?? 40

  const { matches, total } = rankToColleges(input.rank, input.category, input.course, {
    limit: 500,
    states: input.states,
  })

  const counts: Record<Tier, number> = { Safe: 0, Moderate: 0, Reach: 0 }
  for (const m of matches) counts[m.tier]++

  if (matches.length === 0) {
    return {
      choices: [],
      counts,
      total,
      guidance: { realisticBandStartsAt: null, hasAnchor: false, warning: null },
    }
  }

  const tightest = matches[0]!.closing
  const loosest = matches[matches.length - 1]!.closing

  const ordered = [...matches]
    .sort(
      (a, b) =>
        score(b, tightest, loosest, preferred, weights) -
        score(a, tightest, loosest, preferred, weights) ||
        a.closing - b.closing,
    )
    .slice(0, limit)

  const choices: Choice[] = ordered.map((college, i) => {
    const rows = roundsFor(college.slug, college.category, college.course, college.quota)
    const clears = rows.find((r) => r.closing >= input.rank)
    return {
      order: i + 1,
      college,
      rounds: rows.map((r) => ({ round: r.round, closing: r.closing, seats: r.seats })),
      clearsFromRound: clears?.round ?? null,
      seats: rows.reduce((n, r) => n + r.seats, 0),
      advice: ADVICE[college.tier],
    }
  })

  const firstSafeOrModerate = choices.findIndex((c) => c.college.tier !== "Reach")
  const hasAnchor = choices.some((c) => c.college.tier === "Safe")

  return {
    choices,
    counts,
    total,
    guidance: {
      realisticBandStartsAt: firstSafeOrModerate < 0 ? null : firstSafeOrModerate + 1,
      hasAnchor,
      // The single most useful thing this screen can say: a list with no anchor
      // risks going unallotted entirely.
      warning: hasAnchor ? null : "NO_ANCHOR",
    },
  }
}

export { formatIndian, CATEGORIES }
