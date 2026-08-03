/**
 * Billing periods for a watched college.
 *
 * Watching costs PRICE.watchlist credits per college per week and renews
 * automatically. This module is the period arithmetic only — no storage, no
 * ledger — so the rules that decide whether someone is about to be charged can
 * be tested without a device.
 */

export const WATCH_PERIOD_MS = 7 * 24 * 60 * 60 * 1000

export interface WatchBilling {
  /** Epoch ms the paid week runs until. */
  paidThrough: number
  /** Weeks paid so far. Used as the idempotency suffix, so weeks never collide. */
  periods: number
}

export function startBilling(now: number): WatchBilling {
  return { paidThrough: now + WATCH_PERIOD_MS, periods: 1 }
}

export function isExpired(b: WatchBilling, now: number): boolean {
  return now >= b.paidThrough
}

/**
 * The next paid week runs from now, not from the end of the last one.
 *
 * Someone who does not open the app for a month owes one week when they come
 * back, not four. Billing the gap would mean a user returning to a drained
 * balance for weeks in which they were shown nothing.
 */
export function renew(b: WatchBilling, now: number): WatchBilling {
  return { paidThrough: now + WATCH_PERIOD_MS, periods: b.periods + 1 }
}

/**
 * Idempotency key for one week of one college, so a retry cannot double-charge.
 * No uid: the ledger is already per-user, so uniqueness within a user is enough.
 */
export function periodKey(slug: string, periods: number): string {
  return `watch:${slug}:${periods}`
}

/**
 * Reads billing off an entry that may predate it.
 *
 * Colleges watched under the old one-off price have no billing record. They are
 * given a free week from first sight rather than being charged retroactively or
 * dropped — they were added under terms that did not mention renewal.
 */
export function billingOf(
  entry: { paidThrough?: number; periods?: number },
  now: number,
): WatchBilling {
  if (typeof entry.paidThrough !== "number" || !Number.isFinite(entry.paidThrough)) {
    return { paidThrough: now + WATCH_PERIOD_MS, periods: 0 }
  }
  return {
    paidThrough: entry.paidThrough,
    periods: typeof entry.periods === "number" && entry.periods >= 0 ? entry.periods : 1,
  }
}

/** Whole weeks left, rounded down. 0 means it expires within the day-to-week. */
export function weeksRemaining(b: WatchBilling, now: number): number {
  return Math.max(0, Math.floor((b.paidThrough - now) / WATCH_PERIOD_MS))
}

/** Days left, rounded up, so "1 day left" never displays as 0. */
export function daysRemaining(b: WatchBilling, now: number): number {
  return Math.max(0, Math.ceil((b.paidThrough - now) / (24 * 60 * 60 * 1000)))
}
