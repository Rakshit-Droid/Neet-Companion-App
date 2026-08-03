import { Platform, Pressable } from "react-native"
import Feather from "@expo/vector-icons/Feather"
import * as Haptics from "expo-haptics"

import { layout, radius, useTheme, useThemeMode, type ThemeMode } from "@/theme"

const ICON: Record<ThemeMode, keyof typeof Feather.glyphMap> = {
  system: "smartphone",
  light: "sun",
  dark: "moon",
}

const NEXT_LABEL: Record<ThemeMode, string> = {
  system: "Following system theme. Switch to light.",
  light: "Light theme. Switch to dark.",
  dark: "Dark theme. Switch to system.",
}

/**
 * One button cycling system to light to dark. Keeping "system" in the cycle
 * means the OS setting stays reachable instead of being lost on first tap.
 */
export function ThemeToggle() {
  const t = useTheme()
  const { mode, cycleMode } = useThemeMode()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={NEXT_LABEL[mode]}
      onPress={() => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        }
        cycleMode()
      }}
      hitSlop={8}
      style={({ pressed }) => ({
        width: layout.touchMin,
        height: layout.touchMin,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: mode === "system" ? "transparent" : t.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Feather
        name={ICON[mode]}
        size={18}
        color={mode === "system" ? t.textMuted : t.accentText}
      />
    </Pressable>
  )
}
