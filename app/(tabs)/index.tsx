import { useMemo, useState } from "react"
import { Pressable, View } from "react-native"
import { router } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Field } from "@/components/Field"
import { Segmented } from "@/components/Segmented"
import { TierBadge } from "@/components/TierBadge"
import { layout, radius, space, useTheme } from "@/theme"
import {
  CATEGORIES,
  CATEGORY_LABEL,
  COURSES,
  LATEST_CUTOFF_YEAR,
  MAX_MARKS,
  REGIONS,
  STATES_BY_REGION,
  formatIndian,
  marksToColleges,
  rankToColleges,
  type Category,
  type CollegeMatch,
  type Course,
  type Region,
  type Tier,
} from "@/lib/predictors"

/** The site splits these across four SEO pages; on mobile it is one input mode. */
const INPUTS = ["Score", "Rank"] as const
type InputMode = (typeof INPUTS)[number]

export default function PredictorScreen() {
  const t = useTheme()
  const [mode, setMode] = useState<InputMode>("Score")
  const [marks, setMarks] = useState("560")
  const [rank, setRank] = useState("25000")
  const [category, setCategory] = useState<Category>("UR")
  const [course, setCourse] = useState<Course>("MBBS")
  const [region, setRegion] = useState<"All" | Region>("All")

  const byScore = mode === "Score"
  const parsedMarks = Number(marks)
  const parsedRank = Number(rank)

  const valid = byScore
    ? marks.length > 0 && Number.isFinite(parsedMarks) && parsedMarks >= 0 && parsedMarks <= MAX_MARKS
    : rank.length > 0 && Number.isFinite(parsedRank) && parsedRank > 0

  const states = region === "All" ? undefined : STATES_BY_REGION[region]

  const result = useMemo(() => {
    if (!valid) return null
    const options = { limit: 40, states }
    if (byScore) return marksToColleges(parsedMarks, category, course, options)
    // Rank mode skips the score curve: the rank is already known.
    return { ...rankToColleges(parsedRank, category, course, options), rank: null }
  }, [valid, byScore, parsedMarks, parsedRank, category, course, states])

  // The site groups results into Safe, Moderate and Reach rather than one list.
  const grouped = useMemo(() => {
    if (!result) return []
    return (["Safe", "Moderate", "Reach"] as Tier[])
      .map((tier) => ({ tier, items: result.matches.filter((m) => m.tier === tier) }))
      .filter((g) => g.items.length > 0)
  }, [result])

  return (
    <Screen title="Score to college">
      <Surface style={{ gap: space.lg }}>
        <Segmented label="Predict from" options={INPUTS} value={mode} onChange={setMode} />
        {byScore ? (
          <Field
            label="Your NEET score"
            value={marks}
            onChangeText={setMarks}
            placeholder="0"
            keyboardType="number-pad"
            suffix={`/ ${MAX_MARKS}`}
            error={valid ? undefined : `Enter a score between 0 and ${MAX_MARKS}`}
          />
        ) : (
          <Field
            label="Your All India Rank"
            value={rank}
            onChangeText={setRank}
            placeholder="0"
            keyboardType="number-pad"
            error={valid ? undefined : "Enter a rank above 0"}
          />
        )}
        <Segmented
          label="Category"
          options={CATEGORIES}
          value={category}
          onChange={setCategory}
          labelFor={(c) => CATEGORY_LABEL[c]}
          collapseAfter={5}
        />
        <Segmented label="Course" options={COURSES} value={course} onChange={setCourse} />
        <Segmented
          label="Region"
          options={["All", ...REGIONS] as ("All" | Region)[]}
          value={region}
          onChange={setRegion}
          collapseAfter={4}
        />
      </Surface>

      {result ? (
        <>
          {result.rank ? (
            <>
              <Surface variant="accent" style={{ paddingVertical: space.lg, alignItems: "center" }}>
                <Text variant="label" tone="onAccent">
                  Predicted All India Rank
                </Text>
                <Text variant="displayXl" tone="onAccent" style={{ marginTop: space.xs }}>
                  {formatIndian(result.rank.air)}
                </Text>
                <Text variant="bodySm" tone="onAccent" style={{ marginTop: space.xs }}>
                  {formatIndian(result.rank.low)} to {formatIndian(result.rank.high)} · top{" "}
                  {result.rank.percentile.toFixed(2)} percentile
                </Text>
              </Surface>

              {result.rank.reliable ? null : (
                <Surface variant="outline">
                  <Text variant="caption" tone="moderate">
                    This score is past the reliable range of our rank ledger. Treat the number as a
                    rough band, not a precise rank.
                  </Text>
                </Surface>
              )}
            </>
          ) : null}

          {result.matches.length === 0 ? (
            <Surface style={{ gap: space.sm }}>
              <Text variant="h2">No matches yet</Text>
              <Text variant="bodyRegular" tone="secondary">
                No {course} seat under {CATEGORY_LABEL[category]} closed at or beyond this rank in{" "}
                {LATEST_CUTOFF_YEAR}. Try another course or category above.
              </Text>
            </Surface>
          ) : (
            <View style={{ gap: space.lg }}>
              <Text variant="label" tone="muted">
                {result.total} reachable {result.total === 1 ? "seat" : "seats"}
              </Text>

              {grouped.map((group) => (
                <View key={group.tier} style={{ gap: space.sm }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <TierBadge tier={group.tier} />
                    <Text variant="label" tone="muted">
                      {group.items.length} {group.items.length === 1 ? "seat" : "seats"}
                    </Text>
                  </View>

                  {group.items.map((match: CollegeMatch) => (
                <Pressable
                  key={`${match.slug}-${match.course}-${match.quota}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${match.name}`}
                  onPress={() => router.push(`/college/${match.slug}`)}
                >
                <Surface borderRadius={radius.sm} style={{ gap: space.xs }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: space.sm,
                    }}
                  >
                    <Text variant="body" style={{ flex: 1 }}>
                      {match.name}
                    </Text>
                  </View>

                  <Text variant="bodySm" tone="muted">
                    {match.state}, {match.type}, {match.course}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      gap: space.xs,
                      marginTop: space.xs,
                      paddingTop: space.sm,
                      borderTopWidth: 1,
                      borderTopColor: t.border,
                    }}
                  >
                    <Text variant="label" tone="muted">
                      Closed at
                    </Text>
                    <Text variant="h2">{formatIndian(match.closing)}</Text>
                    <Text variant="caption" tone="muted">
                      in {match.year}
                    </Text>
                  </View>
                </Surface>
                </Pressable>
                  ))}
                </View>
              ))}

              {result.total > result.matches.length ? (
                <Text variant="caption" tone="muted">
                  Showing the {result.matches.length} tightest cutoffs of {result.total}.
                </Text>
              ) : null}
            </View>
          )}
        </>
      ) : null}

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          Based on MCC counselling results through {LATEST_CUTOFF_YEAR}. Past cutoffs indicate but
          do not guarantee future ones. State-quota seats run separately and are not included.
          Verify every choice against MCC and your state counselling authority.
        </Text>
      </Surface>
    </Screen>
  )
}
