import { View } from "react-native"

import { radius, space, useTheme } from "@/theme"
import { Text } from "./Text"
import type { Tier } from "@/lib/predictors"

/**
 * The tier is the most decision-relevant token in a result row, so it gets a
 * filled chip on a three-step confidence scale rather than a neutral pill.
 */
export function TierBadge({ tier }: { tier: Tier }) {
  const t = useTheme()

  const { bg, tone } = {
    Safe: { bg: t.safeBg, tone: "safe" as const },
    Moderate: { bg: t.moderateBg, tone: "moderate" as const },
    Reach: { bg: t.reachBg, tone: "reach" as const },
  }[tier]

  return (
    <View
      style={{
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
        borderRadius: radius.sm,
        backgroundColor: bg,
      }}
    >
      <Text variant="label" tone={tone}>
        {tier}
      </Text>
    </View>
  )
}
