// Barrel for the theme. Tokens live in ./tokens so ThemeProvider can import
// them without a cycle; everything is re-exported here so components keep
// importing from "@/theme".

export * from "./tokens"
export { ThemeProvider, useThemeMode, type ThemeMode } from "./ThemeProvider"

import type { Palette, Scheme } from "./tokens"
import { useThemeMode } from "./ThemeProvider"

/**
 * The palette for the active scheme. Resolves the user's stored preference,
 * falling back to the OS setting when the mode is "system".
 */
export function useTheme(): Palette & { scheme: Scheme } {
  const { palette, scheme } = useThemeMode()
  return { ...palette, scheme }
}
