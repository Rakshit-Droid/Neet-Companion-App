import { useMemo, useState } from "react"
import { Pressable, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Segmented } from "@/components/Segmented"
import { radius, space, useTheme } from "@/theme"
import {
  CATEGORY_LABEL,
  COLLEGE_TYPES,
  COURSES,
  LATEST_CUTOFF_YEAR,
  collegesInState,
  formatIndian,
  stateStats,
  statesSummary,
  type Course,
} from "@/lib/predictors"

const ALL = "All" as const
type CourseFilter = typeof ALL | Course
type TypeFilter = typeof ALL | string
const SORTS = ["Cutoff", "Name"] as const

export default function StateDetailScreen() {
  const t = useTheme()
  const { slug } = useLocalSearchParams<{ slug: string }>()

  const [course, setCourse] = useState<CourseFilter>(ALL)
  const [type, setType] = useState<TypeFilter>(ALL)
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Cutoff")

  const base = useMemo(() => (slug ? collegesInState(slug) : []), [slug])
  const stats = useMemo(() => (slug ? stateStats(slug) : null), [slug])
  const summary = useMemo(
    () => (slug ? statesSummary().find((s) => s.slug === slug) : undefined),
    [slug],
  )

  const rows = useMemo(() => {
    const filtered = base.filter((r) => {
      if (course !== ALL && !r.courses.includes(course)) return false
      if (type !== ALL && r.college.type !== type) return false
      return true
    })
    return sort === "Name"
      ? [...filtered].sort((a, b) => a.college.name.localeCompare(b.college.name))
      : filtered
  }, [base, course, type, sort])

  if (!slug || base.length === 0 || !stats) {
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

  const stateName = base[0]!.college.state
  const typesHere = COLLEGE_TYPES.filter((ty) => base.some((r) => r.college.type === ty))
  const coursesHere = COURSES.filter((c) => base.some((r) => r.courses.includes(c)))

  return (
    <Screen title={stateName} back>
      <Surface style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space.base }}>
        <Metric value={String(stats.colleges)} label="Colleges" />
        {coursesHere.map((c) => (
          <Metric key={c} value={String(stats.byCourse[c])} label={c === "B.Sc. Nursing" ? "Nursing" : c} />
        ))}
        {stats.averageClosing ? (
          <Metric value={formatIndian(stats.averageClosing)} label="Avg closing" />
        ) : null}
      </Surface>

      <Surface style={{ gap: space.lg }}>
        {coursesHere.length > 1 ? (
          <Segmented
            label="Course"
            options={[ALL, ...coursesHere] as CourseFilter[]}
            value={course}
            onChange={setCourse}
          />
        ) : null}
        {typesHere.length > 1 ? (
          <Segmented
            label="Type"
            options={[ALL, ...typesHere] as TypeFilter[]}
            value={type}
            onChange={setType}
          />
        ) : null}
        <Segmented label="Sort by" options={SORTS} value={sort} onChange={setSort} />
      </Surface>

      <Text variant="label" tone="muted">
        {rows.length} {rows.length === 1 ? "college" : "colleges"}
        {sort === "Cutoff" ? ", tightest cutoff first" : ", A to Z"}
      </Text>

      <View style={{ gap: space.sm }}>
        {rows.map((r) => (
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
                  {r.college.type}
                  {r.course ? `, ${r.course}` : ""}
                </Text>
                <Text variant="caption" tone={r.closing ? "accent" : "muted"}>
                  {r.closing
                    ? `${formatIndian(r.closing)} closing rank, ${
                        r.category ? CATEGORY_LABEL[r.category] : ""
                      }${r.round ? `, ${r.round}` : ""}, ${LATEST_CUTOFF_YEAR}`
                    : `No ${LATEST_CUTOFF_YEAR} cutoff recorded`}
                </Text>
              </Surface>
            )}
          </Pressable>
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">
          Common questions
        </Text>
        {buildStateFaqs(stateName, stats, summary?.topCollege).map((f) => (
          <Surface key={f.question} borderRadius={radius.sm} style={{ gap: space.xs }}>
            <Text variant="body">{f.question}</Text>
            <Text variant="bodySm" tone="secondary">
              {f.answer}
            </Text>
          </Surface>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push("/")}>
        {({ pressed }) => (
          <Surface
            variant="accent"
            style={{ alignItems: "center", opacity: pressed ? 0.85 : 1, paddingVertical: space.base }}
          >
            <Text variant="label" tone="onAccent">
              Predict my colleges
            </Text>
          </Surface>
        )}
      </Pressable>

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          Covers MCC counselling quotas only. {stateName} also runs its own state-quota
          counselling for the majority of seats, which is not included here.
        </Text>
      </Surface>
    </Screen>
  )
}

function buildStateFaqs(
  state: string,
  stats: NonNullable<ReturnType<typeof stateStats>>,
  topCollege?: string,
) {
  const courses = (Object.entries(stats.byCourse) as [Course, number][])
    .filter(([, n]) => n > 0)
    .map(([c, n]) => `${n} ${c}`)

  return [
    {
      question: `How many medical colleges does ${state} have under NEET counselling?`,
      answer: `${stats.colleges} institutes in ${state} recorded allotments through this counselling, covering ${courses.join(", ")}.`,
    },
    ...(topCollege
      ? [
          {
            question: `Which is the most competitive college in ${state}?`,
            answer: `${topCollege} had the tightest closing rank in ${state} in ${LATEST_CUTOFF_YEAR}.`,
          },
        ]
      : []),
    ...(stats.averageClosing
      ? [
          {
            question: `What rank do I need for ${state}?`,
            answer: `The average tightest closing rank across ${state} colleges was ${formatIndian(stats.averageClosing)} in ${LATEST_CUTOFF_YEAR}. Individual colleges vary enormously, so check each one.`,
          },
        ]
      : []),
    {
      question: `What is the difference between All India Quota and state quota?`,
      answer: `All India Quota seats are allotted centrally by MCC and are open to candidates from any state. State-quota seats are allotted by each state's own authority, usually with a domicile requirement. This app covers the MCC side only.`,
    },
  ]
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ minWidth: 78, flexGrow: 1, gap: 2 }}>
      <Text variant="displayL" style={{ fontSize: 22, lineHeight: 26 }}>
        {value}
      </Text>
      <Text variant="label" tone="muted">
        {label}
      </Text>
    </View>
  )
}
