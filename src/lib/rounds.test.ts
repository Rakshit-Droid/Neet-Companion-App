import { test } from "node:test"
import assert from "node:assert/strict"

import data from "../data/neet-data.json"
import { COLLEGES, type Category, type Course } from "./predictors"
import {
  ROUND_SCHEDULE,
  VERDICT_LABEL,
  buildRoundPlan,
  roundEvidence,
  verdictStrength,
  type RoundEvidence,
} from "./rounds"

// Every expectation here is derived from the shipped bundle rather than
// hardcoded, so a data refresh moves the fixtures with the data instead of
// failing tests that are not actually broken.

interface Seat {
  slug: string
  category: Category
  course: Course
  quota: string
  /** Raw rows for this exact seat type, the ground truth for consistency checks. */
  rows: number[][]
}

const SEATS: Seat[] = (() => {
  const byKey = new Map<string, number[][]>()
  for (const row of data.rounds as number[][]) {
    const key = `${row[0]}|${row[1]}|${row[2]}|${row[3]}`
    const list = byKey.get(key)
    if (list) list.push(row)
    else byKey.set(key, [row])
  }
  return [...byKey.entries()].map(([key, rows]) => {
    const [college, course, category, quota] = key.split("|").map(Number)
    return {
      slug: COLLEGES[college!]!.slug,
      course: data.courses[course!] as Course,
      category: data.categories[category!] as Category,
      quota: data.quotas[quota!]!,
      rows,
    }
  })
})()

/** Every 37th seat: ~113 of 4,183, spread across colleges, courses and quotas. */
const SAMPLE = SEATS.filter((_, i) => i % 37 === 0)

/** Ascending, so each step is a strictly worse candidate. */
const RANKS = [1, 500, 5_000, 25_000, 100_000, 400_000, 1_200_000]

function evidenceFor(seat: Seat, rank: number): RoundEvidence[] {
  return roundEvidence(seat.slug, seat.category, seat.course, seat.quota, rank)
}

test("the schedule is the latest year's rounds, in counselling order", () => {
  const latestYear = Math.max(...data.meta.cutoffYears)
  const expected = [
    ...new Map(
      (data.rounds as number[][])
        .filter((r) => r[4] === latestYear)
        .map((r) => [data.roundNames[r[5]!]!, r[6]!] as const),
    ).entries(),
  ]
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name)

  assert.deepEqual(ROUND_SCHEDULE, expected)
  assert.ok(ROUND_SCHEDULE.length > 1)
  // Mop-Up was replaced by Round 3 in 2023. A candidate cannot attend it, so it
  // must not appear as a column with data next to rounds that still run.
  assert.ok(!ROUND_SCHEDULE.includes("Mop-Up Round"))
})

test("n, years and spread match the rows actually used", () => {
  for (const seat of SEATS) {
    const evidence = evidenceFor(seat, 50_000)
    assert.equal(evidence.length, ROUND_SCHEDULE.length, seat.slug)

    evidence.forEach((ev, i) => {
      assert.equal(ev.round, ROUND_SCHEDULE[i])

      const rows = seat.rows.filter((r) => data.roundNames[r[5]!] === ev.round)
      const years = rows.map((r) => r[4]!).sort((a, b) => a - b)
      const closings = rows.map((r) => r[7]!).sort((a, b) => a - b)

      assert.deepEqual(ev.years, years, `${seat.slug} ${ev.round} years`)
      assert.equal(ev.n, rows.length, `${seat.slug} ${ev.round} n`)
      assert.equal(new Set(ev.years).size, ev.n, "a year must not be counted twice")

      if (rows.length === 0) {
        assert.equal(ev.spread, null)
        assert.equal(ev.verdict, "no-data")
        return
      }

      assert.notEqual(ev.spread, null)
      assert.equal(ev.spread?.worst, closings[0])
      assert.equal(ev.spread?.best, closings[closings.length - 1])
      assert.ok(ev.spread!.worst <= ev.spread!.median && ev.spread!.median <= ev.spread!.best)
      // Seats are those of the most recent year on record for that round.
      const newest = rows.reduce((a, b) => (b[4]! > a[4]! ? b : a))
      assert.equal(ev.seats, newest[8])
    })
  }
})

test("sample size is visible, and thin rounds are distinguishable from deep ones", () => {
  // Round 3 only exists from 2023, Round 1 from 2019, so the same seat carries
  // materially different evidence per round. The UI has to be able to see that.
  const depths = new Set<number>()
  for (const seat of SEATS) {
    for (const ev of evidenceFor(seat, 50_000)) depths.add(ev.n)
  }
  assert.ok(depths.has(0), "no-data rounds exist")
  assert.ok(depths.has(1), "single-year rounds exist")
  assert.ok(Math.max(...depths) >= 7, "rounds with the full year range exist")
})

