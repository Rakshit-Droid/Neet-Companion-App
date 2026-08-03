import { Platform, Pressable } from "react-native"
import Feather from "@expo/vector-icons/Feather"
import { router } from "expo-router"
import * as Haptics from "expo-haptics"

import { layout, radius, useTheme } from "@/theme"
import { Text } from "./Text"
import { useSession } from "@/state/session"

/**
 * Header entry point for the account. Replaces the theme toggle, which moved
 * into Account: six tabs would leave 65px per tab at 393px wide, so the header
 * is the only sensible home for this.
 */
export function AccountButton() {
  const t = useTheme()
  const { user, signedIn } = useSession()

  const initial =
    (user?.displayName?.trim()?.[0] ?? user?.email?.trim()?.[0] ?? "").toUpperCase()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={signedIn ? "Account" : "Sign in"}
      hitSlop={8}
      onPress={() => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        }
        router.push("/account")
      }}
      style={({ pressed }) => ({
        width: layout.touchMin,
        height: layout.touchMin,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: signedIn ? t.accent : t.border,
        backgroundColor: signedIn ? t.accent : "transparent",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {signedIn && initial ? (
        <Text variant="label" tone="onAccent" style={{ fontSize: 14 }}>
          {initial}
        </Text>
      ) : (
        <Feather name="user" size={18} color={signedIn ? t.onAccent : t.textMuted} />
      )}
    </Pressable>
  )
}
