// Choice-Filling Assistant.
// Turns a rank into an ordered preference list from real MCC closing ranks.
//
// Quota is no longer an input: MCC data already carries the quota each seat was
// allotted under, so the list reports it per choice instead of asking up front.
// State-quota counselling is run by the states and is not in this dataset.

import {
  rankToColleges,
  formatIndian,
  type Category,
  type Course,
  type CollegeMatch,
  type Tier,
} from "./predictors"

export interface ChoiceInput {
  rank: number
  category: Category
  course: Course | "all"
  /** Restrict to these state codes; empty means all India. */
  states?: string[]
  /** Counselling allows long lists, so this is generous by default. */
  limit?: number
}

export interface Choice {
  order: number
  college: CollegeMatch
  advice: string
}

export interface ChoiceList {
  choices: Choice[]
  counts: Record<Tier, number>
  total: number
}

const ADVICE: Record<Tier, string> = {
  Reach: "Aspirational. List it high, cutoffs can loosen in later rounds.",
  Moderate: "On-target. The core of a competitive list.",
  Safe: "Anchor. Locks a confirmed seat as a backstop.",
}

/**
 * Ordered reach-first: counselling allots the highest preference you clear, so
 * aspirational picks belong at the top and safe anchors at the bottom.
 */
export function buildChoiceList(input: ChoiceInput): ChoiceList {
  const { matches, total } = rankToColleges(input.rank, input.category, input.course, {
    limit: input.limit ?? 40,
    states: input.states,
  })

  const ordered = [...matches].sort((a, b) => a.closing - b.closing)

  const choices: Choice[] = ordered.map((college, i) => ({
    order: i + 1,
    college,
    advice: ADVICE[college.tier],
  }))

  const counts: Record<Tier, number> = { Safe: 0, Moderate: 0, Reach: 0 }
  for (const college of ordered) counts[college.tier]++

  return { choices, counts, total }
}

export { formatIndian }
