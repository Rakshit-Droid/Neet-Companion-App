import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { useSession } from "./session"
import {
  CREDITS_PER_PACK,
  InsufficientCreditsError,
  getBalance,
  grant,
  grantSignupCredits,
  readLedger,
  spend,
  type LedgerEntry,
  type LedgerReason,
} from "@/lib/credits"
import { installPersistentLedger } from "@/lib/credits-store"
import { installPersistentReferrals } from "@/lib/referrals-store"
import { settleReferralOnPurchase } from "@/lib/referrals"

installPersistentLedger()
installPersistentReferrals()

interface CreditsValue {
  balance: number
  ledger: LedgerEntry[]
  /** True until the signed-in user's ledger has been read. */
  loading: boolean
  /**
   * Charges the user. Returns true if it went through, false if they cannot
   * afford it — callers show the top-up prompt rather than handling an error.
   */
  charge(
    amount: number,
    reason: LedgerReason,
    idempotencyKey: string,
    meta?: Record<string, string | number>,
  ): Promise<boolean>
  /** Adds a pack. Stands in for Play Billing until that lands. */
  buyPack(idempotencyKey: string): Promise<void>
  refresh(): Promise<void>
}

const CreditsContext = createContext<CreditsValue | null>(null)

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { user, signedIn } = useSession()
  const uid = user?.uid ?? null

  const [balance, setBalance] = useState(0)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!uid) {
      setBalance(0)
      setLedger([])
      return
    }
    const [b, l] = await Promise.all([getBalance(uid), readLedger(uid)])
    setBalance(b)
    setLedger(l)
  }, [uid])

  // The welcome grant is idempotent on uid, so running it on every sign-in is
  // safe and means a user who signed up before credits existed still gets it.
  useEffect(() => {
    let cancelled = false
    if (!uid) {
      setBalance(0)
      setLedger([])
      setLoading(false)
      return
    }
    setLoading(true)
    ;(async () => {
      try {
        await grantSignupCredits(uid)
        const [b, l] = await Promise.all([getBalance(uid), readLedger(uid)])
        if (cancelled) return
        setBalance(b)
        setLedger(l)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [uid])

  const charge = useCallback<CreditsValue["charge"]>(
    async (amount, reason, idempotencyKey, meta) => {
      if (!uid) return false
      try {
        await spend(uid, amount, reason, idempotencyKey, meta)
        await refresh()
        return true
      } catch (err) {
        if (err instanceof InsufficientCreditsError) return false
        throw err
      }
    },
    [uid, refresh],
  )

  const buyPack = useCallback<CreditsValue["buyPack"]>(
    async (idempotencyKey) => {
      if (!uid) return
      await grant(uid, CREDITS_PER_PACK, "purchase", idempotencyKey)
      // The referrer is paid off the buyer's first pack, never off their signup.
      // Safe to call on every purchase: it settles at most once per referee.
      await settleReferralOnPurchase(uid)
      await refresh()
    },
    [uid, refresh],
  )

  const value = useMemo<CreditsValue>(
    () => ({ balance, ledger, loading: loading && signedIn, charge, buyPack, refresh }),
    [balance, ledger, loading, signedIn, charge, buyPack, refresh],
  )

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>
}

export function useCredits(): CreditsValue {
  const ctx = useContext(CreditsContext)
  if (!ctx) throw new Error("useCredits must be used inside CreditsProvider")
  return ctx
}
