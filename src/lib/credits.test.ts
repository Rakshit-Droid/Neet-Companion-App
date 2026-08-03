import { beforeEach, test } from "node:test"
import assert from "node:assert/strict"

import {
  CREDITS_PER_PACK,
  InsufficientCreditsError,
  PACK_PRICE_INR,
  PRICE,
  REFERRAL_REWARD,
  SIGNUP_GRANT,
  __resetLedgerForTests,
  balanceOf,
  getBalance,
  grant,
  grantSignupCredits,
  readLedger,
  setLedgerStore,
  spend,
  type LedgerEntry,
  type LedgerStore,
} from "./credits"

/**
 * This is money. Every test here is written to break the ledger, not to confirm
 * it works: overdraw it, double-charge it, race it, poison it with junk input.
 * Two tests are named BUG — they fail today and describe defects in credits.ts.
 */

const UID = "uid-1"

/**
 * A store with a real await between read and write. That gap is the window a
 * read-modify-write races in, so concurrency tests must run against this rather
 * than the built-in memory store, whose reads resolve too fast to interleave.
 * `stored` exposes the raw append order, which readLedger deliberately hides.
 */
function testStore(latencyMs = 0) {
  const rows = new Map<string, LedgerEntry[]>()
  let writes = 0
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, latencyMs))

  const store: LedgerStore = {
    async read(uid) {
      await tick()
      return rows.get(uid) ?? []
    },
    async write(uid, entries) {
      await tick()
      writes += 1
      rows.set(uid, entries)
    },
  }

  return {
    store,
    stored: (uid: string): LedgerEntry[] => rows.get(uid) ?? [],
    writeCount: () => writes,
  }
}

/** Pins Date.now so createdAt is chosen by the test, not by the clock. */
async function at<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  const real = Date.now
  Date.now = () => ms
  try {
    return await fn()
  } finally {
    Date.now = real
  }
}

beforeEach(() => {
  __resetLedgerForTests()
})

test("the money constants are the ones the pricing screen sells", () => {
  // watchlist is per college PER WEEK and renews; the others are one-offs.
  assert.deepEqual(PRICE, { search: 2, watchlist: 5, stateQuota: 5 })
  assert.equal(SIGNUP_GRANT, 10)
  assert.equal(CREDITS_PER_PACK, 50)
  assert.equal(PACK_PRICE_INR, 100)
  assert.equal(REFERRAL_REWARD, 50)
  // 100 INR buys 50 credits, so a credit is 2 INR: a search costs 4 and a week
  // of watching one college costs 10.
  assert.equal(PACK_PRICE_INR / CREDITS_PER_PACK, 2)
  assert.equal(PRICE.search * 2, 4)
  assert.equal(PRICE.watchlist * 2, 10)
})

test("balance is the sum of the deltas and nothing else", async () => {
  assert.equal(balanceOf([]), 0)
  assert.equal(await getBalance("never-seen"), 0)

  await grantSignupCredits(UID)
  await spend(UID, PRICE.search, "search", "s1")
  await spend(UID, PRICE.watchlist, "watchlist", "w1")
  await grant(UID, CREDITS_PER_PACK, "purchase", "pack-1")

  const entries = await readLedger(UID)
  assert.equal(
    await getBalance(UID),
    SIGNUP_GRANT - PRICE.search - PRICE.watchlist + CREDITS_PER_PACK,
  )
  assert.equal(await getBalance(UID), balanceOf(entries))
})

test("grantSignupCredits is idempotent across relaunches", async () => {
  const first = await grantSignupCredits(UID)
  const second = await grantSignupCredits(UID)
  const third = await grantSignupCredits(UID)

  assert.equal(await getBalance(UID), SIGNUP_GRANT)
  assert.equal((await readLedger(UID)).length, 1)
  assert.equal(first.replayed, false)
  assert.equal(second.replayed, true)
  assert.equal(third.replayed, true)
  assert.equal(second.entry?.id, first.entry?.id)
})

test("an overdraft throws and writes nothing at all", async () => {
  const { store, stored, writeCount } = testStore()
  setLedgerStore(store)

  await grant(UID, 3, "purchase", "top-up")
  const writesBefore = writeCount()

  await assert.rejects(spend(UID, 5, "stateQuota", "too-big"), (err: unknown) => {
    assert.ok(err instanceof InsufficientCreditsError)
    assert.equal(err.needed, 5)
    assert.equal(err.balance, 3)
    return true
  })

  // Not just "no entry appeared" — the store must not have been touched, or a
  // Firestore transaction would burn a write and a retry would double-apply.
  assert.equal(writeCount(), writesBefore)
  assert.equal(stored(UID).length, 1)
  assert.equal(await getBalance(UID), 3)
})

