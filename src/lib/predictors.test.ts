import test from "node:test"
import assert from "node:assert/strict"

import {
  CATEGORIES,
  CATEGORY_LABEL,
  COLLEGES,
  COLLEGE_TYPES,
  COURSES,
  STATES_BY_REGION,
  collegesInState,
  directoryRows,
  seatMatrix,
  stateStats,
  yearDelta,
  LATEST_CUTOFF_YEAR,
  MAX_MARKS,
  PLATFORM_STATS,
  RELIABLE_RANK_CAP,
  collegeBySlug,
  collegeDetail,
  collegesByState,
  faqsFor,
  formatIndian,
  historyFor,
  marksToColleges,
  marksToRank,
  rankToApproxMarks,
  rankToColleges,
  regionOf,
  slugify,
  stateName,
  statesSummary,
} from "./predictors"
import { buildChoiceList } from "./choice-filling"
import data from "../data/neet-data.json"

/**
 * Score/rank pairs read directly out of the shipped curve, so they stay true
 * when the data is refreshed instead of being hardcoded expectations.
 */
const CURVE_SAMPLES: [number, number][] = (data.curve as number[][])
  .filter((_, i) => i % 97 === 0)
  .slice(0, 5)
  .map(([score, rank]) => [score!, rank!])

// The engine is backed by real MCC counselling data and the TS-KNRUHS rank
// ledger. These lock the shape of that data and the behaviour derived from it.

// Exact dataset counts are asserted in dataset.contract.test.ts, which is the
// one place to update on a data refresh. Everything here is behavioural.

test("marksToRank reads straight off the observed curve", () => {
  // Not magic numbers: each is the median rank the ledger itself records for
  // that score, so this proves interpolation returns the observed point.
  for (const [score, expected] of CURVE_SAMPLES) {
    assert.equal(marksToRank(score).air, expected, `score ${score}`)
  }
})

test("a perfect score is AIR 1 and rank never improves as marks fall", () => {
  assert.equal(marksToRank(MAX_MARKS).air, 1)

  let prev = 0
  for (let m = MAX_MARKS; m >= 0; m -= 5) {
    const { air } = marksToRank(m)
    assert.ok(air >= prev, `rank improved at ${m} marks: ${air} < ${prev}`)
    prev = air
  }
})

test("marksToRank clamps out-of-range input", () => {
  assert.equal(marksToRank(9999).air, marksToRank(MAX_MARKS).air)
  assert.equal(marksToRank(-50).air, marksToRank(0).air)
})

test("predictions past the ledger's reliable cap are flagged", () => {
  assert.equal(marksToRank(600).reliable, true)
  assert.ok(marksToRank(600).air < RELIABLE_RANK_CAP)

  const weak = marksToRank(300)
  assert.ok(weak.air > RELIABLE_RANK_CAP)
  assert.equal(weak.reliable, false)
})

test("band is +/-5% with a floor of 3", () => {
  const p = marksToRank(500)
  const band = Math.max(3, Math.round(p.air * 0.05))
  assert.equal(p.low, p.air - band)
  assert.equal(p.high, p.air + band)

  const top = marksToRank(MAX_MARKS)
  assert.equal(top.low, 1)
  assert.equal(top.high, 4)
})

test("percentile is bounded and ordered", () => {
  assert.ok(marksToRank(MAX_MARKS).percentile <= 100)
  assert.ok(marksToRank(600).percentile > marksToRank(300).percentile)
})

test("rankToApproxMarks round-trips within a few marks", () => {
  for (const marks of [600, 550, 500, 450, 400, 300]) {
    const back = rankToApproxMarks(marksToRank(marks).air)
    assert.ok(
      Math.abs(back - marks) <= 3,
      `round-trip drifted at ${marks}: got ${back}`,
    )
  }
})

test("AIR 1 reaches every seat recorded in the latest year", () => {
  const best = rankToColleges(1, "UR", "MBBS", { limit: 10_000 })
  assert.ok(best.total > 400, `expected a wide field, got ${best.total}`)
  assert.equal(best.matches.length, best.total)

  // A rank past every recorded cutoff clears nothing.
  assert.equal(rankToColleges(9_999_999, "UR", "MBBS").total, 0)
})

