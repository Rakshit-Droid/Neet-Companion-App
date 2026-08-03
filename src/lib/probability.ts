// Allotment probability from historical closing ranks.
//
// Every constant here was measured from the shipped bundle, not assumed. See
// scripts/fit-params.mjs to regenerate them after a data refresh.
//
// The honest framing: closing ranks drift year to year, and how much they drift
// depends on where in the rank distribution a seat sits. We model a seat's next
// closing rank as log-normal, then ask how likely it is to land at or beyond the
// candidate's rank.

/** Rank bands with their own measured drift and dispersion (log space). */
interface Band {
  max: number
  /** Mean year-over-year log ratio: positive means cutoffs loosen. */
  drift: number
  /** Standard deviation of that log ratio. */
  sigma: number
}

/**
 * Fitted by predicting 2024 from 2019-2023 and taking robust (median/MAD)
 * residuals, so the 2025 holdout stayed untouched for the calibration gate.
 *
 * Note the sign flip at the top: seats inside AIR 10,000 have tightened year on
 * year, while the mid range loosens. Using one global drift over-predicted the
 * middle badly, which the gate caught.
 */
const BANDS: Band[] = [
  { max: 2_000, drift: -0.137, sigma: 0.497 },
  { max: 10_000, drift: -0.067, sigma: 0.260 },
  { max: 50_000, drift: 0.098, sigma: 0.120 },
  { max: 150_000, drift: 0.129, sigma: 0.126 },
  { max: Infinity, drift: 0.060, sigma: 0.421 },
]

function bandFor(closing: number): Band {
  return BANDS.find((b) => closing < b.max) ?? BANDS[BANDS.length - 1]!
}

/**
 * Empirical distribution of prediction residuals, ln(actual) - ln(predicted),
 * as 41 evenly spaced quantiles from p0 to p100.
 *
 * Pooled from fit years 2021-2024, with 2025 held out entirely so the
 * calibration gate stays honest.
 *
 * A normal was tried first and failed the gate. The real distribution is
 * leptokurtic: the core is extremely tight (p30 to p70 spans only about
 * -0.06 to +0.09) while the tails are enormous (p2.5 = -0.72, p97.5 = +0.76).
 * Fitting one sigma to that over-widens the core, which made every mid-range
 * probability far too optimistic.
 */
const RESIDUAL_QUANTILES = [
  -3.788, -0.7192, -0.481, -0.3411, -0.2641, -0.2021, -0.1589, -0.1266, -0.1003,
  -0.0779, -0.0612, -0.0461, -0.0334, -0.0231, -0.0135, -0.0055, 0.0022, 0.0109,
  0.0196, 0.0278, 0.0374, 0.0472, 0.0587, 0.0695, 0.0815, 0.0925, 0.1054, 0.1192,
  0.1365, 0.1533, 0.1718, 0.1975, 0.223, 0.2517, 0.2876, 0.3289, 0.3798, 0.4487,
  0.5513, 0.7558, 6.041,
]

/**
 * P(residual <= x) by linear interpolation over the empirical quantiles.
 * Non-parametric, so skew and fat tails are handled by construction.
 */
function residualCdf(x: number): number {
  const q = RESIDUAL_QUANTILES
  const last = q.length - 1
  if (x <= q[0]!) return 0
  if (x >= q[last]!) return 1
  for (let i = 1; i <= last; i++) {
    if (x <= q[i]!) {
      const span = q[i]! - q[i - 1]!
      const frac = span === 0 ? 0 : (x - q[i - 1]!) / span
      return (i - 1 + frac) / last
    }
  }
  return 1
}

/** Widens the residual spread when a seat has very little history. */
function thinHistoryStretch(years: number): number {
  if (years >= 4) return 1
  return 1 + (4 - years) * 0.18
}

/** Recency weight: an observation k years old counts 0.6^k. */
const RECENCY_DECAY = 0.6

/**
 * Measured median loosening between consecutive rounds, used only to impute a
 * round a seat has no history for. Mop-Up was replaced by Round 3 in 2023.
 */
export const ROUND_RATIO: Record<string, number> = {
  "Round 1->Round 2": 1.213,
  "Round 2->Round 3": 1.085,
  "Round 2->Mop-Up Round": 1.278,
  "Round 3->Stray Round": 1.278,
  "Stray Round->Special Stray Round": 1.152,
}

/** Abramowitz-Stegun normal CDF. Max error ~7.5e-8, ample here. */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

export interface Observation {
  year: number
  closing: number
}

export interface Estimate {
  /** Expected closing rank in the target year. */
  expected: number
  /** Probability the seat closes at or beyond the candidate's rank. */
  probability: number
  /** Years of real data behind this. 0 means fully imputed. */
  years: number
  imputed: boolean
}

/**
 * Estimate a seat's closing rank in `targetYear` and the chance a candidate at
 * `rank` clears it.
 *
 * Observations are drift-adjusted to the target year, combined as a
 * recency-weighted mean in log space, and given a dispersion that widens when
 * history is thin. Thin history therefore produces a less confident answer
 * rather than a falsely precise one.
 */
export function estimate(
  observations: Observation[],
  rank: number,
  targetYear: number,
  opts: { imputed?: boolean; extraSigma?: number } = {},
): Estimate | null {
  const usable = observations.filter((o) => o.closing > 0 && o.year <= targetYear)
  if (usable.length === 0) return null

  let weightSum = 0
  let logSum = 0
  for (const o of usable) {
    const gap = targetYear - o.year
    const band = bandFor(o.closing)
    // Project this observation forward to the target year.
    const adjusted = Math.log(o.closing) + band.drift * gap
    const w = Math.pow(RECENCY_DECAY, Math.max(0, gap - 1))
    logSum += adjusted * w
    weightSum += w
  }

  const meanLog = logSum / weightSum
  const expected = Math.exp(meanLog)

  const r = Math.max(1, rank)
  // The seat is reachable when its actual closing rank lands at or beyond the
  // candidate's rank, i.e. when the residual is at least this much.
  const needed = Math.log(r) - meanLog
  const stretch = thinHistoryStretch(usable.length) * (1 + (opts.extraSigma ?? 0))

  return {
    expected: Math.round(expected),
    probability: Math.min(1, Math.max(0, 1 - residualCdf(needed / stretch))),
    years: usable.length,
    imputed: Boolean(opts.imputed),
  }
}

export type Band5 = "very_likely" | "likely" | "tossup" | "unlikely" | "long_shot"

/**
 * Buckets rather than raw percentages. Reporting "63.4%" off three years of data
 * is false precision, and this number decides where someone studies.
 */
export function toBand(p: number): Band5 {
  if (p >= 0.85) return "very_likely"
  if (p >= 0.6) return "likely"
  if (p >= 0.35) return "tossup"
  if (p >= 0.15) return "unlikely"
  return "long_shot"
}

export const BAND_LABEL: Record<Band5, string> = {
  very_likely: "Very likely",
  likely: "Likely",
  tossup: "Toss-up",
  unlikely: "Unlikely",
  long_shot: "Long shot",
}