test("spending down to exactly zero is allowed; zero is not an error", async () => {
  await grant(UID, SIGNUP_GRANT, "signup", "welcome")

  const result = await spend(UID, PRICE.stateQuota, "stateQuota", "sq1")
  assert.equal(result.balance, 5)

  const drained = await spend(UID, PRICE.stateQuota, "stateQuota", "sq2")
  assert.equal(drained.balance, 0)
  assert.equal(drained.entry?.balanceAfter, 0)
  assert.equal(await getBalance(UID), 0)

  // One credit past empty is where it must stop.
  await assert.rejects(
    spend(UID, PRICE.watchlist, "watchlist", "w1"),
    InsufficientCreditsError,
  )
  assert.equal((await readLedger(UID)).length, 3)
})

test("replaying an idempotency key returns the original entry untouched", async () => {
  await grant(UID, SIGNUP_GRANT, "signup", "welcome")

  const first = await spend(UID, PRICE.search, "search", "search:abc")
  const replay = await spend(UID, PRICE.search, "search", "search:abc")

  assert.equal(replay.replayed, true)
  assert.deepEqual(replay.entry, first.entry)
  assert.equal(replay.entry?.createdAt, first.entry?.createdAt)
  assert.equal(await getBalance(UID), 8)
  assert.equal((await readLedger(UID)).length, 2)

  // The key wins over the arguments: a caller that reuses a key with a bigger
  // amount is silently not charged. Callers must namespace their keys.
  const collision = await spend(UID, 500, "stateQuota", "search:abc")
  assert.equal(collision.replayed, true)
  assert.equal(collision.entry?.delta, -PRICE.search)
  assert.equal(await getBalance(UID), 8)
})

test("concurrent spends cannot overdraw a balance that covers only some", async () => {
  const { store, stored } = testStore(1)
  setLedgerStore(store)

  await grant(UID, 10, "purchase", "top-up")

  // Ten searches fired in one go against a balance that pays for exactly five.
  const settled = await Promise.allSettled(
    Array.from({ length: 10 }, (_, i) =>
      spend(UID, PRICE.search, "search", `search-${i}`),
    ),
  )

  const done = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
  const failed: unknown[] = settled.flatMap((r) =>
    r.status === "rejected" ? [r.reason] : [],
  )

  assert.equal(done.length, 5)
  assert.equal(failed.length, 5)
  for (const err of failed) assert.ok(err instanceof InsufficientCreditsError)

  // First come first served, one at a time: the queue must hand out 8,6,4,2,0
  // and then refuse, never two callers reading the same balance.
  assert.deepEqual(
    done.map((r) => r.balance),
    [8, 6, 4, 2, 0],
  )
  assert.deepEqual(
    done.map((r) => r.entry?.idempotencyKey),
    ["search-0", "search-1", "search-2", "search-3", "search-4"],
  )

  assert.equal(await getBalance(UID), 0)
  assert.equal(stored(UID).length, 6)
  for (const e of stored(UID)) {
    assert.ok(e.balanceAfter >= 0, `balance went negative at ${e.idempotencyKey}`)
  }
})

test("an odd balance leaves the remainder, not a negative", async () => {
  const { store } = testStore(1)
  setLedgerStore(store)

  await grant(UID, 7, "purchase", "top-up")
  const settled = await Promise.allSettled(
    Array.from({ length: 10 }, (_, i) =>
      spend(UID, PRICE.search, "search", `search-${i}`),
    ),
  )

  assert.equal(settled.filter((r) => r.status === "fulfilled").length, 3)
  assert.equal(await getBalance(UID), 1)
})

test("the same key fired concurrently is charged once", async () => {
  const { store } = testStore(1)
  setLedgerStore(store)

  await grant(UID, 10, "purchase", "top-up")

  // A double-tapped button, or a screen remounting mid-flight.
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      spend(UID, PRICE.search, "search", "search:same"),
    ),
  )

  assert.equal(results.filter((r) => r.replayed).length, 4)
  assert.equal(await getBalance(UID), 8)
  assert.equal((await readLedger(UID)).length, 2)
})

test("one user's spending never touches another's balance", async () => {
  const { store } = testStore(1)
  setLedgerStore(store)

  await Promise.all([
    grant("a", 10, "purchase", "top-up-a"),
    grant("b", 10, "purchase", "top-up-b"),
  ])

  await Promise.allSettled([
    ...Array.from({ length: 8 }, (_, i) => spend("a", PRICE.search, "search", `a-${i}`)),
    spend("b", PRICE.watchlist, "watchlist", "b-0"),
  ])

  assert.equal(await getBalance("a"), 0)
  assert.equal(await getBalance("b"), 10 - PRICE.watchlist)
  assert.equal((await readLedger("b")).length, 2)
})

