// -----------------------------------------------------------------------------
// NEET Companion engine
//
// Backed by real counselling data, not modelled curves:
//   - closing ranks come from MCC counselling results, 2019-2025
//   - marks to rank comes from the TS-KNRUHS national rank ledger
//
// The previous implementation interpolated 25 hand-written anchors and scaled
// reserved categories by invented multipliers. Both are gone: every category
// now has its own measured closing rank.
// -----------------------------------------------------------------------------

// Relative, not the "@/" alias: the test runner executes plain compiled CommonJS
// and does not resolve tsconfig paths at runtime.
import data from "../data/neet-data.json"

export const LATEST_CUTOFF_YEAR: number = Math.max(...data.meta.cutoffYears)
export type Category =
  | "UR"
  | "OBC"
  | "EWS"
  | "SC"
  | "ST"
  | "UR-PwD"
  | "OBC-PwD"
  | "EWS-PwD"
  | "SC-PwD"
  | "ST-PwD"

/** Display order, general to most specific. */
export const CATEGORIES: Category[] = [
  "UR",
  "OBC",
  "EWS",
  "SC",
  "ST",
  "UR-PwD",
  "OBC-PwD",
  "EWS-PwD",
  "SC-PwD",
  "ST-PwD",
]

/** MCC calls the open category UR; aspirants call it General. */
export const CATEGORY_LABEL: Record<Category, string> = {
  UR: "General",
  OBC: "OBC",
  EWS: "EWS",
  SC: "SC",
  ST: "ST",
  "UR-PwD": "General PwD",
  "OBC-PwD": "OBC PwD",
  "EWS-PwD": "EWS PwD",
  "SC-PwD": "SC PwD",
  "ST-PwD": "ST PwD",
}

export type Course = "MBBS" | "BDS" | "B.Sc. Nursing"
export const COURSES: Course[] = ["MBBS", "BDS", "B.Sc. Nursing"]

export type Region = "North" | "South" | "East" | "West" | "Central" | "Northeast"
export const REGIONS: Region[] = ["North", "South", "East", "West", "Central", "Northeast"]

const STATE_INFO: Record<string, { name: string; region: Region }> = {
  AN: { name: "Andaman & Nicobar", region: "South" },
  AP: { name: "Andhra Pradesh", region: "South" },
  AR: { name: "Arunachal Pradesh", region: "Northeast" },
  AS: { name: "Assam", region: "Northeast" },
  BR: { name: "Bihar", region: "East" },
  CG: { name: "Chhattisgarh", region: "Central" },
  CH: { name: "Chandigarh", region: "North" },
  DD: { name: "Dadra & Nagar Haveli and Daman & Diu", region: "West" },
  DL: { name: "Delhi", region: "North" },
  GA: { name: "Goa", region: "West" },
  GJ: { name: "Gujarat", region: "West" },
  HP: { name: "Himachal Pradesh", region: "North" },
  HR: { name: "Haryana", region: "North" },
  JH: { name: "Jharkhand", region: "East" },
  JK: { name: "Jammu & Kashmir", region: "North" },
  KA: { name: "Karnataka", region: "South" },
  KL: { name: "Kerala", region: "South" },
  MH: { name: "Maharashtra", region: "West" },
  ML: { name: "Meghalaya", region: "Northeast" },
  MN: { name: "Manipur", region: "Northeast" },
  MP: { name: "Madhya Pradesh", region: "Central" },
  MZ: { name: "Mizoram", region: "Northeast" },
  NL: { name: "Nagaland", region: "Northeast" },
  OD: { name: "Odisha", region: "East" },
  PB: { name: "Punjab", region: "North" },
  PY: { name: "Puducherry", region: "South" },
  RJ: { name: "Rajasthan", region: "North" },
  TN: { name: "Tamil Nadu", region: "South" },
  TR: { name: "Tripura", region: "Northeast" },
  TS: { name: "Telangana", region: "South" },
  UK: { name: "Uttarakhand", region: "North" },
  UP: { name: "Uttar Pradesh", region: "North" },
  WB: { name: "West Bengal", region: "East" },
}

