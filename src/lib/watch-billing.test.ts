import { test } from "node:test"
import assert from "node:assert/strict"

import {
  WATCH_PERIOD_MS,
  billingOf,
  daysRemaining,
  isExpired,
  periodKey,
  renew,
  startBilling,
  weeksRemaining,
} from "./watch-billing"

const T0 = 1_700_000_000_000
const DAY = 24 * 60 * 60 * 1000

test("a new watch is paid for exactly one week", () => {
  const b = startBilling(T0)
  assert.equal(b.paidThrough, T0 + WATCH_PERIOD_MS)
  assert.equal(b.periods, 1)
  assert.equal(isExpired(b, T0), false)
  assert.equal(isExpired(b, T0 + WATCH_PERIOD_MS - 1), false)
})

test("it expires the instant the week runs out, not a moment before", () => {
  const b = startBilling(T0)
  assert.equal(isExpired(b, T0 + WATCH_PERIOD_MS - 1), false)
  assert.equal(isExpired(b, T0 + WATCH_PERIOD_MS), true)
  assert.equal(isExpired(b, T0 + WATCH_PERIOD_MS + DAY), true)
})

test("a gap is never billed: coming back after a month owes one week, not four", () => {
  const b = startBilling(T0)
  const away = T0 + 30 * DAY
  const next = renew(b, away)

  assert.equal(next.periods, 2, "one week charged, not four")
  assert.equal(next.paidThrough, away + WATCH_PERIOD_MS, "the week runs from the return")
  assert.equal(isExpired(next, away), false)
})

test("periods only ever advance by one, so the key cannot reuse a paid week", () => {
  let b = startBilling(T0)
  const keys = new Set([periodKey("c", b.periods)])

  for (let i = 1; i <= 6; i++) {
    b = renew(b, T0 + i * WATCH_PERIOD_MS)
    const k = periodKey("c", b.periods)
    assert.equal(keys.has(k), false, `week ${i} reused an earlier idempotency key`)
    keys.add(k)
  }
  assert.equal(b.periods, 7)
})

test("keys separate colleges and weeks", () => {
  assert.notEqual(periodKey("c", 1), periodKey("d", 1))
  assert.notEqual(periodKey("c", 1), periodKey("c", 2))
  assert.equal(periodKey("c", 1), periodKey("c", 1), "the same week is the same key")
})

test("a watch saved before billing existed gets a free week, not a backdated charge", () => {
  // Added under the old one-off price, so it carries no billing record.
  const legacy = billingOf({}, T0)
  assert.equal(legacy.paidThrough, T0 + WATCH_PERIOD_MS)
  assert.equal(legacy.periods, 0, "nothing has been charged for it yet")
  assert.equal(isExpired(legacy, T0), false)
})

test("a corrupt billing record is treated as legacy rather than trusted", () => {
  for (const bad of [{ paidThrough: NaN }, { paidThrough: Infinity }]) {
    const b = billingOf(bad, T0)
    assert.equal(Number.isFinite(b.paidThrough), true)
    assert.equal(isExpired(b, T0), false)
  }
})

test("remaining time counts down and never goes negative", () => {
  const b = startBilling(T0)
  assert.equal(weeksRemaining(b, T0), 1)
  assert.equal(weeksRemaining(b, T0 + DAY), 0)
  assert.equal(weeksRemaining(b, T0 + 30 * DAY), 0, "expired never reads as negative weeks")

  assert.equal(daysRemaining(b, T0), 7)
  assert.equal(daysRemaining(b, T0 + 6 * DAY), 1, "the last day must not read as 0")
  assert.equal(daysRemaining(b, T0 + 30 * DAY), 0)
})