test("reserved categories are read from data, not scaled from General", () => {
  // Each category has its own measured cutoffs, so results differ per category
  // without any multiplier being applied.
  const counts = CATEGORIES.map((c) => rankToColleges(50_000, c, "MBBS").total)
  assert.ok(counts.some((n) => n > 0), "expected some category to have matches")
  assert.ok(new Set(counts).size > 1, "categories should not all return the same count")
})

test("matches only include seats at or beyond the candidate's rank", () => {
  const rank = 40_000
  const { matches } = rankToColleges(rank, "UR", "MBBS", { limit: 500 })
  assert.ok(matches.length > 0)
  for (const m of matches) {
    assert.ok(m.closing >= rank, `${m.name} closed at ${m.closing}, above ${rank}`)
    assert.equal(m.year, LATEST_CUTOFF_YEAR)
    assert.equal(m.category, "UR")
    assert.equal(m.course, "MBBS")
  }
})

test("tier reflects headroom against the cutoff", () => {
  const { matches } = rankToColleges(10_000, "UR", "MBBS", { limit: 500 })
  for (const m of matches) {
    const margin = 10_000 / m.closing
    const expected = margin <= 0.6 ? "Safe" : margin <= 0.85 ? "Moderate" : "Reach"
    assert.equal(m.tier, expected)
  }
})

test("results are ordered tightest cutoff first and respect the limit", () => {
  const { matches, total } = rankToColleges(100_000, "UR", "all", { limit: 5 })
  assert.equal(matches.length, 5)
  assert.ok(total > 5)
  const closings = matches.map((m) => m.closing)
  assert.deepEqual(closings, [...closings].sort((a, b) => a - b))
})

test("course filter is honoured, and 'all' is a superset", () => {
  const mbbs = rankToColleges(100_000, "UR", "MBBS", { limit: 5000 })
  const all = rankToColleges(100_000, "UR", "all", { limit: 5000 })
  assert.ok(mbbs.matches.every((m) => m.course === "MBBS"))
  assert.ok(all.total >= mbbs.total)
  for (const course of COURSES) {
    assert.doesNotThrow(() => rankToColleges(100_000, "UR", course))
  }
})

test("state filter restricts results", () => {
  const delhi = rankToColleges(200_000, "UR", "all", { limit: 500, states: ["DL"] })
  assert.ok(delhi.total > 0)
  assert.ok(delhi.matches.every((m) => m.stateCode === "DL"))
})

test("marksToColleges agrees with the two-step path", () => {
  const direct = marksToColleges(560, "OBC", "MBBS")
  const stepwise = rankToColleges(marksToRank(560).air, "OBC", "MBBS")
  assert.equal(direct.total, stepwise.total)
  assert.equal(direct.rank.air, marksToRank(560).air)
})

test("every category has a human label", () => {
  for (const c of CATEGORIES) {
    assert.ok(CATEGORY_LABEL[c], `missing label for ${c}`)
  }
  assert.equal(CATEGORY_LABEL.UR, "General")
})

test("statesSummary covers every college exactly once", () => {
  const summary = statesSummary()
  const counted = summary.reduce((n, s) => n + s.collegeCount, 0)
  assert.equal(counted, COLLEGES.length)
  assert.equal(summary.length, PLATFORM_STATS.states)
  assert.ok(summary[0]!.collegeCount >= summary[summary.length - 1]!.collegeCount)
})

test("state codes resolve to names and regions", () => {
  assert.equal(stateName("DL"), "Delhi")
  assert.equal(stateName("TN"), "Tamil Nadu")
  assert.equal(regionOf("TN"), "South")
  assert.equal(regionOf("AS"), "Northeast")
  // Unknown codes degrade rather than throw.
  assert.equal(stateName("ZZ"), "ZZ")
})

test("collegesByState resolves slugs", () => {
  const delhi = collegesByState("delhi")
  assert.ok(delhi)
  assert.equal(delhi.state, "Delhi")
  assert.ok(delhi.colleges.length > 0)
  assert.equal(collegesByState("atlantis"), null)
})

