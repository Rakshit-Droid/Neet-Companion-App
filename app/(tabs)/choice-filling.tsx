import { useMemo, useState } from "react"
import { View } from "react-native"

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
  formatIndian,
  type Category,
  type Course,
} from "@/lib/predictors"
import { buildChoiceList } from "@/lib/choice-filling"

export default function ChoiceFillingScreen() {
  const t = useTheme()
  const [rank, setRank] = useState("25000")
  const [category, setCategory] = useState<Category>("UR")
  const [course, setCourse] = useState<Course>("MBBS")

  const parsed = Number(rank)
  const valid = rank.length > 0 && Number.isFinite(parsed) && parsed > 0

  const list = useMemo(
    () => (valid ? buildChoiceList({ rank: parsed, category, course }) : null),
    [valid, parsed, category, course],
  )

  return (
    <Screen title="Choice filling">
      <Surface style={{ gap: space.lg }}>
        <Field
          label="Your All India Rank"
          value={rank}
          onChangeText={setRank}
          placeholder="0"
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
      </Surface>

      {list ? (
        <>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Tally label="Reach" count={list.counts.Reach} tone="reach" bg={t.reachBg} />
            <Tally label="Moderate" count={list.counts.Moderate} tone="moderate" bg={t.moderateBg} />
            <Tally label="Safe" count={list.counts.Safe} tone="safe" bg={t.safeBg} />
          </View>

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
                Preference order, aspirational first
              </Text>

              {list.choices.map((choice) => (
                <Surface
                  key={choice.order}
                  borderRadius={radius.sm}
                  style={{ flexDirection: "row", gap: space.base }}
                >
                  <Text variant="displayL" tone="muted" style={{ fontSize: 20, lineHeight: 24 }}>
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
                      {choice.college.state}, closed at AIR{" "}
                      {formatIndian(choice.college.closing)}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {choice.advice}
                    </Text>
                  </View>
                </Surface>
              ))}

              {list.total > list.choices.length ? (
                <Text variant="caption" tone="muted">
                  Showing the top {list.choices.length} of {list.total} reachable seats.
                </Text>
              ) : null}
            </View>
          )}
        </>
      ) : null}

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          Ordered aspirational-first because counselling allots the highest preference you clear.
          Built on MCC results through {LATEST_CUTOFF_YEAR}. State-quota counselling is run by each
          state and is not covered here.
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
