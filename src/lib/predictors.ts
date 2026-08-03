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

export const MAX_MARKS = 720

/** The rank ledger is a state sample, so it thins out past this rank. */
export const RELIABLE_RANK_CAP: number = data.meta.reliableRankCap
export const CURVE_YEAR: number = data.meta.curveYear
export const LATEST_CUTOFF_YEAR: number = Math.max(...data.meta.cutoffYears)
export const DATA_SOURCE: string = data.meta.source

// -- categories, courses, quotas ---------------------------------------------

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

export const QUOTAS: string[] = data.quotas

// -- states -------------------------------------------------------------------

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

const CURVE = data.curve as number[][] // [score, medianRank], score descending

export interface RankPrediction {
  air: number
  low: number
  high: number
  percentile: number
  /** False once past the ledger's reliable range; the UI says so. */
  reliable: boolean
}

/**
 * Piecewise-linear over the observed score/rank ledger. Above the highest
 * observed score we interpolate toward AIR 1 at a perfect 720; below the lowest
 * we extend to the worst observed rank.
 */
export function marksToRank(marks: number): RankPrediction {
  const m = Math.max(0, Math.min(MAX_MARKS, marks))

  const top = CURVE[0]!
  const bottom = CURVE[CURVE.length - 1]!
  let air: number

  if (m >= top[0]!) {
    const span = MAX_MARKS - top[0]!
    const t = span <= 0 ? 1 : (m - top[0]!) / span
    air = Math.max(1, Math.round(top[1]! + (1 - top[1]!) * t))
  } else if (m <= bottom[0]!) {
    const span = bottom[0]!
    const t = span <= 0 ? 0 : (bottom[0]! - m) / span
    air = Math.round(bottom[1]! + (data.meta.maxObservedRank - bottom[1]!) * t)
  } else {
    air = bottom[1]!
    for (let i = 0; i < CURVE.length - 1; i++) {
      const hi = CURVE[i]!
      const lo = CURVE[i + 1]!
      if (m <= hi[0]! && m >= lo[0]!) {
        const span = hi[0]! - lo[0]!
        const t = span === 0 ? 0 : (hi[0]! - m) / span
        air = Math.round(hi[1]! + (lo[1]! - hi[1]!) * t)
        break
      }
    }
  }

  const band = Math.max(3, Math.round(air * 0.05))
  const percentile =
    Math.round(Math.max(0, 1 - air / data.meta.maxObservedRank) * 10000) / 100

  return {
    air,
    low: Math.max(1, air - band),
    high: air + band,
    percentile,
    reliable: air <= RELIABLE_RANK_CAP,
  }
}

/** Inverse of marksToRank, used for "what score does this cutoff imply". */
export function rankToApproxMarks(air: number): number {
  const r = Math.max(1, Math.round(air))
  const top = CURVE[0]!
  if (r <= top[1]!) {
    const t = (top[1]! - r) / Math.max(1, top[1]! - 1)
    return Math.round(top[0]! + (MAX_MARKS - top[0]!) * t)
  }
  for (let i = 0; i < CURVE.length - 1; i++) {
    const hi = CURVE[i]!
    const lo = CURVE[i + 1]!
    if (r >= hi[1]! && r <= lo[1]!) {
      const span = lo[1]! - hi[1]!
      const t = span === 0 ? 0 : (r - hi[1]!) / span
      return Math.round(hi[0]! + (lo[0]! - hi[0]!) * t)
    }
  }
  return 0
}

// -- rank to colleges ---------------------------------------------------------

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

export function marksToColleges(
  marks: number,
  category: Category,
  course: Course | "all" = "MBBS",
  options: MatchOptions = {},
) {
  const rank = marksToRank(marks)
  return { ...rankToColleges(rank.air, category, course, options), rank }
}

/** Every closing rank recorded for a college, newest first. Powers trend views. */
export function historyFor(collegeSlug: string): Cutoff[] {
  const index = INDEX_BY_SLUG.get(collegeSlug)
  if (index === undefined) return []
  return [...(CUTOFFS_BY_COLLEGE.get(index) ?? [])].sort(
    (a, b) => b.year - a.year || a.closing - b.closing,
  )
}

