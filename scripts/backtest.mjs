// Ship gate for the allotment probability model.
//
// Fits on every year up to and including HOLDOUT-1, predicts HOLDOUT, and checks
// whether stated probabilities match observed frequencies. A model that says
// "70% likely" must be right about 70% of the time, or the number is a lie.
//
//   node scripts/backtest.mjs           # uses .tmp-test build
//
// PASS requires, for every decile with n >= 50:
//   |predicted - observed| <= 0.10
// and overall Brier score <= 0.18.

import { readFileSync } from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const data = require("../.tmp-test/data/neet-data.json")
const { estimate } = require("../.tmp-test/lib/probability.js")

const HOLDOUT = Math.max(...data.meta.cutoffYears)
const comboKey = (r) => `${r[0]}|${r[1]}|${r[2]}|${r[3]}`

// Tightest closing rank per combo per year, matching how the app collapses quotas.
const history = new Map()
for (const c of data.cutoffs) {
  const k = comboKey(c)
  let years = history.get(k)
  if (!years) history.set(k, (years = new Map()))
  const prev = years.get(c[4])
  if (prev === undefined || c[5] < prev) years.set(c[4], c[5])
}

// Every (combo, candidate rank) pair we can score: needs pre-holdout history AND
// a holdout observation to check against.
const trials = []
for (const [, years] of history) {
  const actual = years.get(HOLDOUT)
  if (actual === undefined) continue
  // Must sort: the source rows are ordered by closing rank, not by year, so
  // taking the "last" entry unsorted picks an arbitrary year.
  const past = [...years.entries()]
    .filter(([y]) => y < HOLDOUT)
    .map(([year, closing]) => ({ year, closing }))
    .sort((a, b) => a.year - b.year)
  if (past.length === 0) continue

  // Probe at ranks spread around the most recent known closing rank, so the test
  // covers confident and marginal cases rather than only easy ones.
  const anchor = past[past.length - 1].closing
  for (const mult of [0.4, 0.7, 0.9, 1.0, 1.15, 1.5, 2.5]) {
    const rank = Math.max(1, Math.round(anchor * mult))
    const est = estimate(past, rank, HOLDOUT)
    if (!est) continue
    trials.push({ p: est.probability, hit: actual >= rank ? 1 : 0, years: past.length })
  }
}

const deciles = Array.from({ length: 10 }, () => ({ n: 0, sumP: 0, hits: 0 }))
let brier = 0
for (const t of trials) {
  const i = Math.min(9, Math.floor(t.p * 10))
  deciles[i].n++
  deciles[i].sumP += t.p
  deciles[i].hits += t.hit
  brier += (t.p - t.hit) ** 2
}
brier /= trials.length

console.log(`holdout year: ${HOLDOUT}`)
console.log(`trials:       ${trials.length.toLocaleString()}`)
console.log(`brier score:  ${brier.toFixed(4)}  (lower is better, gate <= 0.18)\n`)
console.log("decile   n      predicted  observed   gap")

let worst = 0
let failed = false
deciles.forEach((d, i) => {
  if (d.n === 0) return
  const predicted = d.sumP / d.n
  const observed = d.hits / d.n
  const gap = Math.abs(predicted - observed)
  const graded = d.n >= 50
  if (graded && gap > worst) worst = gap
  if (graded && gap > 0.1) failed = true
  console.log(
    `${String(i * 10).padStart(3)}-${String(i * 10 + 10).padEnd(3)} ` +
      `${String(d.n).padStart(6)}   ${predicted.toFixed(3)}      ${observed.toFixed(3)}     ` +
      `${gap.toFixed(3)}${graded ? (gap > 0.1 ? "  FAIL" : "") : "  (n<50, ungraded)"}`,
  )
})

console.log(`\nworst graded gap: ${worst.toFixed(3)}  (gate <= 0.100)`)
if (brier > 0.18) failed = true

console.log(failed ? "\nRESULT: FAIL — do not ship probabilities" : "\nRESULT: PASS")
process.exit(failed ? 1 : 0)
