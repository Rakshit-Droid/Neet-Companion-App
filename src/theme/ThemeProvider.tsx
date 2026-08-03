import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useColorScheme } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

import { palettes, type Palette, type Scheme } from "./index"

/** "system" follows the OS; the other two override it. */
export type ThemeMode = "system" | "light" | "dark"

const MODES: ThemeMode[] = ["system", "light", "dark"]
const STORAGE_KEY = "theme-mode"

interface ThemeContextValue {
  palette: Palette
  scheme: Scheme
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  /** Advances system to light to dark and back, for a single-button control. */
  cycleMode: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme: Scheme = useColorScheme() === "dark" ? "dark" : "light"
  const [mode, setModeState] = useState<ThemeMode>("system")

  // Restore the saved preference once on mount.
  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!cancelled && saved && MODES.includes(saved as ThemeMode)) {
          setModeState(saved as ThemeMode)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})
  }, [])

  const cycleMode = useCallback(() => {
    setModeState((current) => {
      const next = MODES[(MODES.indexOf(current) + 1) % MODES.length]!
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})
      return next
    })
  }, [])

  const value = useMemo<ThemeContextValue>(() => {
    const scheme: Scheme = mode === "system" ? systemScheme : mode
    return { palette: palettes[scheme], scheme, mode, setMode, cycleMode }
  }, [mode, systemScheme, setMode, cycleMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useThemeMode must be used inside ThemeProvider")
  return ctx
}