// -- round-level detail -------------------------------------------------------

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

export interface YearDelta {
  current: number
  previous: number | null
  /** Positive means the closing rank rose, which is easier to get into. */
  change: number | null
  direction: "easier" | "harder" | "flat" | "new"
}

/**
 * A rising closing rank means the last admitted candidate had a worse rank, so
 * the college got *easier*. The sign is counter-intuitive, hence the label.
 */
export function yearDelta(points: { year: number; closing: number }[]): YearDelta | null {
  if (points.length === 0) return null
  const sorted = [...points].sort((a, b) => a.year - b.year)
  const current = sorted[sorted.length - 1]!
  const previous = sorted.length > 1 ? sorted[sorted.length - 2]! : null

  if (!previous) {
    return { current: current.closing, previous: null, change: null, direction: "new" }
  }

  const change = current.closing - previous.closing
  return {
    current: current.closing,
    previous: previous.closing,
    change,
    direction: change > 0 ? "easier" : change < 0 ? "harder" : "flat",
  }
}

export interface SeatMatrixRow {
  category: Category
  byQuota: Record<string, number>
  total: number
}

/** Seats in the latest year as category rows by quota, matching the site's table. */
export function seatMatrix(slug: string): { quotas: string[]; rows: SeatMatrixRow[]; total: number } {
  const detail = collegeDetail(slug)
  if (!detail) return { quotas: [], rows: [], total: 0 }

  const quotas = [...new Set(detail.rounds.map((r) => r.quota))].sort()
  const rows: SeatMatrixRow[] = []

  for (const category of detail.categories) {
    const forCategory = detail.rounds.filter((r) => r.category === category)
    if (forCategory.length === 0) continue
    const byQuota: Record<string, number> = {}
    for (const q of quotas) {
      const seats = forCategory.filter((r) => r.quota === q).reduce((n, r) => n + r.seats, 0)
      if (seats > 0) byQuota[q] = seats
    }
    const total = Object.values(byQuota).reduce((n, v) => n + v, 0)
    if (total > 0) rows.push({ category, byQuota, total })
  }

  return { quotas, rows, total: rows.reduce((n, r) => n + r.total, 0) }
}

// -- state rollups, richer ----------------------------------------------------

export interface StateStats {
  colleges: number
  byCourse: Record<Course, number>
  /** Mean of each college's tightest General closing rank in the latest year. */
  averageClosing: number | null
}

export function stateStats(slug: string): StateStats | null {
  const matched = COLLEGES.map((c, i) => ({ c, i })).filter(
    (x) => slugify(x.c.state) === slug,
  )
  if (matched.length === 0) return null

  const byCourse = { MBBS: 0, BDS: 0, "B.Sc. Nursing": 0 } as Record<Course, number>
  const closings: number[] = []

  for (const { i } of matched) {
    const courses = coursesFor(i)
    for (const course of courses) byCourse[course]++
    const best = bestClosingFor(i)
    if (best !== null) closings.push(best)
  }

  return {
    colleges: matched.length,
    byCourse,
    averageClosing: closings.length
      ? Math.round(closings.reduce((n, v) => n + v, 0) / closings.length)
      : null,
  }
}

export interface StateCollege {
  college: College
  index: number
  closing: number | null
  course: Course | null
  category: Category | null
  round: string | null
  courses: Course[]
}

/** Headline latest-year row for one college, computed from its own index slice. */
function headlineFor(college: College, index: number, withRound: boolean): StateCollege {
  const mine = CUTOFFS_BY_COLLEGE.get(index) ?? []
  let head: Cutoff | null = null
  for (const c of mine) {
    if (c.year !== LATEST_CUTOFF_YEAR) continue
    if (!head || c.closing < head.closing) head = c
  }

  let round: string | null = null
  if (withRound && head) {
    for (const r of ROUNDS_BY_COLLEGE.get(index) ?? []) {
      if (
        r.year === head.year &&
        r.category === head.category &&
        r.course === head.course &&
        r.closing === head.closing
      ) {
        round = r.round
        break
      }
    }
  }

  return {
    college,
    index,
    closing: head?.closing ?? null,
    course: head?.course ?? null,
    category: head?.category ?? null,
    round,
    courses: coursesFor(index),
  }
}