export function stateName(code: string): string {
  return STATE_INFO[code]?.name ?? code
}

export function regionOf(code: string): Region {
  return STATE_INFO[code]?.region ?? "North"
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

// -- decoded tables -----------------------------------------------------------

export interface College {
  name: string
  shortName: string
  stateCode: string
  state: string
  region: Region
  type: string
  slug: string
}

const COURSE_POOL = data.courses as Course[]
const CATEGORY_POOL = data.categories as Category[]

export const COLLEGES: College[] = (data.institutes as string[][]).map((row) => {
  const [name, shortName, stateCode, type, slug] = row as [
    string,
    string,
    string,
    string,
    string,
  ]
  return {
    name,
    shortName: shortName || name,
    stateCode,
    state: stateName(stateCode),
    region: regionOf(stateCode),
    type,
    slug: slug || slugify(name),
  }
})

export interface Cutoff {
  college: number
  course: Course
  category: Category
  quota: string
  year: number
  closing: number
}

/** Sorted by closing rank, so "best first" queries need no extra sorting. */
const CUTOFFS: Cutoff[] = (data.cutoffs as number[][]).map((r) => ({
  college: r[0]!,
  course: COURSE_POOL[r[1]!]!,
  category: CATEGORY_POOL[r[2]!]!,
  quota: data.quotas[r[3]!]!,
  year: r[4]!,
  closing: r[5]!,
}))

// -- indexes ------------------------------------------------------------------
//
// Built once at import. Without these, rankToColleges scanned all 17,066 cutoffs
// per call and directoryRows was O(colleges x cutoffs), which measured 151ms and
// visibly froze the Colleges tab on open.

const CUTOFFS_BY_COLLEGE = new Map<number, Cutoff[]>()
for (const cut of CUTOFFS) {
  const list = CUTOFFS_BY_COLLEGE.get(cut.college)
  if (list) list.push(cut)
  else CUTOFFS_BY_COLLEGE.set(cut.college, [cut])
}

/**
 * Latest-year cutoffs grouped by `category|course`, each inheriting the global
 * ascending closing-rank order. A query for rank r wants every row with
 * closing >= r, which is therefore a contiguous suffix reachable by binary
 * search rather than a scan.
 */
const LATEST_BY_KEY = new Map<string, Cutoff[]>()
for (const cut of CUTOFFS) {
  if (cut.year !== LATEST_CUTOFF_YEAR) continue
  for (const key of [`${cut.category}|${cut.course}`, `${cut.category}|all`]) {
    const list = LATEST_BY_KEY.get(key)
    if (list) list.push(cut)
    else LATEST_BY_KEY.set(key, [cut])
  }
}

/** First index whose closing rank is >= rank. Assumes ascending order. */
function lowerBound(rows: Cutoff[], rank: number): number {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (rows[mid]!.closing < rank) lo = mid + 1
    else hi = mid
  }
  return lo
}

// -- marks to rank ------------------------------------------------------------

export type Tier = "Safe" | "Moderate" | "Reach"

export interface CollegeMatch extends College {
  course: Course
  category: Category
  quota: string
  closing: number
  year: number
  tier: Tier
}

export interface MatchOptions {
  /** Cap the returned list. Total is always the true count. */
  limit?: number
  states?: string[]
}

/**
 * A seat is reachable when the candidate's rank is at or under the closing rank.
 * Tier is how much headroom there is, so a rank far inside the cutoff is Safe.
 */
