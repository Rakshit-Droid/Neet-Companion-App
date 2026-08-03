import AsyncStorage from "@react-native-async-storage/async-storage"

import {
  LATEST_CUTOFF_YEAR,
  collegeBySlug,
  collegeDetail,
  type Category,
  type College,
  type Course,
} from "./predictors"
import {
  billingOf,
  daysRemaining,
  isExpired,
  periodKey,
  renew,
  startBilling,
} from "./watch-billing"
import { PRICE } from "./credits"

const KEY = "watchlist-v1"

/**
 * What a college's numbers looked like when it was added. Kept so the app can
 * show what has moved since, without a server.
 *
 * Honest limitation: the dataset is bundled, so these only change when a new
 * app version ships with refreshed cutoffs. This tracks "what changed since you
 * started watching", not live counselling.
 */
export interface WatchSnapshot {
  year: number
  category: Category
  course: Course
  /**
   * Which quota the snapshot came from. Needed to look up the round history for
   * this exact seat — the same college and course under a different quota is a
   * different cutoff entirely. Optional because entries saved before this field
   * existed have no value for it.
   */
  quota?: string
  closing: number
  seats: number
}

export interface WatchEntry {
  slug: string
  addedAt: number
  /** The rank the user had in mind, so we can say when a cutoff passes it. */
  rank: number | null
  snapshot: WatchSnapshot | null
  /** Epoch ms the paid week runs until. Absent on entries added before billing. */
  paidThrough?: number
  /** Weeks paid. Suffixes the idempotency key so a week cannot be billed twice. */
  periods?: number
}

export interface WatchStatus {
  entry: WatchEntry
  college: College
  current: WatchSnapshot | null
  /** Positive means the cutoff loosened since it was added. */
  change: number | null
  /** True when the cutoff has moved past the user's saved rank since adding. */
  nowReachable: boolean
  /** Unpaid: kept with its last figures, but no longer tracked. */
  expired: boolean
  /** Days left in the paid week. 0 once expired. */
  daysLeft: number
}

async function readAll(): Promise<WatchEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as WatchEntry[]) : []
  } catch {
    return []
  }
}

async function writeAll(entries: WatchEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // Storage failures are not worth crashing a watchlist over.
  }
}

/** Headline numbers for a college right now, for the chosen category and course. */
export function snapshotOf(
  slug: string,
  category: Category = "UR",
  course?: Course,
): WatchSnapshot | null {
  const detail = collegeDetail(slug)
  if (!detail) return null

  const rows = detail.latest.filter(
    (c) => c.category === category && (!course || c.course === course),
  )
  const head = rows.sort((a, b) => a.closing - b.closing)[0]
  if (!head) return null

  return {
    year: head.year,
    category: head.category,
    course: head.course,
    quota: head.quota,
    closing: head.closing,
    seats: detail.seatsFor(head.category, head.course),
  }
}

export async function listWatches(): Promise<WatchStatus[]> {
  const entries = await readAll()
  const out: WatchStatus[] = []

  const now = Date.now()

  for (const entry of entries) {
    const college = collegeBySlug(entry.slug)
    if (!college) continue

    const billing = billingOf(entry, now)
    const expired = isExpired(billing, now)

    // An expired watch keeps the figures it had when it lapsed rather than
    // silently refreshing them — it is not being tracked, and showing today's
    // numbers would say otherwise.
    const current = expired
      ? entry.snapshot
      : snapshotOf(entry.slug, entry.snapshot?.category ?? "UR", entry.snapshot?.course)
    const change =
      current && entry.snapshot ? current.closing - entry.snapshot.closing : null

    out.push({
      entry,
      college,
      current,
      change,
      expired,
      daysLeft: daysRemaining(billing, now),
      nowReachable: Boolean(
        !expired &&
          entry.rank &&
          current &&
          entry.snapshot &&
          entry.snapshot.closing < entry.rank &&
          current.closing >= entry.rank,
      ),
    })
  }

  return out.sort((a, b) => b.entry.addedAt - a.entry.addedAt)
}

export async function isWatched(slug: string): Promise<boolean> {
  return (await readAll()).some((e) => e.slug === slug)
}

export async function addWatch(
  slug: string,
  category: Category = "UR",
  course?: Course,
  rank?: number | null,
): Promise<void> {
  const entries = await readAll()
  if (entries.some((e) => e.slug === slug)) return
  const now = Date.now()
  entries.push({
    slug,
    addedAt: now,
    rank: rank ?? null,
    snapshot: snapshotOf(slug, category, course),
    ...startBilling(now),
  })
  await writeAll(entries)
}

/** Charges credits. Returns false when the balance could not cover it. */
type ChargeFn = (
  amount: number,
  idempotencyKey: string,
  meta: Record<string, string | number>,
) => Promise<boolean>

export interface RenewalResult {
  renewed: string[]
  /** Due, but the balance could not cover it. Kept, no longer tracked. */
  lapsed: string[]
}

/**
 * Charges every watch whose week has run out.
 *
 * Called when the watchlist and dashboard come into focus rather than on a
 * timer: there is no server, so "weekly" can only mean "the next time you open
 * the app after the week ended". A user who never opens the app is never
 * charged, which is the right way round.
 *
 * At most one week is charged per college per pass — see renew() for why a gap
 * is not billed.
 */
export async function renewDueWatches(charge: ChargeFn): Promise<RenewalResult> {
  const entries = await readAll()
  const now = Date.now()
  const result: RenewalResult = { renewed: [], lapsed: [] }
  let dirty = false

  for (const entry of entries) {
    const billing = billingOf(entry, now)
    if (!isExpired(billing, now)) continue

    const next = renew(billing, now)
    const ok = await charge(PRICE.watchlist, periodKey(entry.slug, next.periods), {
      slug: entry.slug,
      week: next.periods,
    })
    if (!ok) {
      result.lapsed.push(entry.slug)
      continue
    }
    entry.paidThrough = next.paidThrough
    entry.periods = next.periods
    result.renewed.push(entry.slug)
    dirty = true
  }

  if (dirty) await writeAll(entries)
  return result
}

/**
 * Renews one college on demand, for the button on a lapsed row. Same charge and
 * same key as the automatic pass, so tapping it during a renewal cannot bill
 * the week twice.
 */
export async function renewWatch(slug: string, charge: ChargeFn): Promise<boolean> {
  const entries = await readAll()
  const entry = entries.find((e) => e.slug === slug)
  if (!entry) return false

  const now = Date.now()
  const next = renew(billingOf(entry, now), now)
  const ok = await charge(PRICE.watchlist, periodKey(slug, next.periods), {
    slug,
    week: next.periods,
  })
  if (!ok) return false

  entry.paidThrough = next.paidThrough
  entry.periods = next.periods
  await writeAll(entries)
  return true
}

export async function removeWatch(slug: string): Promise<void> {
  await writeAll((await readAll()).filter((e) => e.slug !== slug))
}

export async function toggleWatch(
  slug: string,
  category: Category = "UR",
  course?: Course,
  rank?: number | null,
): Promise<boolean> {
  if (await isWatched(slug)) {
    await removeWatch(slug)
    return false
  }
  await addWatch(slug, category, course, rank)
  return true
}

export const WATCHLIST_YEAR = LATEST_CUTOFF_YEAR
