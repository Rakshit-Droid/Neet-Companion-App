import { useMemo, useState } from "react"
import { Pressable, View } from "react-native"
import { router } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Field } from "@/components/Field"
import { Segmented } from "@/components/Segmented"
import { TierBadge } from "@/components/TierBadge"
import { radius, space, useTheme } from "@/theme"
import {
  CATEGORIES,
  CATEGORY_LABEL,
  COURSES,
  LATEST_CUTOFF_YEAR,
  REGIONS,
  STATES_BY_REGION,
  formatIndian,
  type Category,
  type Course,
  type Region,
} from "@/lib/predictors"
import { buildChoiceList } from "@/lib/choice-filling"

const PRIORITIES = ["Balanced", "Top colleges", "Near home", "Government"] as const
type Priority = (typeof PRIORITIES)[number]

const WEIGHTS: Record<Priority, { prestige: number; state: number; government: number }> = {
  Balanced: { prestige: 1, state: 0.6, government: 0.8 },
  "Top colleges": { prestige: 2.5, state: 0.2, government: 0.4 },
  "Near home": { prestige: 0.5, state: 3, government: 0.6 },
  Government: { prestige: 0.6, state: 0.4, government: 3 },
}

export default function ChoiceFillingScreen() {
  const t = useTheme()
  const [rank, setRank] = useState("25000")
  const [category, setCategory] = useState<Category>("UR")
  const [course, setCourse] = useState<Course>("MBBS")
  const [priority, setPriority] = useState<Priority>("Balanced")
  const [home, setHome] = useState<"All" | Region>("All")

  const parsed = Number(rank)
  const valid = rank.length > 0 && Number.isFinite(parsed) && parsed > 0

  const list = useMemo(() => {
    if (!valid) return null
    return buildChoiceList({
      rank: parsed,
      category,
      course,
      preferredStates: home === "All" ? [] : STATES_BY_REGION[home],
      weights: WEIGHTS[priority],
      limit: 40,
    })
  }, [valid, parsed, category, course, priority, home])

  return (
    <Screen title="Choice filling">
      <Surface style={{ gap: space.lg }}>
        <Field
          label="Your All India Rank"
          value={rank}
          onChangeText={setRank}
          placeholder="0"
          keyboardType="number-pad"
          error={valid ? undefined : "Enter a rank above 0"}
        />
        <Segmented
          label="Category"
          options={CATEGORIES}
          value={category}
          onChange={setCategory}
          labelFor={(c) => CATEGORY_LABEL[c]}
          collapseAfter={5}
        />
        <Segmented label="Course" options={COURSES} value={course} onChange={setCourse} />
        <Segmented label="Priority" options={PRIORITIES} value={priority} onChange={setPriority} />
        <Segmented
          label="Preferred region"
          options={["All", ...REGIONS] as ("All" | Region)[]}
          value={home}
          onChange={setHome}
          collapseAfter={4}
        />
      </Surface>

      {list ? (
        <>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Tally label="Reach" count={list.counts.Reach} tone="reach" bg={t.reachBg} />
            <Tally label="Moderate" count={list.counts.Moderate} tone="moderate" bg={t.moderateBg} />
            <Tally label="Safe" count={list.counts.Safe} tone="safe" bg={t.safeBg} />
          </View>

          {list.guidance.warning === "NO_ANCHOR" && list.choices.length > 0 ? (
            <Surface style={{ backgroundColor: t.reachBg, gap: space.xs }}>
              <Text variant="body" tone="reach">
                No anchor in this list
              </Text>
              <Text variant="bodySm" tone="reach">
                Every seat here is a stretch at your rank. Widen the course or category, or add
                colleges you are confident of, or you risk going unallotted entirely.
              </Text>
            </Surface>
          ) : null}

          {list.guidance.realisticBandStartsAt && list.guidance.realisticBandStartsAt > 1 ? (
            <Surface variant="outline">
              <Text variant="caption" tone="muted">
                Choices 1 to {list.guidance.realisticBandStartsAt - 1} are aspirational. List them
                anyway, an unfilled preference costs nothing. Your realistic band starts at choice{" "}
                {list.guidance.realisticBandStartsAt}.
              </Text>
            </Surface>
          ) : null}

          {list.total === 0 ? (
            <Surface>
              <Text variant="bodyRegular" tone="secondary">
                No {course} seat under {CATEGORY_LABEL[category]} is reachable at AIR{" "}
                {formatIndian(parsed)}.
              </Text>
            </Surface>
          ) : (
            <View style={{ gap: space.sm }}>
              <Text variant="label" tone="muted">
                Preference order, {priority.toLowerCase()} first
              </Text>

              {list.choices.map((choice) => (
                <Pressable
                  key={`${choice.order}-${choice.college.slug}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${choice.college.name}`}
                  onPress={() => router.push(`/college/${choice.college.slug}`)}
                >
                  {({ pressed }) => (
                    <Surface
                      borderRadius={radius.sm}
                      style={{
                        flexDirection: "row",
                        gap: space.base,
                        opacity: pressed ? 0.7 : 1,
                      }}
                    >
                      <Text
                        variant="displayL"
                        tone="muted"
                        style={{ fontSize: 20, lineHeight: 24, minWidth: 26 }}
                      >
                        {choice.order}
                      </Text>

                      <View style={{ flex: 1, gap: space.xs }}>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: space.sm,
                          }}
                        >
                          <Text variant="body" style={{ flex: 1 }}>
                            {choice.college.name}
                          </Text>
                          <TierBadge tier={choice.college.tier} />
                        </View>

                        <Text variant="bodySm" tone="muted">
                          {choice.college.state}, {choice.college.type}
                        </Text>

                        {choice.rounds.length ? (
                          <View
                            style={{
                              marginTop: space.xs,
                              paddingTop: space.sm,
                              borderTopWidth: 1,
                              borderTopColor: t.border,
                              gap: 2,
                            }}
                          >
                            <Text variant="label" tone="muted">
                              {LATEST_CUTOFF_YEAR} rounds
                            </Text>
                            {choice.rounds.map((r) => (
                              <View
                                key={r.round}
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  gap: space.sm,
                                }}
                              >
                                <Text
                                  variant="caption"
                                  tone={r.round === choice.clearsFromRound ? "accent" : "muted"}
                                  style={{ flex: 1 }}
                                >
                                  {r.round}
                                  {r.round === choice.clearsFromRound ? " — reaches you" : ""}
                                </Text>
                                <Text variant="caption" tone="muted">
                                  {formatIndian(r.closing)}
                                  {r.seats ? `, ${r.seats} seat${r.seats === 1 ? "" : "s"}` : ""}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    </Surface>
                  )}
                </Pressable>
              ))}

              {list.total > list.choices.length ? (
                <Text variant="caption" tone="muted">
                  Showing {list.choices.length} of {list.total} reachable seats.
                </Text>
              ) : null}
            </View>
          )}
        </>
      ) : null}

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          Ordered by your stated priority, because counselling allots the highest preference you
          clear. Round figures are what actually happened in {LATEST_CUTOFF_YEAR}, not a forecast.
          We deliberately do not show an allotment probability: cutoffs loosened every year from
          2021 to 2024 and then tightened in 2025, so any percentage would be guesswork.
        </Text>
      </Surface>
    </Screen>
  )
}

function Tally({
  label,
  count,
  tone,
  bg,
}: {
  label: string
  count: number
  tone: "safe" | "moderate" | "reach"
  bg: string
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        gap: space.xs,
        paddingVertical: space.base,
        borderRadius: radius.sm,
        backgroundColor: bg,
      }}
    >
      <Text variant="displayL" tone={tone} style={{ fontSize: 26, lineHeight: 30 }}>
        {count}
      </Text>
      <Text variant="label" tone={tone}>
        {label}
      </Text>
    </View>
  )
}