/** Colleges in a state with their headline latest-year cutoff, for list rows. */
export function collegesInState(slug: string): StateCollege[] {
  const out: StateCollege[] = []
  COLLEGES.forEach((college, index) => {
    if (slugify(college.state) !== slug) return
    out.push(headlineFor(college, index, true))
  })
  return out.sort((a, b) => (a.closing ?? Infinity) - (b.closing ?? Infinity))
}

// Every college, every launch of the Colleges tab. Computed once.
let DIRECTORY_CACHE: StateCollege[] | null = null

/** Latest headline cutoff for every college, used by the directory rows. */
export function directoryRows(): StateCollege[] {
  if (!DIRECTORY_CACHE) {
    DIRECTORY_CACHE = COLLEGES.map((college, index) => headlineFor(college, index, false))
  }
  return DIRECTORY_CACHE
}

export const COLLEGE_TYPES: string[] = [...new Set(COLLEGES.map((c) => c.type))].sort()

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

export const PLATFORM_TOP_STATES = () =>
  statesSummary()
    .slice(0, 5)
    .map((s) => ({ state: s.state, slug: s.slug, count: s.collegeCount }))

export interface Faq {
  question: string
  answer: string
}

/**
 * Generated from the college's own numbers rather than shipped as text. The
 * production site stores these pre-rendered with HTML links, which would be
 * both larger and impossible to render natively.
 */
export function faqsFor(slug: string): Faq[] {
  const detail = collegeDetail(slug)
  if (!detail) return []

  const { college, courses, categories, years, latest, rounds, seatsLatest } = detail
  const latestYear = years[0] ?? LATEST_CUTOFF_YEAR
  const out: Faq[] = []

  const ur = detail.trendFor("UR")
  if (ur.length) {
    const current = ur[ur.length - 1]!
    const lo = Math.min(...ur.map((p) => p.closing))
    const hi = Math.max(...ur.map((p) => p.closing))
    out.push({
      question: `What is the NEET closing rank for ${college.shortName}?`,
      answer:
        `The General (UR) closing rank was ${formatIndian(current.closing)} in ${current.year}, ` +
        `ranging from ${formatIndian(lo)} to ${formatIndian(hi)} across ${ur.length} ` +
        `${ur.length === 1 ? "year" : "years"} of counselling data.`,
    })
  }

  if (courses.length) {
    out.push({
      question: `What courses does ${college.shortName} offer?`,
      answer:
        `${college.shortName} has recorded cutoffs for ${courses.join(", ")} ` +
        `across ${detail.quotas.length} quota ${detail.quotas.length === 1 ? "type" : "types"}. ` +
        `Cutoffs vary by course, category and quota.`,
    })
  }

  const reserved = categories.filter((c) => c !== "UR")
  if (reserved.length) {
    out.push({
      question: `What are the reserved category cutoffs at ${college.shortName}?`,
      answer:
        `Seats were allotted under ${categories.map((c) => CATEGORY_LABEL[c]).join(", ")}. ` +
        `Reserved category closing ranks are generally more relaxed than General, but each ` +
        `category has its own measured cutoff rather than a fixed multiple.`,
    })
  }

  if (rounds.length) {
    const byRound = rounds
      .filter((r) => r.category === "UR")
      .map((r) => `${r.round} at ${formatIndian(r.closing)}`)
    if (byRound.length) {
      out.push({
        question: `How do cutoffs move between rounds at ${college.shortName}?`,
        answer:
          `In ${latestYear} the General cutoff closed at ${byRound.join(", ")}. ` +
          `Later rounds can loosen as candidates withdraw, so a rank just outside round 1 ` +
          `is often still worth listing.`,
      })
    }
  }

  if (seatsLatest > 0) {
    const urSeats = detail.seatsFor("UR")
    out.push({
      question: `How many seats does ${college.shortName} have?`,
      answer:
        `${seatsLatest} ${seatsLatest === 1 ? "seat was" : "seats were"} allotted in ` +
        `${latestYear} across all categories` +
        (urSeats > 0 ? `, of which ${urSeats} went to General` : "") +
        `. That covers the quotas in this dataset only, not state-quota seats.`,
    })
  }

  if (latest.length) {
    const best = latest[0]!
    out.push({
      question: `What rank should I aim for at ${college.shortName}?`,
      answer:
        `The tightest ${latestYear} cutoff was ${formatIndian(best.closing)} ` +
        `(${CATEGORY_LABEL[best.category]}, ${best.course}). Aim comfortably inside that ` +
        `to treat it as a realistic choice rather than an aspirational one.`,
    })
  }

  out.push({
    question: `How do I get admission to ${college.shortName}?`,
    answer:
      `Qualify NEET UG, register for counselling at mcc.nic.in, and list ` +
      `${college.shortName} among your choices. Allotment follows your rank, category and ` +
      `the seats available in each round. Always verify against the official MCC schedule.`,
  })

  return out
}

