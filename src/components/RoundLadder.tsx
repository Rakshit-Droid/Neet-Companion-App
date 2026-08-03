import { View } from "react-native"

import { Text } from "./Text"
import { radius, space, useTheme } from "@/theme"
import { formatIndian } from "@/lib/predictors"
import { VERDICT_LABEL, type RoundEvidence, type RoundVerdict } from "@/lib/rounds"

/**
 * A seat's counselling rounds in order, with the evidence behind each verdict
 * rather than only the verdict. A call resting on one year has to read
 * differently from one resting on seven, or the confident word does all the
 * talking. Deliberately no percentage: see the header of src/lib/rounds.ts.
 */
export function RoundLadder({ rounds }: { rounds: RoundEvidence[] }) {
  return (
    <View style={{ gap: space.xs }}>
      {rounds.map((r) => (
        <RoundRow key={r.round} evidence={r} />
      ))}
    </View>
  )
}

function RoundRow({ evidence }: { evidence: RoundEvidence }) {
  const t = useTheme()
  const tone = VERDICT_TONE[evidence.verdict]

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      <Text variant="caption" tone="muted" style={{ flex: 1 }}>
        {evidence.round}
      </Text>

      {evidence.spread ? (
        <Text variant="caption" tone="muted">
          {formatIndian(evidence.spread.worst)}–{formatIndian(evidence.spread.best)}
          {evidence.n === 1 ? " (1 yr)" : ` (${evidence.n} yrs)`}
        </Text>
      ) : null}

      <View
        style={{
          paddingHorizontal: space.sm,
          paddingVertical: 1,
          borderRadius: radius.sm,
          backgroundColor: verdictBg(t, evidence.verdict),
          minWidth: 70,
          alignItems: "center",
        }}
      >
        <Text variant="label" tone={tone}>
          {VERDICT_LABEL[evidence.verdict]}
        </Text>
      </View>
    </View>
  )
}

const VERDICT_TONE: Record<RoundVerdict, "safe" | "moderate" | "reach" | "muted"> = {
  clear: "safe",
  likely: "safe",
  contested: "moderate",
  unlikely: "reach",
  "no-data": "muted",
}

function verdictBg(t: ReturnType<typeof useTheme>, verdict: RoundVerdict): string {
  switch (verdict) {
    case "clear":
    case "likely":
      return t.safeBg
    case "contested":
      return t.moderateBg
    case "unlikely":
      return t.reachBg
    default:
      return t.surfaceAlt
  }
}