test("historyFor returns multi-year rows newest first", () => {
  const withHistory = COLLEGES.find((c) => historyFor(c.slug).length > 3)
  assert.ok(withHistory, "expected at least one college with several years of data")
  const rows = historyFor(withHistory.slug)
  const years = rows.map((r) => r.year)
  assert.deepEqual(years, [...years].sort((a, b) => b - a))
  assert.equal(historyFor("not-a-real-college").length, 0)
})

test("slugify handles ampersands and punctuation", () => {
  assert.equal(slugify("Jammu & Kashmir"), "jammu-and-kashmir")
  assert.equal(slugify("Madhya Pradesh"), "madhya-pradesh")
})

test("formatIndian groups in lakhs and crores", () => {
  assert.equal(formatIndian(1), "1")
  assert.equal(formatIndian(999), "999")
  assert.equal(formatIndian(1000), "1,000")
  assert.equal(formatIndian(100000), "1,00,000")
  assert.equal(formatIndian(1360000), "13,60,000")
})

test("formatIndian handles negatives, used for year-on-year deltas", () => {
  // Regression: "-773" is 4 chars, so naive grouping produced "-,773".
  assert.equal(formatIndian(-773), "-773")
  assert.equal(formatIndian(-1000), "-1,000")
  assert.equal(formatIndian(-100000), "-1,00,000")
  assert.equal(formatIndian(-1), "-1")
  assert.equal(formatIndian(0), "0")
})

test("yearDelta labels a rising closing rank as easier", () => {
  // A worse last-admitted rank means the college got easier to enter.
  const easier = yearDelta([
    { year: 2024, closing: 27235 },
    { year: 2025, closing: 34658 },
  ])
  assert.equal(easier?.direction, "easier")
  assert.equal(easier?.change, 7423)

  const harder = yearDelta([
    { year: 2024, closing: 5000 },
    { year: 2025, closing: 4000 },
  ])
  assert.equal(harder?.direction, "harder")
  assert.equal(harder?.change, -1000)

  assert.equal(yearDelta([{ year: 2025, closing: 10 }])?.direction, "new")
  assert.equal(yearDelta([]), null)
})

test("seatMatrix rows sum to the reported total", () => {
  const target = COLLEGES.find((c) => c.name.startsWith("Bangalore Medical College"))!
  const matrix = seatMatrix(target.slug)

  assert.ok(matrix.rows.length > 0)
  assert.ok(matrix.quotas.length > 0)
  assert.equal(
    matrix.total,
    matrix.rows.reduce((n, r) => n + r.total, 0),
  )
  // Every row's quota breakdown must reconcile with its own total.
  for (const row of matrix.rows) {
    const summed = Object.values(row.byQuota).reduce((n, v) => n + v, 0)
    assert.equal(summed, row.total, `${row.category} quota split does not reconcile`)
  }
  assert.equal(matrix.total, collegeDetail(target.slug)!.seatsLatest)
})

test("stateStats agrees with the colleges it counts", () => {
  const stats = stateStats("karnataka")
  assert.ok(stats)
  // Relational, not a magic number: the count must equal the list it summarises.
  assert.equal(stats.colleges, collegesInState("karnataka").length)
  assert.equal(stats.colleges, COLLEGES.filter((c) => c.state === "Karnataka").length)
  assert.ok(stats.byCourse.MBBS > 0)
  assert.ok(stats.averageClosing && stats.averageClosing > 0)
  assert.equal(stateStats("atlantis"), null)
})

test("collegesInState is sorted by cutoff and carries headline data", () => {
  const rows = collegesInState("karnataka")
  assert.ok(rows.length > 0)
  assert.ok(rows.every((r) => r.college.state === "Karnataka"))

  const ranked = rows.filter((r) => r.closing !== null).map((r) => r.closing!)
  assert.deepEqual(ranked, [...ranked].sort((a, b) => a - b))
  // Colleges with no recent cutoff sort last rather than being dropped.
  assert.equal(
    rows.filter((r) => r.closing === null).length,
    rows.length - ranked.length,
  )
})

