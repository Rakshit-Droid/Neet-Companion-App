import { useMemo, useState } from "react"
import { Pressable, View } from "react-native"
import { router } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Segmented } from "@/components/Segmented"
import { radius, space, useTheme } from "@/theme"
import { REGIONS, formatIndian, statesSummary, type Region } from "@/lib/predictors"

const ALL = "All" as const
type RegionFilter = typeof ALL | Region

export default function StatesScreen() {
  const t = useTheme()
  const [region, setRegion] = useState<RegionFilter>(ALL)
  const summary = useMemo(() => statesSummary(), [])

  const visible = useMemo(
    () => (region === ALL ? summary : summary.filter((s) => s.region === region)),
    [summary, region],
  )

  return (
    <Screen title="Browse by state">
      <Surface>
        <Segmented
          label="Region"
          options={[ALL, ...REGIONS] as RegionFilter[]}
          value={region}
          onChange={setRegion}
        />
      </Surface>

      <Text variant="label" tone="muted">
        {visible.length} {visible.length === 1 ? "state" : "states"}
      </Text>

      <View style={{ gap: space.sm }}>
        {visible.map((state) => (
          <Pressable
            key={state.code}
            accessibilityRole="button"
            accessibilityLabel={`Open ${state.state}`}
            onPress={() => router.push(`/state/${state.slug}`)}
          >
          <Surface borderRadius={radius.sm} style={{ gap: space.xs }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: space.sm,
              }}
            >
              <Text variant="body" style={{ flex: 1 }}>
                {state.state}
              </Text>
              <Text variant="displayL" style={{ fontSize: 24, lineHeight: 26 }}>
                {state.collegeCount}
              </Text>
            </View>

            <Text variant="bodySm" tone="muted">
              {state.region}
            </Text>

            <View
              style={{
                marginTop: space.xs,
                paddingTop: space.sm,
                borderTopWidth: 1,
                borderTopColor: t.border,
                gap: 2,
              }}
            >
              <Text variant="caption" tone="muted">
                Top: {state.topCollege}
              </Text>
              <Text variant="caption" tone="muted">
                Best closing rank {formatIndian(state.bestClosingRank)}
              </Text>
            </View>
          </Surface>
          </Pressable>
        ))}
      </View>
    </Screen>
  )
}
