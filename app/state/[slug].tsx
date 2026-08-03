import { useMemo } from "react"
import { Pressable, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { radius, space } from "@/theme"
import { bestClosingFor, collegesByState, COLLEGES, formatIndian, statesSummary } from "@/lib/predictors"

export default function StateDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()

  const data = useMemo(() => {
    if (!slug) return null
    const match = collegesByState(slug)
    if (!match) return null
    const summary = statesSummary().find((s) => s.slug === slug)
    const withRanks = match.colleges
      .map((c) => ({ college: c, closing: bestClosingFor(COLLEGES.indexOf(c)) }))
      // Colleges with a recorded cutoff first, tightest at the top.
      .sort((a, b) => (a.closing ?? Infinity) - (b.closing ?? Infinity))
    return { state: match.state, summary, colleges: withRanks }
  }, [slug])

  if (!data) {
    return (
      <Screen title="State not found" back>
        <Surface>
          <Text variant="bodyRegular" tone="secondary">
            No state matches this link.
          </Text>
        </Surface>
      </Screen>
    )
  }

  return (
    <Screen title={data.state} back>
      <Surface style={{ flexDirection: "row", flexWrap: "wrap", gap: space.base }}>
        <Stat label="Colleges" value={String(data.colleges.length)} />
        {data.summary ? <Stat label="Region" value={data.summary.region} /> : null}
        {data.summary?.bestClosingRank ? (
          <Stat label="Best rank" value={formatIndian(data.summary.bestClosingRank)} />
        ) : null}
      </Surface>

      <Text variant="label" tone="muted">
        Colleges, tightest cutoff first
      </Text>

      <View style={{ gap: space.sm }}>
        {data.colleges.map(({ college, closing }) => (
          <Pressable
            key={college.slug}
            accessibilityRole="button"
            accessibilityLabel={`Open ${college.name}`}
            onPress={() => router.push(`/college/${college.slug}`)}
          >
            {({ pressed }) => (
              <Surface
                borderRadius={radius.sm}
                style={{ gap: space.xs, opacity: pressed ? 0.7 : 1 }}
              >
                <Text variant="body">{college.name}</Text>
                <Text variant="bodySm" tone="muted">
                  {college.type}
                </Text>
                <Text variant="caption" tone={closing ? "accent" : "muted"}>
                  {closing ? `Best closing rank ${formatIndian(closing)}` : "No recent cutoff data"}
                </Text>
              </Surface>
            )}
          </Pressable>
        ))}
      </View>
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 90, flexGrow: 1, gap: 2 }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Text variant="bodySm">{value}</Text>
    </View>
  )
}