test("directoryRows covers every college exactly once", () => {
  const rows = directoryRows()
  assert.equal(rows.length, COLLEGES.length)
  assert.equal(new Set(rows.map((r) => r.college.slug)).size, COLLEGES.length)
})

test("STATES_BY_REGION partitions every state exactly once", () => {
  const all = Object.values(STATES_BY_REGION).flat()
  assert.equal(new Set(all).size, all.length, "no state may appear in two regions")
  assert.equal(new Set(all).size, PLATFORM_STATS.states)
})

test("COLLEGE_TYPES matches the types actually present", () => {
  assert.deepEqual(COLLEGE_TYPES, [...new Set(COLLEGES.map((c) => c.type))].sort())
  assert.ok(COLLEGE_TYPES.includes("State Govt"))
})

test("buildChoiceList numbers choices and reports counts over the full result set", () => {
  const list = buildChoiceList({ rank: 50_000, category: "UR", course: "MBBS" })
  assert.ok(list.total > 0)
  assert.deepEqual(
    list.choices.map((c) => c.order),
    list.choices.map((_, i) => i + 1),
  )
  // counts describe every reachable seat, not just the truncated page.
  const tallied = list.counts.Safe + list.counts.Moderate + list.counts.Reach
  assert.ok(tallied >= list.choices.length)
  assert.ok(list.choices.every((c) => c.advice.length > 0))
  assert.ok(list.choices.every((c) => c.college.closing >= 50_000))
})

test("buildChoiceList orders by preference, not by cutoff", () => {
  const states = ["KA"]
  const plain = buildChoiceList({ rank: 60_000, category: "UR", course: "MBBS" })
  const biased = buildChoiceList({
    rank: 60_000,
    category: "UR",
    course: "MBBS",
    preferredStates: states,
    weights: { state: 5 },
  })

  const firstBiased = biased.choices[0]
  assert.ok(firstBiased, "expected results")
  // A heavy home-state weight must pull a Karnataka seat to the top.
  assert.equal(firstBiased.college.stateCode, "KA")
  assert.notDeepEqual(
    plain.choices.map((c) => c.college.slug),
    biased.choices.map((c) => c.college.slug),
  )
})

test("the anchor warning fires exactly when no Safe seat is listed", () => {
  // Invariant across the whole rank range, rather than pinning example ranks:
  // a strong rank makes everything Safe, a rank at the edge of the field clears
  // only Reach seats, and the warning must track that and nothing else.
  const ranks = [1, 5_000, 50_000, 200_000, 600_000, 900_000]
  let sawWarning = false
  let sawAnchor = false

  for (const rank of ranks) {
    const list = buildChoiceList({ rank, category: "UR", course: "all" })
    if (list.choices.length === 0) continue

    const hasSafe = list.choices.some((c) => c.college.tier === "Safe")
    assert.equal(list.guidance.hasAnchor, hasSafe, `hasAnchor wrong at rank ${rank}`)
    assert.equal(
      list.guidance.warning,
      hasSafe ? null : "NO_ANCHOR",
      `warning wrong at rank ${rank}`,
    )
    sawWarning ||= !hasSafe
    sawAnchor ||= hasSafe
  }

  assert.ok(sawAnchor, "expected at least one rank with an anchor")
  assert.ok(sawWarning, "expected at least one rank without an anchor")
})

test("buildChoiceList attaches real round history, never a forecast", () => {
  const list = buildChoiceList({ rank: 40_000, category: "UR", course: "MBBS", limit: 10 })
  const withRounds = list.choices.find((c) => c.rounds.length > 1)
  assert.ok(withRounds, "expected at least one seat with several rounds")

  const orders = withRounds.rounds.map((r) => r.closing)
  assert.ok(orders.every((n) => n > 0))
  assert.equal(
    withRounds.seats,
    withRounds.rounds.reduce((n, r) => n + r.seats, 0),
  )
  // clearsFromRound must point at a round that genuinely reaches the rank.
  if (withRounds.clearsFromRound) {
    const row = withRounds.rounds.find((r) => r.round === withRounds.clearsFromRound)
    assert.ok(row && row.closing >= 40_000)
  }
})

