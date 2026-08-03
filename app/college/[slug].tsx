import { useMemo, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Segmented } from "@/components/Segmented"
import { TrendBars } from "@/components/TrendBars"
import { WatchButton } from "@/components/WatchButton"
import { radius, space, useTheme } from "@/theme"
import {
  CATEGORY_LABEL,
  collegeDetail,
  faqsFor,
  formatIndian,
  seatMatrix,
  yearDelta,
  type Category,
  type Course,
} from "@/lib/predictors"

export default function CollegeDetailScreen() {
  const t = useTheme()
  const { slug } = useLocalSearchParams<{ slug: string }>()

  // All hooks must run before the early return below, or the hook count changes
  // between renders and React throws.
  const detail = useMemo(() => (slug ? collegeDetail(slug) : null), [slug])
  const faqs = useMemo(() => (slug ? faqsFor(slug) : []), [slug])
  const matrix = useMemo(() => (slug ? seatMatrix(slug) : null), [slug])

  const [category, setCategory] = useState<Category>("UR")
  const [course, setCourse] = useState<Course | "all">("all")

  if (!detail) {
    return (
      <Screen title="College not found" back>
        <Surface>
          <Text variant="bodyRegular" tone="secondary">
            No college matches this link.
          </Text>
        </Surface>
      </Screen>
    )
  }

  const { college, courses, categories, years, latest, rounds, seatsLatest } = detail
  const latestYear = years[0]
  const activeCategory = categories.includes(category) ? category : categories[0]!
  const trend = detail.trendFor(activeCategory, course === "all" ? undefined : course)
  const roundsForView = rounds.filter(
    (r) => r.category === activeCategory && (course === "all" || r.course === course),
  )
  const latestForCategory = latest.filter((c) => c.category === activeCategory)
  const categorySeats = detail.seatsFor(activeCategory, course === "all" ? undefined : course)
  const delta = yearDelta(trend)

  // One row per category with its own year-on-year movement.
  const byCategory = categories
    .map((cat) => {
      const points = detail.trendFor(cat, course === "all" ? undefined : course)
      if (points.length === 0) return null
      const d = yearDelta(points)
      return { category: cat, closing: d!.current, delta: d!.change }
    })
    .filter((r): r is { category: Category; closing: number; delta: number | null } => r !== null)
    .sort((a, b) => a.closing - b.closing)

  return (
    <Screen title={college.name} back>
      <Surface style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Stat label="State" value={college.state} />
          <Stat label="Type" value={college.type} />
          <Stat label="Courses" value={courses.length ? courses.join(", ") : "—"} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Stat
            label={`Seats ${latestYear}`}
            value={seatsLatest ? `${seatsLatest} all categories` : "—"}
          />
          <Stat label="Years of data" value={String(years.length)} />
          <Stat label="Quotas" value={String(detail.quotas.length)} />
        </View>
      </Surface>

      <WatchButton slug={college.slug} category={activeCategory} />

      <Surface style={{ gap: space.lg }}>
        <Segmented
          label="Category"
          options={categories}
          value={activeCategory}
          onChange={setCategory}
          labelFor={(c) => CATEGORY_LABEL[c]}
          collapseAfter={5}
        />
        {courses.length > 1 ? (
          <Segmented
            label="Course"
            options={["all", ...courses] as (Course | "all")[]}
            value={course}
            onChange={setCourse}
            labelFor={(c) => (c === "all" ? "All" : c)}
          />
        ) : null}
      </Surface>

      {latestForCategory.length ? (
        <Surface variant="accent" style={{ alignItems: "center", paddingVertical: space.lg }}>
          <Text variant="label" tone="onAccent">
            {CATEGORY_LABEL[activeCategory]} closing rank {latestYear}
          </Text>
          <Text variant="displayL" tone="onAccent" style={{ marginTop: space.xs }}>
            {formatIndian(Math.min(...latestForCategory.map((c) => c.closing)))}
          </Text>
          {categorySeats > 0 ? (
            <Text variant="bodySm" tone="onAccent" style={{ marginTop: space.xs }}>
              {categorySeats} of {seatsLatest} seats
            </Text>
          ) : null}
          {delta && delta.change !== null ? (
            <Text variant="bodySm" tone="onAccent" style={{ marginTop: space.xs }}>
              {delta.direction === "easier" ? "Easier" : delta.direction === "harder" ? "Harder" : "Flat"}{" "}
              than {latestYear - 1}, {delta.change > 0 ? "+" : ""}
              {formatIndian(delta.change)}
            </Text>
          ) : null}
        </Surface>
      ) : null}

      {byCategory.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">
            Every category, {latestYear}
          </Text>
          <Surface style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Text variant="label" tone="muted" style={{ flex: 1.4 }}>
                Category
              </Text>
              <Text variant="label" tone="muted" style={{ flex: 1, textAlign: "right" }}>
                Closing
              </Text>
              <Text variant="label" tone="muted" style={{ flex: 1, textAlign: "right" }}>
                vs {latestYear - 1}
              </Text>
            </View>
            {byCategory.map((row) => (
              <View
                key={row.category}
                style={{
                  flexDirection: "row",
                  gap: space.sm,
                  alignItems: "center",
                  paddingTop: space.sm,
                  borderTopWidth: 1,
                  borderTopColor: t.border,
                }}
              >
                <Text variant="bodySm" style={{ flex: 1.4 }}>
                  {CATEGORY_LABEL[row.category]}
                </Text>
                <Text variant="bodySm" style={{ flex: 1, textAlign: "right" }}>
                  {formatIndian(row.closing)}
                </Text>
                <Text
                  variant="bodySm"
                  tone={
                    row.delta === null ? "muted" : row.delta > 0 ? "safe" : row.delta < 0 ? "reach" : "muted"
                  }
                  style={{ flex: 1, textAlign: "right" }}
                >
                  {row.delta === null
                    ? "new"
                    : `${row.delta > 0 ? "+" : ""}${formatIndian(row.delta)}`}
                </Text>
              </View>
            ))}
          </Surface>
          <Text variant="caption" tone="muted">
            A rising closing rank means the last admitted candidate had a worse rank, so the
            college got easier to enter.
          </Text>
        </View>
      ) : null}

      {trend.length > 1 ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">
            Closing rank by year
          </Text>
          <Surface>
            <TrendBars points={trend} />
          </Surface>
        </View>
      ) : null}

      {roundsForView.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">
            Round by round, {latestYear}
          </Text>
          <Surface style={{ gap: space.sm }}>
            {roundsForView.map((r, i) => (
              <View
                key={`${r.round}-${r.quota}-${r.course}-${i}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: space.sm,
                  paddingTop: i === 0 ? 0 : space.sm,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="body">{r.round}</Text>
                  <Text variant="caption" tone="muted">
                    {r.quota}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text variant="h2">{formatIndian(r.closing)}</Text>
                  <Text variant="caption" tone="muted">
                    {r.seats} {r.seats === 1 ? "seat" : "seats"}
                    {i > 0
                      ? `, ${r.closing - roundsForView[i - 1]!.closing > 0 ? "+" : ""}${formatIndian(
                          r.closing - roundsForView[i - 1]!.closing,
                        )}`
                      : ""}
                  </Text>
                </View>
              </View>
            ))}
          </Surface>
        </View>
      ) : null}

      {matrix && matrix.rows.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">
            Seat matrix, {latestYear}
          </Text>
          <Surface style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Text variant="label" tone="muted" style={{ flex: 1.4 }}>
                Category
              </Text>
              {matrix.quotas.map((q) => (
                <Text
                  key={q}
                  variant="label"
                  tone="muted"
                  numberOfLines={1}
                  style={{ flex: 1, textAlign: "right" }}
                >
                  {q.replace(" Quota", "").replace("Seats", "").trim()}
                </Text>
              ))}
              <Text variant="label" tone="muted" style={{ width: 42, textAlign: "right" }}>
                Total
              </Text>
            </View>

            {matrix.rows.map((row) => (
              <View
                key={row.category}
                style={{
                  flexDirection: "row",
                  gap: space.sm,
                  paddingTop: space.sm,
                  borderTopWidth: 1,
                  borderTopColor: t.border,
                }}
              >
                <Text variant="bodySm" style={{ flex: 1.4 }}>
                  {CATEGORY_LABEL[row.category]}
                </Text>
                {matrix.quotas.map((q) => (
                  <Text key={q} variant="bodySm" tone="muted" style={{ flex: 1, textAlign: "right" }}>
                    {row.byQuota[q] ?? "—"}
                  </Text>
                ))}
                <Text variant="body" style={{ width: 42, textAlign: "right" }}>
                  {row.total}
                </Text>
              </View>
            ))}

            <View
              style={{
                flexDirection: "row",
                paddingTop: space.sm,
                borderTopWidth: 1,
                borderTopColor: t.border,
              }}
            >
              <Text variant="label" tone="muted" style={{ flex: 1 }}>
                All categories
              </Text>
              <Text variant="body">{matrix.total}</Text>
            </View>
          </Surface>
        </View>
      ) : null}

      {latest.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">
            All {latestYear} cutoffs
          </Text>
          <Surface style={{ gap: space.sm }}>
            {latest.map((c, i) => (
              <View
                key={`${c.category}-${c.course}-${c.quota}-${i}`}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: space.sm,
                  paddingTop: i === 0 ? 0 : space.sm,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="bodySm">
                    {CATEGORY_LABEL[c.category]}, {c.course}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {c.quota}
                  </Text>
                </View>
                <Text variant="body">{formatIndian(c.closing)}</Text>
              </View>
            ))}
          </Surface>
        </View>
      ) : null}

      {faqs.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">
            Common questions
          </Text>
          {faqs.map((f) => (
            <Surface key={f.question} borderRadius={radius.sm} style={{ gap: space.xs }}>
              <Text variant="body">{f.question}</Text>
              <Text variant="bodySm" tone="secondary">
                {f.answer}
              </Text>
            </Surface>
          ))}
        </View>
      ) : null}

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          Cutoffs are from MCC counselling results and cover the quotas in this dataset only, not
          state-quota seats. Verify against mcc.nic.in before making a choice.
        </Text>
      </Surface>
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 96, flexGrow: 1, gap: 2 }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Text variant="bodySm">{value}</Text>
    </View>
  )
}
