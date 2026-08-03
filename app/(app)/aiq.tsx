import { useMemo } from "react"
import { Pressable, View } from "react-native"
import { router } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Field } from "@/components/Field"
import { Segmented } from "@/components/Segmented"
import { Button } from "@/components/Button"
import { TierBadge } from "@/components/TierBadge"
import { WatchButton } from "@/components/WatchButton"
import { radius, space, useTheme } from "@/theme"
import { useSession } from "@/state/session"
import { useProfile } from "@/state/profile"
import {
  CATEGORIES,
  CATEGORY_LABEL,
  COURSES,
  LATEST_CUTOFF_YEAR,
  REGIONS,
  STATES_BY_REGION,
  formatIndian,
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

export default function AllIndiaQuotaScreen() {
  const t = useTheme()
  const { signedIn } = useSession()
  const { profile, update } = useProfile()

  // Priority and region live on the profile too, so the list is reproducible
  // without retyping anything on every visit.
  const priority: Priority = "Balanced"
  const region: "All" | Region = profile.homeState
    ? ((REGIONS.find((r) => STATES_BY_REGION[r].includes(profile.homeState!)) ??
        "All") as Region)
    : "All"

  const list = useMemo(() => {
    if (!profile.rank) return null
    return buildChoiceList({
      rank: profile.rank,
      category: profile.category,
      course: profile.course,
      preferredStates: region === "All" ? [] : STATES_BY_REGION[region],
      weights: WEIGHTS[priority],
      limit: 40,
    })
  }, [profile.rank, profile.category, profile.course, region, priority])

  if (!signedIn) {
    return (
      <Screen title="All India Quota">
        <Surface style={{ gap: space.sm }}>
          <Text variant="h2">Sign in to build your list</Text>
          <Text variant="bodyRegular" tone="secondary">
            Choice filling orders every reachable seat by what you actually want, using seven
            years of MCC results. It is tied to your account.
          </Text>
          <Button label="Sign in or create account" onPress={() => router.push("/sign-in")} />
        </Surface>
      </Screen>
    )
  }

  return (
    <Screen title="All India Quota">
      <Surface style={{ gap: space.lg }}>
        <Field
          label="Your All India Rank"
          value={profile.rank ? String(profile.rank) : ""}
          onChangeText={(v) => update({ rank: v ? Number(v) : null })}
          placeholder="Enter your AIR"
          keyboardType="number-pad"
          hint="Saved to your profile and reused everywhere."
        />
        <Segmented
          label="Category"
          options={CATEGORIES}
          value={profile.category}
          onChange={(c) => update({ category: c })}
          labelFor={(c) => CATEGORY_LABEL[c]}
          collapseAfter={5}
        />
        <Segmented
          label="Course"
          options={COURSES}
          value={profile.course}
          onChange={(c) => update({ course: c })}
        />
      </Surface>

      {!list ? (
        <Surface style={{ gap: space.sm }}>
          <Text variant="h2">Add your rank</Text>
          <Text variant="bodyRegular" tone="secondary">
            Enter your All India Rank above and your counselling list appears here.
          </Text>
        </Surface>
      ) : (
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
                Every seat here is a stretch at your rank. Widen the course or category, or you
                risk going unallotted entirely.
              </Text>
            </Surface>
          ) : null}

          {list.total === 0 ? (
            <Surface>
              <Text variant="bodyRegular" tone="secondary">
                No {profile.course} seat under {CATEGORY_LABEL[profile.category]} is reachable at
                AIR {formatIndian(profile.rank!)}.
              </Text>
            </Surface>
          ) : (
            <View style={{ gap: space.sm }}>
              <Text variant="label" tone="muted">
                {list.total} reachable {list.total === 1 ? "seat" : "seats"}, preference order
              </Text>

              {list.choices.map((choice) => (
                <Surface
                  key={`${choice.order}-${choice.college.slug}`}
                  borderRadius={radius.sm}
                  style={{ gap: space.sm }}
                >
                  <View style={{ flexDirection: "row", gap: space.base }}>
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
                  </View>

                  {/* The only place a college can be watched now that the
                      standalone browse screens are gone. */}
                  <WatchButton
                    slug={choice.college.slug}
                    category={choice.college.category}
                    course={choice.college.course}
                  />
                </Surface>
              ))}

              {list.total > list.choices.length ? (
                <Text variant="caption" tone="muted">
                  Showing {list.choices.length} of {list.total} reachable seats.
                </Text>
              ) : null}
            </View>
          )}
        </>
      )}

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          Ordered by preference, because counselling allots the highest choice you clear. Round
          figures are what happened in {LATEST_CUTOFF_YEAR}, not a forecast. We deliberately show
          no allotment percentage: cutoffs loosened every year from 2021 to 2024 then tightened in
          2025, so any number would be guesswork.
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