export function rankToColleges(
  rank: number,
  category: Category,
  course: Course | "all" = "MBBS",
  options: MatchOptions = {},
): { matches: CollegeMatch[]; total: number } {
  const r = Math.max(1, Math.round(rank))
  const { limit = 25, states } = options
  const stateFilter = states && states.length ? new Set(states) : null

  const rows = LATEST_BY_KEY.get(`${category}|${course}`)
  if (!rows) return { matches: [], total: 0 }

  // Rows are ascending by closing rank, so everything reachable starts here.
  const start = lowerBound(rows, r)

  const matches: CollegeMatch[] = []
  let total = 0
  for (let i = start; i < rows.length; i++) {
    const cut = rows[i]!
    const college = COLLEGES[cut.college]!
    if (stateFilter && !stateFilter.has(college.stateCode)) continue

    total++
    // Still walk the rest to keep `total` exact, but stop building objects.
    if (matches.length >= limit) continue

    const margin = r / cut.closing
    const tier: Tier = margin <= 0.6 ? "Safe" : margin <= 0.85 ? "Moderate" : "Reach"
    matches.push({
      ...college,
      course: cut.course,
      category: cut.category,
      quota: cut.quota,
      closing: cut.closing,
      year: cut.year,
      tier,
    })
  }

  return { matches, total }
}

export interface RoundCutoff {
  college: number
  course: Course
  category: Category
  quota: string
  year: number
  round: string
  roundOrder: number
  closing: number
  seats: number
}

const ROUND_NAMES: string[] = data.roundNames

const ROUNDS: RoundCutoff[] = (data.rounds as number[][]).map((r) => ({
  college: r[0]!,
  course: COURSE_POOL[r[1]!]!,
  category: CATEGORY_POOL[r[2]!]!,
  quota: data.quotas[r[3]!]!,
  year: r[4]!,
  round: ROUND_NAMES[r[5]!]!,
  roundOrder: r[6]!,
  closing: r[7]!,
  seats: r[8]!,
}))

const ROUNDS_BY_COLLEGE = new Map<number, RoundCutoff[]>()
for (const r of ROUNDS) {
  const list = ROUNDS_BY_COLLEGE.get(r.college)
  if (list) list.push(r)
  else ROUNDS_BY_COLLEGE.set(r.college, [r])
}

const INDEX_BY_SLUG = new Map<string, number>()
COLLEGES.forEach((c, i) => INDEX_BY_SLUG.set(c.slug, i))

/**
 * Round-by-round rows for one exact seat type in the latest year, in round order.
 * Used by choice filling to show where a seat actually closed rather than
 * predicting where it might.
 */
export function roundsFor(
  slug: string,
  category: Category,
  course: Course,
  quota?: string,
): RoundCutoff[] {
  const index = INDEX_BY_SLUG.get(slug)
  if (index === undefined) return []
  return (ROUNDS_BY_COLLEGE.get(index) ?? [])
    .filter(
      (r) =>
        r.year === LATEST_CUTOFF_YEAR &&
        r.category === category &&
        r.course === course &&
        (!quota || r.quota === quota),
    )
    .sort((a, b) => a.roundOrder - b.roundOrder)
}

export function collegeBySlug(slug: string): College | null {
  const i = INDEX_BY_SLUG.get(slug)
  return i === undefined ? null : COLLEGES[i]!
}

export interface CollegeDetail {
  college: College
  /** Courses the college has ever recorded a cutoff for. */
  courses: Course[]
  /** Categories with data, in the app's display order. */
  categories: Category[]
  quotas: string[]
  years: number[]
  /** Latest-year closing rank per category, tightest first. */
  latest: Cutoff[]
  /** Round-by-round detail for the latest year. */
  rounds: RoundCutoff[]
  /** Total seats recorded in the latest year, across every category. */
  seatsLatest: number
  /**
   * Seats in the latest year for one category. The production site reports the
   * UR figure but labels it "AIQ seats", which conflates category with quota.
   */
  seatsFor: (category: Category, course?: Course) => number
  /** Closing rank per year for the given category, oldest first. */
  trendFor: (category: Category, course?: Course) => { year: number; closing: number }[]
}

/**
 * Everything the college page needs, assembled in one pass so the screen does
 * not filter 17k cutoffs and 43k rounds repeatedly while rendering.
 */
const DETAIL_CACHE = new Map<string, CollegeDetail>()

