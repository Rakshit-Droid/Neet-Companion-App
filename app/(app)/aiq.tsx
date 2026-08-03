import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Field } from "@/components/Field"
import { Segmented } from "@/components/Segmented"
import { Button } from "@/components/Button"
import { TierBadge } from "@/components/TierBadge"
import { WatchButton } from "@/components/WatchButton"
import { RoundLadder } from "@/components/RoundLadder"
import { radius, space, useTheme } from "@/theme"
import { useSession } from "@/state/session"
import { useCredits } from "@/state/credits"
import { useProfile } from "@/state/profile"
import { PRIORITIES, type Priority } from "@/lib/profile"
import { PRICE } from "@/lib/credits"
import { markBilled, wasRecentlyBilled } from "@/lib/metering"
import {
  CATEGORIES,
  CATEGORY_LABEL,
  COURSES,
  LATEST_CUTOFF_YEAR,
  REGIONS,
  STATES_BY_REGION,
  formatIndian,
  queryFingerprint,
  type Region,
} from "@/lib/predictors"
import { buildRoundPlan, type RoundPlanList } from "@/lib/rounds"

const WEIGHTS: Record<Priority, { prestige: number; state: number; government: number }> = {
  Balanced: { prestige: 1, state: 0.6, government: 0.8 },
  "Top colleges": { prestige: 2.5, state: 0.2, government: 0.4 },
  "Near home": { prestige: 0.5, state: 3, government: 0.6 },
  Government: { prestige: 0.6, state: 0.4, government: 3 },
}

export default function AllIndiaQuotaScreen() {
  const t = useTheme()
  const { signedIn, user } = useSession()
  const { balance, charge } = useCredits()
  const { profile, update } = useProfile()

  const region: "All" | Region = profile.homeState
    ? ((REGIONS.find((r) => STATES_BY_REGION[r].includes(profile.homeState!)) ??
        "All") as Region)
    : "All"

  const [list, setList] = useState<RoundPlanList | null>(null)
  /** Which inputs the visible list was built from, so staleness is detectable. */
  const [builtFor, setBuiltFor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shortfall, setShortfall] = useState(false)

  // Region and priority change the result, so they belong in the billing
  // identity alongside rank, category and course.
  const fingerprint = profile.rank
    ? [
        queryFingerprint({
          mode: "rank",
          value: profile.rank,
          category: profile.category,
          course: profile.course,
        }),
        region,
        profile.priority,
      ].join("|")
    : null

  const stale = Boolean(list && builtFor && fingerprint && builtFor !== fingerprint)

  // A shortfall notice is about one attempt, not a permanent state.
  useEffect(() => {
    setShortfall(false)
  }, [fingerprint])

  const build = useCallback(async () => {
    if (!profile.rank || !fingerprint || !user) return
    setBusy(true)
    setShortfall(false)
    try {
      // Charge before building only if this exact query has not already been
      // paid for today: going back to a previous combination is free.
      const alreadyPaid = await wasRecentlyBilled(user.uid, fingerprint)
      if (!alreadyPaid) {
        const ok = await charge(PRICE.search, "search", `search:${user.uid}:${fingerprint}`, {
          rank: profile.rank,
          category: profile.category,
          course: profile.course,
        })
        if (!ok) {
          setShortfall(true)
          return
        }
        await markBilled(user.uid, fingerprint)
      }

      setList(
        buildRoundPlan({
          rank: profile.rank,
          category: profile.category,
          course: profile.course,
          preferredStates: region === "All" ? [] : STATES_BY_REGION[region],
          weights: WEIGHTS[profile.priority],
          limit: 40,
        }),
      )
      setBuiltFor(fingerprint)
    } finally {
      setBusy(false)
    }
  }, [profile, fingerprint, region, user, charge])

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
        <Segmented
          label="What matters most"
          options={PRIORITIES as readonly Priority[] as Priority[]}
          value={profile.priority}
          onChange={(p) => update({ priority: p })}
          collapseAfter={4}
        />
      </Surface>

      <BuildBar
        disabled={!profile.rank}
        busy={busy}
        stale={stale}
        hasList={Boolean(list)}
        balance={balance}
        onPress={build}
      />

      {shortfall ? (
        <Surface style={{ backgroundColor: t.reachBg, gap: space.sm }}>
          <Text variant="body" tone="reach">
            Not enough credits
          </Text>
          <Text variant="bodySm" tone="reach">
            Building a list costs {PRICE.search} credits and you have {balance}.
          </Text>
          <Button label="Get credits" onPress={() => router.push("/credits")} />
        </Surface>
      ) : null}

      {!list ? (
        <Surface style={{ gap: space.sm }}>
          <Text variant="h2">
            {profile.rank ? "Ready when you are" : "Add your rank"}
          </Text>
          <Text variant="bodyRegular" tone="secondary">
            {profile.rank
              ? `Your list is built on demand so you are only charged when you ask for it.`
              : "Enter your All India Rank above, then build your counselling list."}
          </Text>
        </Surface>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Tally label="Reach" count={list.counts.Reach} tone="reach" bg={t.reachBg} />
            <Tally label="Moderate" count={list.counts.Moderate} tone="moderate" bg={t.moderateBg} />
            <Tally label="Safe" count={list.counts.Safe} tone="safe" bg={t.safeBg} />
          </View>

          {list.guidance.warning === "NO_ANCHOR" && list.plans.length > 0 ? (
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

              {list.plans.map(({ choice, rounds, likelyFromRound }) => (
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

                      <View
                        style={{
                          marginTop: space.xs,
                          paddingTop: space.sm,
                          borderTopWidth: 1,
                          borderTopColor: t.border,
                          gap: space.xs,
                        }}
                      >
                        <Text variant="label" tone="muted">
                          {likelyFromRound
                            ? `In reach from ${likelyFromRound}`
                            : "Round by round"}
                        </Text>
                        <RoundLadder rounds={rounds} />
                      </View>
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

              {list.total > list.plans.length ? (
                <Text variant="caption" tone="muted">
                  Showing {list.plans.length} of {list.total} reachable seats.
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

/**
 * Building is an explicit action rather than a live recompute. The list used to
 * rebuild on every keystroke, which at 2 credits a search would have billed a
 * fortune for typing a five-digit rank.
 */
function BuildBar({
  disabled,
  busy,
  stale,
  hasList,
  balance,
  onPress,
}: {
  disabled: boolean
  busy: boolean
  stale: boolean
  hasList: boolean
  balance: number
  onPress: () => void
}) {
  const label = !hasList
    ? `Build my list — ${PRICE.search} credits`
    : stale
      ? `Rebuild with these changes — ${PRICE.search} credits`
      : `Rebuild — ${PRICE.search} credits`

  return (
    <View style={{ gap: space.xs }}>
      <Button label={label} onPress={onPress} disabled={disabled || busy} loading={busy} />
      <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>
        {balance} credits left. Repeating the same search within a day is free.
      </Text>
    </View>
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
