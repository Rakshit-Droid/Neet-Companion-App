/**
 * Referrals.
 *
 * One rule shapes every decision in this file: a referrer is paid only after the
 * friend they brought in actually spends money. Signups are free to manufacture —
 * one person with a spare email address could mint credits all afternoon — so
 * attribution is recorded at signup but the payout waits for a real purchase and
 * fires exactly once per referee.
 *
 * Like credits.ts this runs on the device today, with `ReferralStore` as the seam
 * a server replaces. That matters most for the code -> uid index: it can only
 * resolve codes the store has seen, so referrals across two installs start
 * working when that store becomes shared, without any caller changing.
 */

import {
  CREDITS_PER_PACK,
  PACK_PRICE_INR,
  REFERRAL_REWARD,
  grant,
} from "./credits"

/**
 * The terms live here, not in a component, because they are a promise about what
 * this module does. If the payout rule changes, this text has to change with it.
 */
export const REFERRAL_HEADLINE = `Refer a friend, get ${REFERRAL_REWARD} credits`

export const REFERRAL_TERMS: readonly string[] = [
  `Your friend signs up with your code, then buys a ${CREDITS_PER_PACK}-credit pack for ₹${PACK_PRICE_INR}.`,
  `You get ${REFERRAL_REWARD} credits when that first purchase goes through.`,
  "A signup on its own earns nothing — the purchase is what pays out.",
  "Each friend pays out once, on their first pack. Later packs earn nothing.",
  "A friend counts for one referrer only, and you cannot refer yourself.",
]