export function collegeDetail(slug: string): CollegeDetail | null {
  const cached = DETAIL_CACHE.get(slug)
  if (cached) return cached

  const index = INDEX_BY_SLUG.get(slug)
  if (index === undefined) return null
  const college = COLLEGES[index]!

  const cuts = CUTOFFS_BY_COLLEGE.get(index) ?? []
  const rounds = ROUNDS_BY_COLLEGE.get(index) ?? []

  const years = [...new Set(cuts.map((c) => c.year))].sort((a, b) => b - a)
  const latestYear = years[0] ?? LATEST_CUTOFF_YEAR

  const courses = COURSES.filter((c) => cuts.some((x) => x.course === c))
  const categories = CATEGORIES.filter((c) => cuts.some((x) => x.category === c))
  const quotas = [...new Set(cuts.map((c) => c.quota))].sort()

  const latest = cuts
    .filter((c) => c.year === latestYear)
    .sort((a, b) => a.closing - b.closing)

  const latestRounds = rounds
    .filter((r) => r.year === latestYear)
    .sort((a, b) => a.roundOrder - b.roundOrder || a.closing - b.closing)

  // Both accessors are called repeatedly per render (once per category chip), so
  // their results are memoised per detail object rather than recomputed.
  const seatsCache = new Map<string, number>()
  const trendCache = new Map<string, { year: number; closing: number }[]>()

  const detail: CollegeDetail = {
    college,
    courses,
    categories,
    quotas,
    years,
    latest,
    rounds: latestRounds,
    seatsLatest: latestRounds.reduce((n, r) => n + r.seats, 0),
    seatsFor: (category, course) => {
      const key = `${category}|${course ?? "all"}`
      const hit = seatsCache.get(key)
      if (hit !== undefined) return hit
      const value = latestRounds
        .filter((r) => r.category === category && (!course || r.course === course))
        .reduce((n, r) => n + r.seats, 0)
      seatsCache.set(key, value)
      return value
    },
    trendFor: (category, course) => {
      const key = `${category}|${course ?? "all"}`
      const hit = trendCache.get(key)
      if (hit) return hit
      const value = cuts
        .filter((c) => c.category === category && (!course || c.course === course))
        // A college can have several quotas per year; the tightest is the headline.
        .reduce<{ year: number; closing: number }[]>((acc, c) => {
          const existing = acc.find((e) => e.year === c.year)
          if (!existing) acc.push({ year: c.year, closing: c.closing })
          else if (c.closing < existing.closing) existing.closing = c.closing
          return acc
        }, [])
        .sort((a, b) => a.year - b.year)
      trendCache.set(key, value)
      return value
    },
  }

  DETAIL_CACHE.set(slug, detail)
  return detail
}

// -- year-on-year movement ----------------------------------------------------

/** State codes grouped by region, so the predictor can filter without a picker. */
export const STATES_BY_REGION: Record<Region, string[]> = REGIONS.reduce(
  (acc, region) => {
    acc[region] = Object.entries(STATE_INFO)
      .filter(([, info]) => info.region === region)
      .map(([code]) => code)
    return acc
  },
  {} as Record<Region, string[]>,
)

/**
 * Identity of a search, for billing. Region is deliberately excluded: the server
 * returns the unfiltered list and the client narrows it locally, so changing
 * region never costs a credit.
 *
 * Charging is keyed to this, once per 24h, because the predictor recomputes on
 * every keystroke and chip tap. Billing raw recomputes would cost a user roughly
 * 24 credits in a minute of ordinary exploration.
 */
export function queryFingerprint(input: {
  mode: "score" | "rank"
  value: number
  category: Category
  course: Course | "all"
}): string {
  return [input.mode, Math.round(input.value), input.category, input.course].join("|")
}

export function formatIndian(n: number): string {
  const rounded = Math.round(n)
  // Sign is stripped before grouping: otherwise "-773" is four characters and
  // gets split into "-" + "," + "773".
  const sign = rounded < 0 ? "-" : ""
  const s = Math.abs(rounded).toString()
  if (s.length <= 3) return sign + s
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3)
  return sign + rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3
}
