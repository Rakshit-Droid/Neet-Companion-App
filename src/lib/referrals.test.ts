import test, { beforeEach } from "node:test"
import assert from "node:assert/strict"

import {
  REFERRAL_REWARD,
  __resetLedgerForTests,
  getBalance,
  readLedger,
} from "./credits"
import {
  REFERRAL_CODE_LENGTH,
  __resetReferralsForTests,
  claimReferralCode,
  recordReferral,
  referralCodeFor,
  referralFor,
  referralsBy,
  resolveReferralCode,
  setReferralStore,
  settleReferralOnPurchase,
  type ReferralState,
  type ReferralStore,
} from "./referrals"

beforeEach(() => {
  __resetLedgerForTests()
  __resetReferralsForTests()
})

/** alice owns a code and bob signed up with it — the setup every payout test needs. */
async function aliceRefersBob(): Promise<void> {
  const code = await claimReferralCode("alice")
  assert.equal((await recordReferral("bob", code)).status, "recorded")
}

function seeded(state: ReferralState): ReferralStore {
  let current = state
  return {
    async read() {
      return current
    },
    async write(next) {
      current = next
    },
  }
}

test("codes are stable and carry no ambiguous characters", () => {
  const code = referralCodeFor("alice")
  assert.equal(referralCodeFor("alice"), code)
  assert.equal(code.length, REFERRAL_CODE_LENGTH)
  // No 0, 1, I or O anywhere in the class.
  assert.match(code, /^[2-9A-HJ-NP-Z]+$/)
})

test("different accounts get different codes", () => {
  const codes = new Set(
    Array.from({ length: 500 }, (_, i) => referralCodeFor(`uid-${i}`)),
  )
  assert.equal(codes.size, 500)
})

test("a claimed code resolves back to its owner, however it was typed", async () => {
  const code = await claimReferralCode("alice")

  assert.equal(await resolveReferralCode(code), "alice")
  assert.equal(await resolveReferralCode(code.toLowerCase()), "alice")
  assert.equal(
    await resolveReferralCode(` ${code.slice(0, 4)}-${code.slice(4)} `),
    "alice",
  )
  assert.equal(await resolveReferralCode(""), null)
})

test("claiming twice keeps the same code", async () => {
  assert.equal(await claimReferralCode("alice"), await claimReferralCode("alice"))
})

test("one code is never handed to two accounts", async () => {
  const wanted = referralCodeFor("bob")
  setReferralStore(seeded({ owners: { [wanted]: "alice" }, referrals: {} }))

  const bobs = await claimReferralCode("bob")
  assert.notEqual(bobs, wanted)
  assert.equal(await resolveReferralCode(bobs), "bob")
  assert.equal(await resolveReferralCode(wanted), "alice")
})

test("an unknown code attributes nobody", async () => {
  assert.equal((await recordReferral("bob", "ZZZZZZZZ")).status, "unknownCode")
  assert.equal(await referralFor("bob"), null)
})

test("self-referral is rejected and pays nothing", async () => {
  const code = await claimReferralCode("alice")

  assert.equal((await recordReferral("alice", code)).status, "selfReferral")
  assert.equal(await referralFor("alice"), null)

  assert.equal((await settleReferralOnPurchase("alice")).status, "noReferral")
  assert.equal(await getBalance("alice"), 0)
})

test("a referee is attributed to one referrer and never moved", async () => {
  await aliceRefersBob()
  const carolCode = await claimReferralCode("carol")

  assert.equal((await recordReferral("bob", carolCode)).status, "alreadyReferred")
  assert.equal((await referralFor("bob"))?.referrerUid, "alice")

  await settleReferralOnPurchase("bob")
  assert.equal(await getBalance("carol"), 0)
  assert.equal(await getBalance("alice"), REFERRAL_REWARD)
})

test("a signup on its own pays the referrer nothing", async () => {
  await aliceRefersBob()

  assert.equal(await getBalance("alice"), 0)
  assert.equal((await readLedger("alice")).length, 0)
})

test("the first purchase writes exactly one referral entry", async () => {
  await aliceRefersBob()

  const result = await settleReferralOnPurchase("bob")
  assert.equal(result.status, "paid")
  assert.equal((await referralFor("bob"))?.settledAt !== null, true)

  const entries = await readLedger("alice")
  assert.equal(entries.length, 1)
  const [entry] = entries
  assert.equal(entry?.reason, "referral")
  assert.equal(entry?.delta, REFERRAL_REWARD)
  assert.equal(await getBalance("alice"), REFERRAL_REWARD)
})

test("later purchases by the same friend pay nothing extra", async () => {
  await aliceRefersBob()
  await settleReferralOnPurchase("bob")

  for (let i = 0; i < 4; i++) {
    assert.equal((await settleReferralOnPurchase("bob")).status, "alreadySettled")
  }

  assert.equal((await readLedger("alice")).length, 1)
  assert.equal(await getBalance("alice"), REFERRAL_REWARD)
})

test("settlement racing itself still pays once", async () => {
  await aliceRefersBob()

  await Promise.all(
    Array.from({ length: 5 }, () => settleReferralOnPurchase("bob")),
  )

  assert.equal((await readLedger("alice")).length, 1)
  assert.equal(await getBalance("alice"), REFERRAL_REWARD)
})

test("settling a friend nobody referred pays nobody", async () => {
  assert.equal((await settleReferralOnPurchase("bob")).status, "noReferral")
  assert.equal((await readLedger("bob")).length, 0)
})

test("a referrer can list the friends they brought in", async () => {
  const code = await claimReferralCode("alice")
  await recordReferral("bob", code)
  await recordReferral("dev", code)
  await settleReferralOnPurchase("bob")

  const brought = await referralsBy("alice")
  assert.deepEqual(
    brought.map((r) => r.refereeUid).sort(),
    ["bob", "dev"],
  )
  assert.equal(brought.filter((r) => r.settledAt !== null).length, 1)
})

// -- regressions --------------------------------------------------------------

test("racing settlements pay once and only one caller is told it was paid", async () => {
  const code = await claimReferralCode("alice")
  await recordReferral("bob", code)

  // All five read settledAt as null before any of them writes, so all five
  // reach the grant. Only the ledger can say which one actually moved credits.
  const results = await Promise.all(
    Array.from({ length: 5 }, () => settleReferralOnPurchase("bob")),
  )

  assert.equal(results.filter((r) => r.status === "paid").length, 1)
  assert.equal(await getBalance("alice"), REFERRAL_REWARD)
  assert.equal((await readLedger("alice")).length, 1)
})

test("friends recorded in the same millisecond still list newest first", async () => {
  const code = await claimReferralCode("alice")
  await recordReferral("bob", code)
  await recordReferral("dev", code)
  await recordReferral("erin", code)

  const list = await referralsBy("alice")
  assert.deepEqual(
    list.map((r) => r.refereeUid),
    ["erin", "dev", "bob"],
  )
})