/** No O, 0, I or 1: this code gets read off one screen and typed into another. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

export const REFERRAL_CODE_LENGTH = 8

/** FNV-1a, hand-rolled because node:crypto does not exist in React Native. */
function fnv1a(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

/** Low `chars` * 5 bits of `hash`, one alphabet symbol at a time. */
function encode(hash: number, chars: number): string {
  let out = ""
  let v = hash >>> 0
  for (let i = 0; i < chars; i++) {
    out = ALPHABET.charAt(v & 31) + out
    v >>>= 5
  }
  return out
}

/**
 * Deterministic, so an account's code can be rendered without reading anything
 * and never changes under the user. Two independently seeded hashes give 40 bits,
 * far more than this app will ever need to stay collision-free; claimReferralCode
 * handles the remaining case rather than trusting the odds.
 */
export function referralCodeFor(uid: string): string {
  // The prefix on the second pass is what makes the halves independent; hashing
  // the same string twice would only repeat the first four characters.
  return encode(fnv1a(uid), 4) + encode(fnv1a(`ref:${uid}`), 4)
}

/**
 * Accepts what people actually type: lower case, spaces, dashes. No lookalike
 * remapping, because the alphabet has no lookalike pairs left to resolve.
 */
export function normaliseReferralCode(raw: string): string {
  return Array.from(raw.toUpperCase())
    .filter((c) => ALPHABET.includes(c))
    .join("")
}

export interface Referral {
  refereeUid: string
  referrerUid: string
  /** The code as resolved, kept so a support question has an answer. */
  code: string
  referredAt: number
  /** Stamped when the referrer is paid. Non-null is what makes payout once-only. */
  settledAt: number | null
}

export interface ReferralState {
  /** Referral code -> the uid that owns it. */
  owners: Record<string, string>
  /** Referee uid -> their one and only attribution. */
  referrals: Record<string, Referral>
}

/** The seam a server replaces. Global rather than per-user: codes are an index. */
export interface ReferralStore {
  read(): Promise<ReferralState>
  write(state: ReferralState): Promise<void>
}

/**
 * In-memory by default so this module stays importable in plain node for tests.
 * referrals-store.ts supplies the AsyncStorage-backed one at startup.
 */
function memoryReferrals(): ReferralStore {
  let state: ReferralState = { owners: {}, referrals: {} }
  return {
    async read() {
      return state
    },
    async write(next) {
      state = next
    },
  }
}

let store: ReferralStore = memoryReferrals()

export function setReferralStore(next: ReferralStore): void {
  store = next
}

/** Test-only: drops every code and attribution. */
export function __resetReferralsForTests(): void {
  store = memoryReferrals()
}

/**
 * The code to show this user. Idempotent: once an account owns a code it keeps
 * that one, so a change to the derivation cannot move a user's code out from
 * under a share link they already sent.
 */
export async function claimReferralCode(uid: string): Promise<string> {
  const state = await store.read()

  const owned = Object.keys(state.owners).find((c) => state.owners[c] === uid)
  if (owned) return owned

  // Salt and re-derive on a collision. Letting two accounts share a code would
  // silently pay the wrong person, which is worse than an unexpected code.
  let code = referralCodeFor(uid)
  for (let salt = 1; state.owners[code] !== undefined; salt++) {
    code = referralCodeFor(`${uid}#${salt}`)
  }

  await store.write({ ...state, owners: { ...state.owners, [code]: uid } })
  return code
}

export async function resolveReferralCode(raw: string): Promise<string | null> {
  const code = normaliseReferralCode(raw)
  if (!code) return null
  return (await store.read()).owners[code] ?? null
}

export type ReferralAttempt =
  | { status: "recorded"; referral: Referral }
  | { status: "alreadyReferred"; referral: Referral }
  | { status: "unknownCode" }
  | { status: "selfReferral" }

/**
 * Attribute a new account to whoever's code it arrived with. Called once, at
 * signup. Nothing is paid here — that is settleReferralOnPurchase's job.
 */
export async function recordReferral(
  refereeUid: string,
  raw: string,
): Promise<ReferralAttempt> {
  const state = await store.read()

  // Written once and never rewritten, so a referee cannot be re-attributed to a
  // second referrer — including after the first one has already been paid.
  const existing = state.referrals[refereeUid]
  if (existing) return { status: "alreadyReferred", referral: existing }

  const code = normaliseReferralCode(raw)
  const referrerUid = state.owners[code]
  if (!referrerUid) return { status: "unknownCode" }
  if (referrerUid === refereeUid) return { status: "selfReferral" }

  const referral: Referral = {
    refereeUid,
    referrerUid,
    code,
    referredAt: Date.now(),
    settledAt: null,
  }
  await store.write({
    ...state,
    referrals: { ...state.referrals, [refereeUid]: referral },
  })
  return { status: "recorded", referral }
}

export type Settlement =
  | { status: "paid"; referral: Referral; credits: number }
  | { status: "alreadySettled"; referral: Referral }
  | { status: "noReferral" }

/**
 * Call once a purchase has cleared. Only the referee's first paid pack pays out:
 * settledAt is stamped here, so every later purchase falls straight through to
 * alreadySettled and the referrer earns nothing more from that friend.
 *
 * KNOWN LIMIT, resolved when this moves server-side: the ledger's idempotency
 * key is scoped per user, so it stops the same referrer being paid twice but not
 * two different referrers being paid for the same friend. That needs the
 * attribution in this store to be lost while the ledger survives — a corrupt
 * referrals blob, say — after which the friend could be re-attributed and a
 * second referrer paid. One shared transactional store removes the failure mode
 * entirely; until then attribution is written once and never rewritten, which
 * closes every path that does not involve losing the store.
 */
export async function settleReferralOnPurchase(
  refereeUid: string,
): Promise<Settlement> {
  const state = await store.read()

  const referral = state.referrals[refereeUid]
  if (!referral) return { status: "noReferral" }
  if (referral.settledAt !== null) return { status: "alreadySettled", referral }

  // Grant first, mark second. If the mark fails the retry re-grants and the
  // ledger's idempotency key absorbs it; marking first would strand the payout
  // with no way to ever retry it. The same key is why two callers racing this
  // still produce exactly one ledger entry.
  const payout = await grant(
    referral.referrerUid,
    REFERRAL_REWARD,
    "referral",
    `referral:${refereeUid}`,
    { refereeUid, code: referral.code },
  )

  const settled: Referral = { ...referral, settledAt: Date.now() }
  const latest = await store.read()
  await store.write({
    ...latest,
    referrals: { ...latest.referrals, [refereeUid]: settled },
  })

  // The ledger, not this function, is the authority on whether credits actually
  // moved. Five callers racing here all read settledAt as null and all reach the
  // grant, but only the first writes an entry; the rest come back replayed.
  // Reporting "paid" to all five would show the referrer five payout messages
  // for one payout.
  if (payout.replayed) return { status: "alreadySettled", referral: settled }

  return { status: "paid", referral: settled, credits: REFERRAL_REWARD }
}

/** Who referred this user, if anyone. */
export async function referralFor(refereeUid: string): Promise<Referral | null> {
  return (await store.read()).referrals[refereeUid] ?? null
}

/** The friends this user brought in, newest first. */
export async function referralsBy(referrerUid: string): Promise<Referral[]> {
  const state = await store.read()
  // Timestamps tie whenever two friends are recorded in the same millisecond,
  // and a tie left to sort order would list the newer one last. Insertion order
  // of the record breaks it.
  return Object.values(state.referrals)
    .map((referral, index) => ({ referral, index }))
    .filter((x) => x.referral.referrerUid === referrerUid)
    .sort((a, b) => b.referral.referredAt - a.referral.referredAt || b.index - a.index)
    .map((x) => x.referral)
}