test("a rejected mutation does not wedge the per-uid queue", async () => {
  const { store } = testStore(1)
  setLedgerStore(store)

  await grant(UID, 1, "purchase", "seed")

  // The failing spend is queued ahead of the grant; if its rejection broke the
  // chain the grant would hang forever and the account screen would spin.
  const [bad, good] = await Promise.allSettled([
    spend(UID, 99, "stateQuota", "boom"),
    grant(UID, 5, "purchase", "after"),
  ])

  assert.equal(bad?.status, "rejected")
  assert.equal(good?.status, "fulfilled")
  assert.equal(await getBalance(UID), 6)
})

test("every entry's balanceAfter equals the running sum up to it", async () => {
  const { store, stored } = testStore()
  setLedgerStore(store)

  await grantSignupCredits(UID)
  await spend(UID, PRICE.search, "search", "s1")
  await grant(UID, CREDITS_PER_PACK, "purchase", "pack-1")
  await spend(UID, PRICE.stateQuota, "stateQuota", "sq1")
  await spend(UID, PRICE.watchlist, "watchlist", "w1")
  await grant(UID, REFERRAL_REWARD, "referral", "ref-1")

  let running = 0
  for (const e of stored(UID)) {
    running += e.delta
    assert.equal(e.balanceAfter, running, `balanceAfter drifted at ${e.idempotencyKey}`)
  }
  assert.equal(running, await getBalance(UID))

  const ids = new Set(stored(UID).map((e) => e.id))
  assert.equal(ids.size, stored(UID).length, "duplicate entry ids")
})

test("zero and negative amounts are rejected as programmer errors", async () => {
  await grant(UID, 10, "purchase", "top-up")

  // Thrown synchronously rather than rejected, so this is assert.throws and a
  // caller that only attaches .catch() will crash instead of seeing the error.
  assert.throws(() => spend(UID, 0, "search", "zero"), /must be positive/)
  assert.throws(() => spend(UID, -5, "search", "negative"), /must be positive/)
  assert.throws(() => grant(UID, 0, "purchase", "zero-grant"), /must be positive/)
  assert.throws(() => grant(UID, -5, "purchase", "negative-grant"), /must be positive/)

  // A negative spend must not be a backdoor grant.
  assert.equal(await getBalance(UID), 10)
  assert.equal((await readLedger(UID)).length, 1)
})

test("readLedger is newest first and leaves the stored order alone", async () => {
  const { store, stored } = testStore()
  setLedgerStore(store)

  await at(1_000, () => grant(UID, SIGNUP_GRANT, "signup", "a"))
  await at(2_000, () => spend(UID, PRICE.watchlist, "watchlist", "b"))
  await at(3_000, () => spend(UID, PRICE.search, "search", "c"))

  const shown = await readLedger(UID)
  assert.deepEqual(
    shown.map((e) => e.idempotencyKey),
    ["c", "b", "a"],
  )

  // The ledger is append-only; sorting for display must not reorder storage,
  // and the array handed to the caller must be a copy they can sort at will.
  shown.reverse()
  assert.deepEqual(
    stored(UID).map((e) => e.idempotencyKey),
    ["a", "b", "c"],
  )
  assert.deepEqual(
    (await readLedger(UID)).map((e) => e.idempotencyKey),
    ["c", "b", "a"],
  )
})

test("BUG: a non-finite amount is accepted and kills the overdraft guard", async () => {
  await grant(UID, 10, "purchase", "top-up")

  try {
    // NaN survives `amount <= 0`, and inside mutate `NaN < 0` is false, so both
    // the sign check and the overdraft check wave it through.
    await spend(UID, Number.NaN, "search", "nan")
  } catch {
    // Refusing it is the correct behaviour; the assertions below check that.
  }

  assert.equal(
    await getBalance(UID),
    10,
    "a NaN entry was written: the balance is now NaN forever",
  )

  // With a NaN balance every later comparison is false, so this must not pass.
  await assert.rejects(
    spend(UID, 1_000_000, "stateQuota", "free-lunch"),
    InsufficientCreditsError,
    "overdraft guard is dead: a poisoned balance buys anything for nothing",
  )
})

test("BUG: entries written in the same millisecond come back oldest first", async () => {
  const { store } = testStore()
  setLedgerStore(store)

  // createdAt is stamped with Date.now(), so two mutations in one tick tie, and
  // Array#sort is stable — the tie keeps append order, which is the reverse of
  // what readLedger promises. Signup plus a referral bonus does exactly this.
  await at(1_000, async () => {
    await grant(UID, SIGNUP_GRANT, "signup", "welcome")
    await grant(UID, REFERRAL_REWARD, "referral", "ref-1")
  })

  const shown = await readLedger(UID)
  assert.equal(
    shown[0]?.idempotencyKey,
    "ref-1",
    "same-millisecond entries need a tiebreak; the newest is listed last",
  )
})
