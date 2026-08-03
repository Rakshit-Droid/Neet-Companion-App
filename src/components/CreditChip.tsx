import { Platform, Pressable, View } from "react-native"
import Feather from "@expo/vector-icons/Feather"
import { router } from "expo-router"
import * as Haptics from "expo-haptics"

import { radius, space, useTheme } from "@/theme"
import { Text } from "./Text"
import { useSession } from "@/state/session"
import { useCredits } from "@/state/credits"
import { PRICE } from "@/lib/credits"

/**
 * Balance in the header, next to the account button. A user about to be charged
 * should never have to go looking for what they have left, and a balance too
 * low for the next search turns amber before they hit the wall.
 */
export function CreditChip() {
  const t = useTheme()
  const { signedIn } = useSession()
  const { balance, loading } = useCredits()

  if (!signedIn || loading) return null

  const low = balance < PRICE.search

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${balance} credits. Top up.`}
      hitSlop={8}
      onPress={() => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        }
        router.push("/credits")
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        paddingHorizontal: space.sm,
        height: 32,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: low ? t.moderate : t.border,
        backgroundColor: low ? t.moderateBg : "transparent",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Feather name="zap" size={13} color={low ? t.moderate : t.textMuted} />
      <Text variant="label" tone={low ? "moderate" : "muted"}>
        {balance}
      </Text>
    </Pressable>
  )
}

/** Header cluster, so screens keep a single element on the right. */
export function HeaderActions({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      <CreditChip />
      {children}
    </View>
  )
}