test("a better rank never yields a worse verdict", () => {
  for (const seat of SAMPLE) {
    let previous = evidenceFor(seat, RANKS[0]!)
    for (const rank of RANKS.slice(1)) {
      const current = evidenceFor(seat, rank)
      current.forEach((ev, i) => {
        assert.ok(
          verdictStrength(ev.verdict) <= verdictStrength(previous[i]!.verdict),
          `${seat.slug} ${ev.round}: rank ${rank} graded ${ev.verdict}, better rank got ${previous[i]!.verdict}`,
        )
      })
      previous = current
    }
  }
})

test("later rounds are never harsher than earlier ones", () => {
  for (const seat of SAMPLE) {
    for (const rank of RANKS) {
      let strongest = -1
      for (const ev of evidenceFor(seat, rank)) {
        if (ev.verdict === "no-data") continue
        assert.ok(
          verdictStrength(ev.verdict) >= strongest,
          `${seat.slug} ${ev.round} at rank ${rank}: ${ev.verdict} is worse than an earlier round`,
        )
        strongest = verdictStrength(ev.verdict)
      }
    }
  }
})

test("the round progression is surfaced, not flattened", () => {
  // The whole point of the feature: seats a rank misses in round 1 and reaches
  // later. If this ever hits zero the engine has stopped saying anything useful.
  let improving = 0
  for (const seat of SAMPLE) {
    for (const rank of RANKS) {
      const graded = evidenceFor(seat, rank).filter((ev) => ev.verdict !== "no-data")
      if (graded.length < 2) continue
      if (verdictStrength(graded[graded.length - 1]!.verdict) > verdictStrength(graded[0]!.verdict)) {
        improving++
      }
    }
  }
  assert.ok(improving > 0, "no seat improved across rounds")
})

test("a rank inside every observed closing rank clears every round with data", () => {
  for (const seat of SAMPLE) {
    for (const ev of evidenceFor(seat, 1)) {
      assert.equal(ev.verdict, ev.n === 0 ? "no-data" : "clear", `${seat.slug} ${ev.round}`)
    }
  }
})

test("a rank far beyond every observed closing rank is unlikely, not a crash", () => {
  const beyond = Math.max(...(data.rounds as number[][]).map((r) => r[7]!)) + 1
  for (const seat of SAMPLE) {
    for (const ev of evidenceFor(seat, beyond)) {
      assert.equal(ev.verdict, ev.n === 0 ? "no-data" : "unlikely", `${seat.slug} ${ev.round}`)
    }
  }
})

test("rounds a seat was never recorded in are reported, not dropped", () => {
  const partial = SEATS.filter((seat) => {
    const rounds = new Set(seat.rows.map((r) => data.roundNames[r[5]!]!))
    return ROUND_SCHEDULE.some((round) => !rounds.has(round))
  })
  assert.ok(partial.length > 0, "fixture is meaningless if every seat ran every round")

  for (const seat of partial.filter((_, i) => i % 37 === 0)) {
    const evidence = evidenceFor(seat, 50_000)
    assert.equal(evidence.length, ROUND_SCHEDULE.length)

    const rounds = new Set(seat.rows.map((r) => data.roundNames[r[5]!]!))
    for (const ev of evidence) {
      if (rounds.has(ev.round)) continue
      assert.equal(ev.verdict, "no-data", `${seat.slug} ${ev.round}`)
      assert.equal(ev.n, 0)
      assert.deepEqual(ev.years, [])
      assert.equal(ev.spread, null)
      assert.equal(ev.seats, 0)
    }
  }
})

test("an unknown seat is all no-data rather than an empty list", () => {
  const evidence = roundEvidence("not-a-college", "UR", "MBBS", "All India", 10_000)
  assert.equal(evidence.length, ROUND_SCHEDULE.length)
  assert.ok(evidence.every((ev) => ev.verdict === "no-data" && ev.spread === null))
})

test("out-of-range ranks are clamped rather than inverted", () => {
  const seat = SAMPLE[0]!
  assert.deepEqual(evidenceFor(seat, 0), evidenceFor(seat, 1))
  assert.deepEqual(evidenceFor(seat, -50), evidenceFor(seat, 1))
})

