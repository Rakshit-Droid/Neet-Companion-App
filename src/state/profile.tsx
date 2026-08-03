import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { EMPTY_PROFILE, loadProfile, saveProfile, type Profile } from "@/lib/profile"

interface ProfileValue {
  profile: Profile
  loading: boolean
  update: (patch: Partial<Profile>) => void
}

const ProfileContext = createContext<ProfileValue | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    loadProfile().then((p) => {
      if (!cancelled) {
        setProfile(p)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback((patch: Partial<Profile>) => {
    // Optimistic: the write is local, and blocking the UI on it would make
    // every chip tap feel laggy.
    setProfile((prev) => {
      const next = { ...prev, ...patch }
      void saveProfile(next)
      return next
    })
  }, [])

  const value = useMemo<ProfileValue>(
    () => ({ profile, loading, update }),
    [profile, loading, update],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile(): ProfileValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider")
  return ctx
}
