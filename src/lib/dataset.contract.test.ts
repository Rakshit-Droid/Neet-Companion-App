import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"

import data from "../data/neet-data.json"
import { COLLEGES, LATEST_CUTOFF_YEAR } from "./predictors"

// These assert that the SHIPPED BUNDLE is internally consistent and unchanged.
// Behaviour lives in predictors.test.ts. Keeping the two apart means a data
// refresh fails here, loudly and in one place, instead of scattering failures
// through behavioural tests that are not actually broken.

/**
 * Single checksum standing in for a wall of hardcoded counts. When the dataset
 * is deliberately regenerated, update this in the SAME commit as the data. If
 * it changes unexpectedly, the data moved when it should not have.
 */
const KNOWN_BUNDLE_SHA256: string =
  "27fc6c888b71e43fb5d2a5adf00c7f7cf92305696bb73160dc2a7b8258f28261"

test("bundle checksum is unchanged", (t) => {
  const actual = createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex")

  if (KNOWN_BUNDLE_SHA256 === "PLACEHOLDER_SET_ON_FIRST_RUN") {
    t.diagnostic(`bundle sha256 = ${actual}`)
    t.skip("checksum not yet pinned; set KNOWN_BUNDLE_SHA256 to the value above")
    return
  }
  assert.equal(actual, KNOWN_BUNDLE_SHA256)
})

test("the decoded engine matches the bundle it was decoded from", () => {
  // PLATFORM_STATS used to be asserted here. It was removed with the rest of
  // the platform-stat surface, so this checks the decode itself instead — that
  // every institute row became a college, which is what the screens rely on.
  assert.equal(COLLEGES.length, data.institutes.length)
  assert.equal(LATEST_CUTOFF_YEAR, Math.max(...data.meta.cutoffYears))
})

test("cutoffs are sorted ascending by closing rank", () => {
  // rankToColleges binary-searches this array. If the ordering ever breaks, the
  // search silently returns wrong results rather than failing, so assert it.
  const closings = (data.cutoffs as number[][]).map((r) => r[5]!)
  for (let i = 1; i < closings.length; i++) {
    assert.ok(
      closings[i]! >= closings[i - 1]!,
      `cutoffs unsorted at index ${i}: ${closings[i - 1]} then ${closings[i]}`,
    )
  }
})

test("curve is sorted descending by score and strictly positive", () => {
  const curve = data.curve as number[][]
  for (let i = 1; i < curve.length; i++) {
    assert.ok(curve[i]![0]! < curve[i - 1]![0]!, `curve unsorted at ${i}`)
  }
  assert.ok(curve.every((p) => p[0]! > 0 && p[1]! > 0))
})

test("every row references a real pool entry", () => {
  const nInst = data.institutes.length
  const nCourse = data.courses.length
  const nCat = data.categories.length
  const nQuota = data.quotas.length
  const nRound = data.roundNames.length

  for (const r of data.cutoffs as number[][]) {
    assert.ok(r[0]! >= 0 && r[0]! < nInst, `bad institute index ${r[0]}`)
    assert.ok(r[1]! >= 0 && r[1]! < nCourse)
    assert.ok(r[2]! >= 0 && r[2]! < nCat)
    assert.ok(r[3]! >= 0 && r[3]! < nQuota)
    assert.ok(r[5]! > 0, "closing rank must be positive")
  }
  for (const r of data.rounds as number[][]) {
    assert.ok(r[0]! >= 0 && r[0]! < nInst)
    assert.ok(r[5]! >= 0 && r[5]! < nRound)
    assert.ok(r[7]! > 0)
    assert.ok(r[8]! >= 0, "seat count must not be negative")
  }
})

test("institute slugs are unique and non-empty", () => {
  const slugs = COLLEGES.map((c) => c.slug)
  assert.equal(new Set(slugs).size, slugs.length, "duplicate slug")
  assert.ok(slugs.every((s) => s.length > 0))
})

test("sanity bounds: the dataset has not collapsed or exploded", () => {
  // Deliberately wide. Catches a broken export, not a normal year-on-year change.
  assert.ok(data.institutes.length > 400 && data.institutes.length < 2000)
  assert.ok(data.cutoffs.length > 10_000 && data.cutoffs.length < 200_000)
  assert.ok(data.rounds.length > 10_000 && data.rounds.length < 500_000)
  assert.ok(data.meta.cutoffYears.length >= 3)
  assert.ok(data.meta.reliableRankCap > 0)
})
