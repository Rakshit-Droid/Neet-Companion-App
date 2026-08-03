import test from "node:test"
import assert from "node:assert/strict"

import {
  CATEGORIES,
  CATEGORY_LABEL,
  COLLEGES,
  COURSES,
  STATES_BY_REGION,
  LATEST_CUTOFF_YEAR,
  collegeBySlug,
  collegeDetail,
  formatIndian,
  rankToColleges,
  regionOf,
  slugify,
  stateName,
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

test("every category has a human label", () => {
  for (const c of CATEGORIES) {
    assert.ok(CATEGORY_LABEL[c], `missing label for ${c}`)
  }
  assert.equal(CATEGORY_LABEL.UR, "General")
})

test("state codes resolve to names and regions", () => {
  assert.equal(stateName("DL"), "Delhi")
  assert.equal(stateName("TN"), "Tamil Nadu")
  assert.equal(regionOf("TN"), "South")
  assert.equal(regionOf("AS"), "Northeast")
  // Unknown codes degrade rather than throw.
  assert.equal(stateName("ZZ"), "ZZ")
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

test("buildChoiceList reports the true total even when capped", () => {
  const list = buildChoiceList({ rank: 500_000, category: "UR", course: "all", limit: 3 })
  assert.equal(list.choices.length, 3)
  assert.ok(list.total >= 3)
})

// Restored after the browse-screen engine was removed: STATES_BY_REGION is
// still live, and this only referenced PLATFORM_STATS to get a state count.
test("STATES_BY_REGION partitions every state exactly once", () => {
  const all = Object.values(STATES_BY_REGION).flat()
  assert.equal(new Set(all).size, all.length, "no state may appear in two regions")
  assert.equal(new Set(all).size, new Set(COLLEGES.map((c) => c.stateCode)).size)
})
