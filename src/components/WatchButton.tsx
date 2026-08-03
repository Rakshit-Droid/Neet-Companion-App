import { useCallback, useEffect, useState } from "react"
import { Platform, Pressable } from "react-native"
import { Feather } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { radius, space, useTheme } from "@/theme"
import { Text } from "./Text"
import { isWatched, toggleWatch } from "@/lib/watchlist"
import type { Category, Course } from "@/lib/predictors"

interface WatchButtonProps {
  slug: string
  category?: Category
  course?: Course
}

/** Toggles a college on the watchlist. Free, local, and never blocks the screen. */
export function WatchButton({ slug, category = "UR", course }: WatchButtonProps) {
  const t = useTheme()
  const [watched, setWatched] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    isWatched(slug).then((v) => {
      if (!cancelled) setWatched(v)
    })
    return () => {
      cancelled = true
    }
  }, [slug])

  const onPress = useCallback(async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }
    // Optimistic: the write is local and effectively cannot fail.
    setWatched((prev) => !prev)
    const next = await toggleWatch(slug, category, course)
    setWatched(next)
  }, [slug, category, course])

  const on = watched === true

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? "Remove from watchlist" : "Add to watchlist"}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.sm,
        minHeight: 48,
        paddingHorizontal: space.base,
        borderRadius: radius.sm,
        borderWidth: 1,
        backgroundColor: on ? t.accent : "transparent",
        borderColor: on ? t.accent : t.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Feather
        name={on ? "check" : "bookmark"}
        size={16}
        color={on ? t.onAccent : t.textMuted}
      />
      <Text variant="label" tone={on ? "onAccent" : "secondary"}>
        {on ? "Watching" : "Watch this college"}
      </Text>
    </Pressable>
  )
}
