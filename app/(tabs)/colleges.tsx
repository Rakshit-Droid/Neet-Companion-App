import { useMemo, useState } from "react"
import { Pressable, View } from "react-native"
import { router } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Field } from "@/components/Field"
import { Segmented } from "@/components/Segmented"
import { radius, space } from "@/theme"
import {
  COLLEGE_TYPES,
  COURSES,
  LATEST_CUTOFF_YEAR,
  REGIONS,
  directoryRows,
  formatIndian,
  type Course,
  type Region,
} from "@/lib/predictors"

const ALL = "All" as const
type RegionFilter = typeof ALL | Region
type TypeFilter = typeof ALL | string
type CourseFilter = typeof ALL | Course

/** Long lists page rather than render whole: 604 cards would stall the scroller. */
const PAGE = 25

export default function CollegesScreen() {
  const [query, setQuery] = useState("")
  const [region, setRegion] = useState<RegionFilter>(ALL)
  const [type, setType] = useState<TypeFilter>(ALL)
  const [course, setCourse] = useState<CourseFilter>(ALL)
  const [shown, setShown] = useState(PAGE)

  const rows = useMemo(() => directoryRows(), [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      const c = r.college
      if (region !== ALL && c.region !== region) return false
      if (type !== ALL && c.type !== type) return false
      if (course !== ALL && !r.courses.includes(course)) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.shortName.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q)
      )
    })
  }, [rows, query, region, type, course])

  const reset = () => setShown(PAGE)
  const visible = results.slice(0, shown)

  return (
    <Screen title="College directory">
      <Surface style={{ gap: space.lg }}>
        <Field
          label="Search"
          value={query}
          onChangeText={(v) => {
            setQuery(v)
            reset()
          }}
          placeholder="College or state"
          keyboardType="default"
        />
        <Segmented
          label="Course"
          options={[ALL, ...COURSES] as CourseFilter[]}
          value={course}
          onChange={(v) => {
            setCourse(v)
            reset()
          }}
        />
        <Segmented
          label="Type"
          options={[ALL, ...COLLEGE_TYPES] as TypeFilter[]}
          value={type}
          onChange={(v) => {
            setType(v)
            reset()
          }}
        />
        <Segmented
          label="Region"
          options={[ALL, ...REGIONS] as RegionFilter[]}
          value={region}
          onChange={(v) => {
            setRegion(v)
            reset()
          }}
          collapseAfter={4}
        />
      </Surface>

      <Text variant="label" tone="muted">
        {visible.length} of {results.length}
        {results.length !== rows.length ? ` filtered from ${rows.length}` : " colleges"}
      </Text>

      <View style={{ gap: space.sm }}>
        {visible.map((r) => (
          <Pressable
            key={r.college.slug}
            accessibilityRole="button"
            accessibilityLabel={`Open ${r.college.name}`}
            onPress={() => router.push(`/college/${r.college.slug}`)}
          >
            {({ pressed }) => (
              <Surface
                borderRadius={radius.sm}
                style={{ gap: space.xs, opacity: pressed ? 0.7 : 1 }}
              >
                <Text variant="body">{r.college.name}</Text>
                <Text variant="bodySm" tone="muted">
                  {r.college.state}, {r.college.type}
                </Text>
                <Text variant="caption" tone={r.closing ? "accent" : "muted"}>
                  {r.closing
                    ? `${formatIndian(r.closing)} closing rank, ${r.course}, ${LATEST_CUTOFF_YEAR}`
                    : `No ${LATEST_CUTOFF_YEAR} cutoff recorded`}
                </Text>
              </Surface>
            )}
          </Pressable>
        ))}

        {results.length === 0 ? (
          <Surface>
            <Text variant="bodyRegular" tone="secondary">
              Nothing matches these filters. Try widening the course, type or region.
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
