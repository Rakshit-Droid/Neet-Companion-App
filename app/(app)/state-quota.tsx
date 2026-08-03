import { View } from "react-native"
import { Feather } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { radius, space, useTheme } from "@/theme"
import { COLLEGES, stateName } from "@/lib/predictors"

/**
 * State-quota counselling is roughly 85% of all seats and is run by each state
 * separately from MCC. None of it is in the dataset yet, so this screen sets
 * expectations rather than pretending otherwise.
 */
const STATUS = {
  soon: { label: "Coming soon", tone: "accent" as const },
  progress: { label: "Working on it", tone: "muted" as const },
}

/** Telangana first: it is the one actually being worked on. */
const PRIORITY_STATES = ["TS"]

export default function StateQuotaScreen() {
  const t = useTheme()

  // Every state we have colleges for is a candidate for state-quota coverage.
  const codes = [...new Set(COLLEGES.map((c) => c.stateCode))].sort((a, b) =>
    stateName(a).localeCompare(stateName(b)),
  )
  const priority = codes.filter((c) => PRIORITY_STATES.includes(c))
  const rest = codes.filter((c) => !PRIORITY_STATES.includes(c))

  return (
    <Screen title="State quota">
      <Surface style={{ gap: space.sm }}>
        <Text variant="bodyRegular" tone="secondary">
          About 85% of medical seats are filled by each state&apos;s own counselling, not by MCC.
          Those cutoffs use different categories and local-candidate rules, and none of them are
          in the app yet.
        </Text>
        <Text variant="bodySm" tone="muted">
          Everything currently in the app covers All India Quota only.
        </Text>
      </Surface>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">
          Next up
        </Text>
        {priority.map((code) => (
          <Row key={code} code={code} status="soon" />
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">
          {rest.length} more states
        </Text>
        {rest.map((code) => (
          <Row key={code} code={code} status="progress" />
        ))}
      </View>

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          Until a state is live, check its own counselling authority directly. We would rather
          show nothing than show a cutoff we cannot stand behind.
        </Text>
      </Surface>
    </Screen>
  )
}

function Row({ code, status }: { code: string; status: keyof typeof STATUS }) {
  const t = useTheme()
  const s = STATUS[status]
  return (
    <Surface
      borderRadius={radius.sm}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        borderColor: status === "soon" ? t.accent : t.border,
      }}
    >
      <Feather
        name="map-pin"
        size={16}
        color={status === "soon" ? t.accentText : t.textMuted}
      />
      <Text variant="bodySm" style={{ flex: 1 }}>
        {stateName(code)}
      </Text>
      <View
        style={{
          paddingHorizontal: space.sm,
          paddingVertical: 2,
          borderRadius: radius.sm,
          backgroundColor: t.surfaceAlt,
        }}
      >
        <Text variant="label" tone={s.tone}>
          {s.label}
        </Text>
      </View>
    </Surface>
  )
}