// -- state rollups ------------------------------------------------------------

export interface StateSummary {
  code: string
  state: string
  slug: string
  region: Region
  collegeCount: number
  topCollege: string
  bestClosingRank: number
  courses: Course[]
}

export function statesSummary(): StateSummary[] {
  const latest = CUTOFFS.filter((c) => c.year === LATEST_CUTOFF_YEAR && c.category === "UR")
  const byState = new Map<string, StateSummary>()

  for (const college of COLLEGES) {
    let entry = byState.get(college.stateCode)
    if (!entry) {
      entry = {
        code: college.stateCode,
        state: college.state,
        slug: slugify(college.state),
        region: college.region,
        collegeCount: 0,
        topCollege: college.name,
        bestClosingRank: Number.POSITIVE_INFINITY,
        courses: [],
      }
      byState.set(college.stateCode, entry)
    }
    entry.collegeCount++
  }

  for (const cut of latest) {
    const college = COLLEGES[cut.college]!
    const entry = byState.get(college.stateCode)
    if (!entry) continue
    if (cut.closing < entry.bestClosingRank) {
      entry.bestClosingRank = cut.closing
      entry.topCollege = college.name
    }
    if (!entry.courses.includes(cut.course)) entry.courses.push(cut.course)
  }

  return [...byState.values()]
    .map((s) => ({
      ...s,
      bestClosingRank: Number.isFinite(s.bestClosingRank) ? s.bestClosingRank : 0,
    }))
    .sort((a, b) => b.collegeCount - a.collegeCount)
}

export function collegesByState(slug: string): { state: string; colleges: College[] } | null {
  const matched = COLLEGES.filter((c) => slugify(c.state) === slug)
  if (matched.length === 0) return null
  return {
    state: matched[0]!.state,
    colleges: [...matched].sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/** Lowest UR closing rank recorded for a college in the latest year. */
export function bestClosingFor(collegeIndex: number): number | null {
  let best: number | null = null
  for (const cut of CUTOFFS_BY_COLLEGE.get(collegeIndex) ?? []) {
    if (cut.year !== LATEST_CUTOFF_YEAR || cut.category !== "UR") continue
    if (best === null || cut.closing < best) best = cut.closing
  }
  return best
}

/** Courses a college actually offered in the latest year. */
export function coursesFor(collegeIndex: number): Course[] {
  const out: Course[] = []
  for (const cut of CUTOFFS_BY_COLLEGE.get(collegeIndex) ?? []) {
    if (cut.year !== LATEST_CUTOFF_YEAR) continue
    if (!out.includes(cut.course)) out.push(cut.course)
  }
  return out
}

export const PLATFORM_STATS = {
  colleges: COLLEGES.length,
  states: new Set(COLLEGES.map((c) => c.stateCode)).size,
  courses: COURSES.length,
  cutoffs: CUTOFFS.length,
  years: data.meta.cutoffYears.length,
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