test("collegeDetail assembles everything the college page needs", () => {
  const target = COLLEGES.find((c) => c.name.startsWith("Bangalore Medical College"))
  assert.ok(target, "expected the sample college to exist")

  const detail = collegeDetail(target.slug)
  assert.ok(detail)
  assert.equal(detail.college.slug, target.slug)
  assert.ok(detail.courses.length > 0)
  assert.ok(detail.categories.includes("UR"))
  assert.ok(detail.years.length > 0)

  // Years descend, latest first.
  assert.deepEqual(detail.years, [...detail.years].sort((a, b) => b - a))

  // Latest cutoffs are all from the newest year and sorted tightest first.
  const newest = detail.years[0]!
  assert.ok(detail.latest.every((c) => c.year === newest))
  const closings = detail.latest.map((c) => c.closing)
  assert.deepEqual(closings, [...closings].sort((a, b) => a - b))

  assert.equal(collegeDetail("not-a-real-college"), null)
})

test("collegeDetail rounds are ordered and carry seat counts", () => {
  const withRounds = COLLEGES.map((c) => collegeDetail(c.slug)).find(
    (d) => d && d.rounds.length > 2,
  )
  assert.ok(withRounds, "expected a college with several rounds")

  const orders = withRounds.rounds.map((r) => r.roundOrder)
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b))
  assert.ok(withRounds.rounds.every((r) => r.seats >= 0))
  assert.equal(
    withRounds.seatsLatest,
    withRounds.rounds.reduce((n, r) => n + r.seats, 0),
  )
})

test("seatsFor splits the total by category", () => {
  const target = COLLEGES.find((c) => c.name.startsWith("Bangalore Medical College"))!
  const detail = collegeDetail(target.slug)!

  // DATA-PINNED. The production website reports 20 for this college, labelling
  // it "AIQ seats" — that figure is the UR category, not the quota, and the true
  // total is higher. Kept exact because it documents a real discrepancy we chose
  // not to copy. On a data refresh the bundle checksum in
  // dataset.contract.test.ts fails first and points here.
  assert.equal(detail.seatsFor("UR"), 20)
  assert.equal(detail.seatsLatest, 57)

  const summed = detail.categories.reduce((n, c) => n + detail.seatsFor(c), 0)
  assert.equal(summed, detail.seatsLatest, "per-category seats must sum to the total")
})

test("trendFor returns one point per year, oldest first", () => {
  const target = COLLEGES.find((c) => c.name.startsWith("Bangalore Medical College"))!
  const trend = collegeDetail(target.slug)!.trendFor("UR")
  assert.ok(trend.length > 1)

  const years = trend.map((p) => p.year)
  assert.deepEqual(years, [...years].sort((a, b) => a - b))
  assert.equal(new Set(years).size, years.length, "one point per year")
  assert.ok(trend.every((p) => p.closing > 0))
})

test("collegeBySlug round-trips every college", () => {
  for (const c of COLLEGES.slice(0, 50)) {
    assert.equal(collegeBySlug(c.slug)?.slug, c.slug)
  }
  assert.equal(collegeBySlug("nope"), null)
})

test("faqsFor generates answers from the college's own numbers", () => {
  const target = COLLEGES.find((c) => c.name.startsWith("Bangalore Medical College"))!
  const faqs = faqsFor(target.slug)

  assert.ok(faqs.length >= 4)
  assert.ok(faqs.every((f) => f.question.length > 0 && f.answer.length > 0))
  // Generated, so they must mention the college and contain no stored HTML.
  assert.ok(faqs.some((f) => f.question.includes(target.shortName)))
  assert.ok(faqs.every((f) => !f.answer.includes("<a ")))
  assert.equal(faqsFor("not-a-real-college").length, 0)
})

test("buildChoiceList reports the true total even when capped", () => {
  const list = buildChoiceList({ rank: 500_000, category: "UR", course: "all", limit: 3 })
  assert.equal(list.choices.length, 3)
  assert.ok(list.total >= 3)
})
