import type { ReactNode } from "react"
import { Platform, Pressable, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Feather from "@expo/vector-icons/Feather"
import { router } from "expo-router"
import * as Haptics from "expo-haptics"

import { layout, radius, space, useTheme } from "@/theme"
import { Text } from "./Text"
import { AccountButton } from "./AccountButton"
import { HeaderActions } from "./CreditChip"

interface ScreenProps {
  title: string
  /**
   * Optional kicker. Deliberately unset on every tab: repeating the app name
   * above all four screens is pure noise, and the title already orients you.
   */
  eyebrow?: string
  /** Detail screens are pushed over the tabs and need a way back. */
  back?: boolean
  children: ReactNode
}

/** Shared page frame: safe-area padding, centred prose column, page heading. */
export function Screen({ title, eyebrow, back = false, children }: ScreenProps) {
  const t = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg, paddingHorizontal: space.base }}
      contentContainerStyle={{
        paddingTop: insets.top + space.base,
        paddingBottom: space.xl,
        alignItems: "center",
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: "100%", maxWidth: layout.proseMaxWidth, gap: space.lg }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space.base,
          }}
        >
          <View style={{ flex: 1, gap: space.xs }}>
            {back ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={8}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                  }
                  if (router.canGoBack()) router.back()
                  else router.replace("/")
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.xs,
                  alignSelf: "flex-start",
                  paddingVertical: space.xs,
                  paddingRight: space.sm,
                  borderRadius: radius.sm,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Feather name="chevron-left" size={16} color={t.textMuted} />
                <Text variant="label" tone="muted">
                  Back
                </Text>
              </Pressable>
            ) : eyebrow ? (
              <Text variant="label" tone="muted">
                {eyebrow}
              </Text>
            ) : null}
            <Text variant="h1">{title}</Text>
          </View>
          <HeaderActions>
            <AccountButton />
          </HeaderActions>
        </View>
        {children}
      </View>
    </ScrollView>
  )
}
