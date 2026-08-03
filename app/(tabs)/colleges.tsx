import { useMemo, useState } from "react"
import { Pressable, View } from "react-native"
import { router } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Field } from "@/components/Field"
import { Segmented } from "@/components/Segmented"
import { radius, space } from "@/theme"
import { COLLEGES, REGIONS, type Region } from "@/lib/predictors"

const ALL = "All" as const
type RegionFilter = typeof ALL | Region

/** Long lists need paging, not dumping: 604 cards would stall the scroller. */
const PAGE = 30

export default function CollegesScreen() {
  const [query, setQuery] = useState("")
  const [region, setRegion] = useState<RegionFilter>(ALL)
  const [shown, setShown] = useState(PAGE)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return COLLEGES.filter((c) => {
      if (region !== ALL && c.region !== region) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.shortName.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q)
      )
    })
  }, [query, region])

  const visible = results.slice(0, shown)

  return (
    <Screen title="College directory">
      <Surface style={{ gap: space.lg }}>
        <Field
          label="Search"
          value={query}
          onChangeText={(v) => {
            setQuery(v)
            setShown(PAGE)
          }}
          placeholder="College or state"
          keyboardType="default"
        />
        <Segmented
          label="Region"
          options={[ALL, ...REGIONS] as RegionFilter[]}
          value={region}
          onChange={(v) => {
            setRegion(v)
            setShown(PAGE)
          }}
        />
      </Surface>

      <Text variant="label" tone="muted">
        {results.length} {results.length === 1 ? "college" : "colleges"}
      </Text>

      <View style={{ gap: space.sm }}>
        {visible.map((college) => (
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
                  {college.state}, {college.type}
                </Text>
              </Surface>
            )}
          </Pressable>
        ))}

        {results.length === 0 ? (
          <Surface>
            <Text variant="bodyRegular" tone="secondary">
              Nothing matches “{query}”.
            </Text>
          </Surface>
        ) : null}

        {shown < results.length ? (
          <Pressable onPress={() => setShown((n) => n + PAGE)} accessibilityRole="button">
            {({ pressed }) => (
              <Surface
                variant="outline"
                borderRadius={radius.sm}
                style={{ alignItems: "center", opacity: pressed ? 0.7 : 1 }}
              >
                <Text variant="label" tone="accent">
                  Show {Math.min(PAGE, results.length - shown)} more
                </Text>
              </Surface>
            )}
          </Pressable>
        ) : null}
      </View>
    </Screen>
  )
}
