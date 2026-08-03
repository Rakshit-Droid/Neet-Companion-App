import { useCallback, useEffect, useState } from "react"
import { Platform, Pressable, View } from "react-native"
import Feather from "@expo/vector-icons/Feather"
import { router } from "expo-router"
import * as Haptics from "expo-haptics"

import { radius, space, useTheme } from "@/theme"
import { Text } from "./Text"
import { isWatched, removeWatch, addWatch } from "@/lib/watchlist"
import { PRICE } from "@/lib/credits"
import { useSession } from "@/state/session"
import { useCredits } from "@/state/credits"
import { useProfile } from "@/state/profile"
import type { Category, Course } from "@/lib/predictors"

interface WatchButtonProps {
  slug: string
  category?: Category
  course?: Course
}

/**
 * Toggles a college on the watchlist.
 *
 * Adding costs credits; removing is free. The charge is keyed on the college, so
 * a college you have already paid to watch can be dropped and picked back up
 * without paying twice — otherwise the price would punish tidying up a list.
 */
export function WatchButton({ slug, category = "UR", course }: WatchButtonProps) {
  const t = useTheme()
  const { signedIn, user } = useSession()
  const { charge } = useCredits()
  const { profile } = useProfile()
  const [watched, setWatched] = useState<boolean | null>(null)
  const [denied, setDenied] = useState(false)

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
    if (!signedIn || !user) {
      router.push("/sign-in")
      return
    }
    setDenied(false)

    if (watched) {
      setWatched(false)
      await removeWatch(slug)
      return
    }

    // Charge first: adding without paying, then failing to charge, would hand
    // out the feature for free.
    const ok = await charge(PRICE.watchlist, "watchlist", `watch:${user.uid}:${slug}`, { slug })
    if (!ok) {
      setDenied(true)
      return
    }
    await addWatch(slug, category, course, profile.rank)
    setWatched(true)
  }, [signedIn, user, watched, slug, category, course, profile.rank, charge])

  const on = watched === true

  return (
    <View style={{ gap: space.xs }}>
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
          {on ? "Watching" : `Watch rounds — ${PRICE.watchlist} credit`}
        </Text>
      </Pressable>

      {denied ? (
        <Pressable accessibilityRole="button" onPress={() => router.push("/credits")}>
          <Text variant="caption" tone="reach" style={{ textAlign: "center" }}>
            Not enough credits. Tap to top up.
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
