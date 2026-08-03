import { useCallback, useState } from "react"
import { Pressable, View } from "react-native"
import { router, useFocusEffect } from "expo-router"
import { Feather } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { radius, space, useTheme } from "@/theme"
import { useSession } from "@/state/session"
import { useProfile } from "@/state/profile"
import { listWatches, type WatchStatus } from "@/lib/watchlist"
import {
  CATEGORY_LABEL,
  LATEST_CUTOFF_YEAR,
  formatIndian,
  rankToColleges,
} from "@/lib/predictors"

export default function DashboardScreen() {
  const t = useTheme()
  const { signedIn, user } = useSession()
  const { profile, loading } = useProfile()
  const [watches, setWatches] = useState<WatchStatus[]>([])

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      listWatches().then((v) => {
        if (!cancelled) setWatches(v)
      })
      return () => {
        cancelled = true
      }
    }, []),
  )

  const moved = watches.filter((w) => w.change !== null && w.change !== 0)

  const reachable = profile.rank
    ? rankToColleges(profile.rank, profile.category, profile.course, { limit: 1 }).total
    : null

  return (
    <Screen title={greeting(user?.displayName ?? null)}>
      {!signedIn ? (
        <Surface style={{ gap: space.sm }}>
          <Text variant="h2">Sign in to use the tools</Text>
          <Text variant="bodyRegular" tone="secondary">
            Your choice list, watchlist and state-quota access are tied to your account so they
            follow you across devices.
          </Text>
          <Button label="Sign in or create account" onPress={() => router.push("/sign-in")} />
        </Surface>
      ) : null}

      {/* Profile: the three facts every tool needs, entered once. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit your details"
        onPress={() => router.push("/profile")}
      >
        {({ pressed }) => (
          <Surface style={{ gap: space.sm, opacity: pressed ? 0.7 : 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Text variant="label" tone="muted" style={{ flex: 1 }}>
                Your details
              </Text>
              <Feather name="edit-2" size={14} color={t.textMuted} />
            </View>

            {loading ? (
              <Text variant="bodyRegular" tone="muted">
                Loading…
              </Text>
            ) : profile.rank ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.sm }}>
                  <Text variant="displayL">{formatIndian(profile.rank)}</Text>
                  <Text variant="bodySm" tone="muted">
                    All India Rank
                  </Text>
                </View>
                <Text variant="bodySm" tone="muted">
                  {CATEGORY_LABEL[profile.category]}, {profile.course}
                </Text>
              </>
            ) : (
              <>
                <Text variant="bodyRegular" tone="secondary">
                  Add your rank, category and course once. Every tool then uses it.
                </Text>
                <Text variant="label" tone="accent">
                  Add your details
                </Text>
              </>
            )}
          </Surface>
        )}
      </Pressable>

      {reachable !== null ? (
        <Surface variant="accent" style={{ alignItems: "center", paddingVertical: space.lg }}>
          <Text variant="label" tone="onAccent">
            Seats within reach at your rank
          </Text>
          <Text variant="displayXl" tone="onAccent" style={{ marginTop: space.xs }}>
            {formatIndian(reachable)}
          </Text>
          <Text variant="bodySm" tone="onAccent" style={{ marginTop: space.xs }}>
            {profile.course} under {CATEGORY_LABEL[profile.category]}, {LATEST_CUTOFF_YEAR}
          </Text>
        </Surface>
      ) : null}

      <Card
        icon="target"
        title="All India Quota"
        body={
          profile.rank
            ? "Build an ordered counselling list from real MCC cutoffs."
            : "Add your rank to build a counselling list."
        }
        cta="Open choice filling"
        onPress={() => router.push("/aiq")}
      />

      <Card
        icon="bookmark"
        title="Watchlist"
        body={
          watches.length === 0
            ? "Nothing watched yet."
            : moved.length > 0
              ? `${moved.length} of ${watches.length} moved since you added ${moved.length === 1 ? "it" : "them"}.`
              : `${watches.length} college${watches.length === 1 ? "" : "s"}, none moved yet.`
        }
        cta="Open watchlist"
        onPress={() => router.push("/watchlist")}
        highlight={moved.length > 0}
      />

      <Card
        icon="map-pin"
        title="State quota"
        body="Telangana is coming soon. Other states are in progress."
        cta="See progress"
        onPress={() => router.push("/state-quota")}
      />

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          Cutoffs cover MCC counselling through {LATEST_CUTOFF_YEAR}. Past results indicate but do
          not guarantee future ones. Always verify against mcc.nic.in.
        </Text>
      </Surface>
    </Screen>
  )
}

function greeting(name: string | null): string {
  const first = name?.trim().split(/\s+/)[0]
  return first ? `Hello, ${first}` : "Dashboard"
}

function Card({
  icon,
  title,
  body,
  cta,
  onPress,
  highlight = false,
}: {
  icon: keyof typeof Feather.glyphMap
  title: string
  body: string
  cta: string
  onPress: () => void
  highlight?: boolean
}) {
  const t = useTheme()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={cta} onPress={onPress}>
      {({ pressed }) => (
        <Surface
          borderRadius={radius.md}
          style={{
            gap: space.xs,
            opacity: pressed ? 0.7 : 1,
            borderColor: highlight ? t.accent : t.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Feather name={icon} size={18} color={t.accentText} />
            <Text variant="body" style={{ flex: 1 }}>
              {title}
            </Text>
            <Feather name="chevron-right" size={18} color={t.textMuted} />
          </View>
          <Text variant="bodySm" tone="muted">
            {body}
          </Text>
        </Surface>
      )}
    </Pressable>
  )
}
