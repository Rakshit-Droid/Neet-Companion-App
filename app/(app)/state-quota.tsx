import { View } from "react-native"
import { Feather } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { radius, space, useTheme } from "@/theme"
import { COLLEGES, stateName } from "@/lib/predictors"
import { PRICE } from "@/lib/credits"

/**
 * State-quota counselling is roughly 85% of all seats and is run by each state
 * separately from MCC. None of it is in the dataset yet, so this screen sets
 * expectations rather than pretending otherwise.
 *
 * Telangana is first because it is the one actually being worked on. It is
 * priced here but NOT charged: taking credits for a search that cannot run yet
 * would be selling nothing. The price is shown so it is not a surprise later.
 */
const TELANGANA = "TS"

export default function StateQuotaScreen() {
  const t = useTheme()

  const codes = [...new Set(COLLEGES.map((c) => c.stateCode))].sort((a, b) =>
    stateName(a).localeCompare(stateName(b)),
  )
  const rest = codes.filter((c) => c !== TELANGANA)
  const tsColleges = COLLEGES.filter((c) => c.stateCode === TELANGANA)
  const tsCount = new Set(tsColleges.map((c) => c.slug)).size

  return (
    <Screen title="State quota">
      <Surface style={{ gap: space.sm }}>
        <Text variant="bodyRegular" tone="secondary">
          About 85% of medical seats are filled by each state&apos;s own counselling, not by MCC.
          Those cutoffs use different categories and local-candidate rules, and none of them are
          in the app yet.
        </Text>
        <Text variant="bodySm" tone="muted">
          Everything live in the app today covers All India Quota only.
        </Text>
      </Surface>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">
          Next up
        </Text>
        <Surface style={{ gap: space.sm, borderColor: t.accent }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
            }}
          >
            <Feather name="map-pin" size={18} color={t.accentText} />
            <Text variant="h2" style={{ flex: 1 }}>
              Telangana
            </Text>
            <Badge label="Coming soon" tone="accent" />
          </View>

          <Text variant="bodySm" tone="secondary">
            KNRUHS competent-authority counselling for all {tsCount} Telangana colleges, with the
            same round-by-round history the All India list uses.
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingTop: space.sm,
              borderTopWidth: 1,
              borderTopColor: t.border,
            }}
          >
            <Text variant="caption" tone="muted">
              Will cost
            </Text>
            <Text variant="caption" tone="muted">
              {PRICE.stateQuota} credits per search
            </Text>
          </View>

          <Text variant="caption" tone="muted">
            Nothing is charged until it works. Your credits are safe in the meantime.
          </Text>
        </Surface>
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">
          {rest.length} more states in progress
        </Text>
        {rest.map((code) => (
          <Row key={code} code={code} />
        ))}
      </View>

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          Until a state is live, check its own counselling authority directly. We would rather show
          nothing than show a cutoff we cannot stand behind.
        </Text>
      </Surface>
    </Screen>
  )
}

function Row({ code }: { code: string }) {
  const t = useTheme()
  return (
    <Surface
      borderRadius={radius.sm}
      style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
    >
      <Feather name="map-pin" size={16} color={t.textMuted} />
      <Text variant="bodySm" style={{ flex: 1 }}>
        {stateName(code)}
      </Text>
      <Badge label="Working on it" tone="muted" />
    </Surface>
  )
}

function Badge({ label, tone }: { label: string; tone: "accent" | "muted" }) {
  const t = useTheme()
  return (
    <View
      style={{
        paddingHorizontal: space.sm,
        paddingVertical: 2,
        borderRadius: radius.sm,
        backgroundColor: t.surfaceAlt,
      }}
    >
      <Text variant="label" tone={tone}>
        {label}
      </Text>
    </View>
  )
}
