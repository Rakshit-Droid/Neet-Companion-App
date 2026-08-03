/**
 * Credit ledger.
 *
 * The ledger is the truth and is append-only; a balance is always the sum of
 * its deltas, never a number stored on its own. That makes every credit a user
 * has traceable to the action that created it, which is the only way to answer
 * "where did my credits go" without guessing.
 *
 * WHERE THIS RUNS: on the device, for now. A determined user can edit
 * AsyncStorage and grant themselves credits. That is accepted deliberately —
 * the whole cutoff dataset already ships inside the app, so there is nothing
 * secret left to protect, and moving spend server-side before there is a server
 * would block every screen behind a network call. `LedgerStore` is the seam:
 * swapping AsyncStorage for a Firestore transaction is a one-file change and
 * does not touch a single caller.
 */

export type LedgerReason =
  | "signup"
  | "purchase"
  | "referral"
  | "search"
  | "watchlist"
  | "stateQuota"
  | "refund"

export interface LedgerEntry {
  id: string
  /** Positive credits in, negative credits out. */
  delta: number
  reason: LedgerReason
  /** Unique per logical action, so a retry is free rather than double-charged. */
  idempotencyKey: string
  balanceAfter: number
  meta?: Record<string, string | number>
  createdAt: number
}

/**
 * Prices, in credits. Single source of truth — never inline these numbers.
 *
 * `watchlist` is charged per college PER WEEK and renews automatically, not once
 * at add time. See src/lib/watch-billing.ts for the period rules.
 */
export const PRICE = {
  search: 2,
  watchlist: 5,
  stateQuota: 5,
} as const

export const SIGNUP_GRANT = 10
export const CREDITS_PER_PACK = 50
export const PACK_PRICE_INR = 100
export const REFERRAL_REWARD = 50

/** Human-readable, used by the ledger list on the account screen. */
export const REASON_LABEL: Record<LedgerReason, string> = {
  signup: "Welcome credits",
  purchase: "Credits purchased",
  referral: "Referral bonus",
  search: "Choice list built",
  watchlist: "Watching a college, one week",
  stateQuota: "State quota search",
  refund: "Refund",
}

export class InsufficientCreditsError extends Error {
  readonly needed: number
  readonly balance: number
  constructor(needed: number, balance: number) {
    super(`Needs ${needed} credits, has ${balance}.`)
    this.name = "InsufficientCreditsError"
    this.needed = needed
    this.balance = balance
  }
}

/** The seam Firestore will replace. Both methods are per-user. */
export interface LedgerStore {
  read(uid: string): Promise<LedgerEntry[]>
  write(uid: string, entries: LedgerEntry[]): Promise<void>
}

/**
 * Default store. Deliberately in-memory: this module must stay importable in
 * plain node so it can be tested, and AsyncStorage is a React Native module
 * that cannot load there. The app swaps in the persistent adapter from
 * credits-store.ts at startup.
 */
function memoryLedger(): LedgerStore {
  const rows = new Map<string, LedgerEntry[]>()
  return {
    async read(uid) {
      return rows.get(uid) ?? []
    },
    async write(uid, entries) {
      rows.set(uid, entries)
    },
  }
}

let store: LedgerStore = memoryLedger()

/** Swap the backend: AsyncStorage today, a Firestore transaction later. */
export function setLedgerStore(next: LedgerStore): void {
  store = next
}

/** Test-only: drops every stored entry and the pending mutation queues. */
export function __resetLedgerForTests(): void {
  store = memoryLedger()
  queues.clear()
}

export function balanceOf(entries: LedgerEntry[]): number {
  return entries.reduce((sum, e) => sum + e.delta, 0)
}

/**
 * Read-modify-write is not atomic here, so every mutation for a user is queued
 * behind the previous one. Without this, two spends racing both read the same
 * balance and the second overdraws.
 */
const queues = new Map<string, Promise<unknown>>()

function serialise<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(uid) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  // Swallow rejections on the queue handle only; the caller still sees them.
  queues.set(
    uid,
    next.catch(() => {}),
  )
  return next
}

let counter = 0

function newId(): string {
  counter += 1
  return `${Date.now().toString(36)}-${counter.toString(36)}`
}

export interface MutationResult {
  balance: number
  entry: LedgerEntry | null
  /** True when the idempotency key had already been used and nothing changed. */
  replayed: boolean
}

async function mutate(
  uid: string,
  delta: number,
  reason: LedgerReason,
  idempotencyKey: string,
  meta?: Record<string, string | number>,
): Promise<MutationResult> {
  // NaN slips past every comparison below — `NaN <= 0` and `NaN < 0` are both
  // false — so it would pass the overdraft guard and poison the balance
  // permanently. A rank field parsed with Number() produces exactly that.
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error(`credit delta must be a non-zero integer, got ${delta}`)
  }

  return serialise(uid, async () => {
    const entries = await store.read(uid)

    const existing = entries.find((e) => e.idempotencyKey === idempotencyKey)
    if (existing) {
      return { balance: balanceOf(entries), entry: existing, replayed: true }
    }

    const balance = balanceOf(entries)
    if (delta < 0 && balance + delta < 0) {
      throw new InsufficientCreditsError(-delta, balance)
    }

    const entry: LedgerEntry = {
      id: newId(),
      delta,
      reason,
      idempotencyKey,
      balanceAfter: balance + delta,
      ...(meta ? { meta } : {}),
      createdAt: Date.now(),
    }
    await store.write(uid, [...entries, entry])
    return { balance: entry.balanceAfter, entry, replayed: false }
  })
}

/** Spend credits. Throws InsufficientCreditsError rather than going negative. */
export function spend(
  uid: string,
  amount: number,
  reason: LedgerReason,
  idempotencyKey: string,
  meta?: Record<string, string | number>,
): Promise<MutationResult> {
  if (amount <= 0) throw new Error("spend amount must be positive")
  return mutate(uid, -amount, reason, idempotencyKey, meta)
}

/** Add credits. */
export function grant(
  uid: string,
  amount: number,
  reason: LedgerReason,
  idempotencyKey: string,
  meta?: Record<string, string | number>,
): Promise<MutationResult> {
  if (amount <= 0) throw new Error("grant amount must be positive")
  return mutate(uid, amount, reason, idempotencyKey, meta)
}

export async function readLedger(uid: string): Promise<LedgerEntry[]> {
  const entries = await store.read(uid)
  // Newest first for display; the stored order stays append-only.
  //
  // Timestamps tie constantly — the signup grant and a first spend routinely
  // land in the same millisecond — and a tie left to sort order would show the
  // newer entry below the older one. Append position breaks the tie.
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.createdAt - a.entry.createdAt || b.index - a.index)
    .map((x) => x.entry)
}

export async function getBalance(uid: string): Promise<number> {
  return balanceOf(await store.read(uid))
}

/**
 * One-time welcome grant. The idempotency key is derived from the uid, so
 * calling this on every launch is harmless and the second call is a no-op.
 */
export function grantSignupCredits(uid: string): Promise<MutationResult> {
  return grant(uid, SIGNUP_GRANT, "signup", `signup:${uid}`)
}