test("buildRoundPlan expands the choice list without reordering it", () => {
  const input = { rank: 25_000, category: "UR" as Category, course: "MBBS" as Course }
  const plan = buildRoundPlan(input)

  assert.deepEqual(plan.schedule, ROUND_SCHEDULE)
  assert.ok(plan.plans.length > 0)
  plan.plans.forEach((p, i) => {
    assert.equal(p.choice.order, i + 1)
    assert.equal(p.rounds.length, ROUND_SCHEDULE.length)

    const expected = roundEvidence(
      p.choice.college.slug,
      p.choice.college.category,
      p.choice.college.course,
      p.choice.college.quota,
      input.rank,
    )
    assert.deepEqual(p.rounds, expected)

    const likely = p.rounds.find((r) => verdictStrength(r.verdict) >= verdictStrength("likely"))
    assert.equal(p.likelyFromRound, likely?.round ?? null)

    const graded = p.rounds.filter((r) => r.verdict !== "no-data")
    const strongest = graded.length
      ? graded.reduce((a, b) => (verdictStrength(b.verdict) > verdictStrength(a.verdict) ? b : a))
          .verdict
      : "no-data"
    assert.equal(p.bestVerdict, strongest)
  })
})

test("preference weights reorder the plan without changing the evidence", () => {
  const base = { rank: 25_000, category: "UR" as Category, course: "MBBS" as Course, limit: 15 }
  const weighted = buildRoundPlan({
    ...base,
    preferredStates: ["KA"],
    weights: { state: 5 },
  })

  assert.equal(weighted.total, buildRoundPlan(base).total)

  // Evidence is a property of the seat, so it must not move when the ordering does.
  for (const p of weighted.plans) {
    assert.deepEqual(
      p.rounds,
      roundEvidence(
        p.choice.college.slug,
        p.choice.college.category,
        p.choice.college.course,
        p.choice.college.quota,
        base.rank,
      ),
    )
  }
})

test("a rank past every cutoff yields an empty plan, not a throw", () => {
  const plan = buildRoundPlan({ rank: 50_000_000, category: "UR", course: "MBBS" })
  assert.deepEqual(plan.plans, [])
  assert.equal(plan.total, 0)
})

test("every verdict has a label", () => {
  const seen = new Set<string>()
  for (const seat of SAMPLE) {
    for (const rank of RANKS) for (const ev of evidenceFor(seat, rank)) seen.add(ev.verdict)
  }
  for (const verdict of seen) {
    assert.ok(VERDICT_LABEL[verdict as keyof typeof VERDICT_LABEL], `no label for ${verdict}`)
  }
  assert.ok(seen.size >= 4, "the ladder is not being exercised")
})

// -- regression ---------------------------------------------------------------

/**
 * The verdict ladder was shipped with `worst` and `best` swapped. Because
 * worst <= median <= best, the "clear" branch tested the loosest bound first and
 * swallowed every rank that would have cleared in even one favourable year, so
 * "likely" and "contested" were effectively unreachable and everything reported
 * Clear.
 *
 * Monotonicity could not catch it — the inverted ladder is monotonic too. This
 * pins the direction instead: clearing the TIGHTEST year on record is what makes
 * a seat clear, and clearing only the loosest one must not.
 *
 * Only the first round that has data is probed. Verdicts deliberately carry
 * forward so they never weaken later in the schedule, so any later round may be
 * reporting a verdict earned earlier rather than its own numbers.
 */
test("a verdict is anchored to the tightest year, not the loosest", () => {
  const probes = SEATS.flatMap((seat) => {
    const rounds = roundEvidence(seat.slug, seat.category, seat.course, seat.quota, 1)
    const first = rounds.find((r) => r.spread !== null)
    // A round whose years all closed at the same rank proves nothing here.
    if (!first || first.spread!.worst >= first.spread!.best) return []
    return [{ seat, spread: first.spread!, round: first.round }]
  }).slice(0, 400)

  assert.ok(probes.length > 0, "no seat in the bundle has a varying first round")

  for (const { seat, spread, round } of probes) {
    const at = (rank: number) =>
      roundEvidence(seat.slug, seat.category, seat.course, seat.quota, rank).find(
        (r) => r.round === round,
      )!.verdict

    // Good enough for the hardest year on record: nothing stronger than clear exists.
    assert.equal(
      at(spread.worst),
      "clear",
      `${seat.slug} ${round}: clearing the tightest year (${spread.worst}) must be clear`,
    )

    // Only good enough for the single loosest year: that is not a safe seat.
    assert.notEqual(
      at(spread.best),
      "clear",
      `${seat.slug} ${round}: clearing only the loosest year (${spread.best}) must not be clear`,
    )

    // Beyond every observed closing rank there is no evidence of admission.
    assert.equal(at(spread.best + 1), "unlikely")
  }
})
