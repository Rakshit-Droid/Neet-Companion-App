import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { watchAuth, isAuthAvailable, type AuthUser } from "@/lib/auth"

interface SessionValue {
  user: AuthUser | null
  /** True until the persisted session has been restored. */
  loading: boolean
  signedIn: boolean
  /** False when neither Firebase nor the dev mock can sign anyone in. */
  available: boolean
}

const SessionContext = createContext<SessionValue | null>(null)

/**
 * Sign-in state for the whole app. Deliberately thin: the app is fully usable
 * signed out, so nothing here blocks rendering.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(isAuthAvailable)

  useEffect(() => {
    if (!isAuthAvailable) {
      setLoading(false)
      return
    }
    const unsub = watchAuth((next) => {
      setUser(next)
      setLoading(false)
    })
    return unsub
  }, [])

  const value = useMemo<SessionValue>(
    () => ({
      user,
      loading,
      signedIn: Boolean(user),
      available: isAuthAvailable,
    }),
    [user, loading],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error("useSession must be used inside SessionProvider")
  return ctx
}
