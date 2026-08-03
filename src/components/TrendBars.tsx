import { View } from "react-native"

import { radius, space, useTheme } from "@/theme"
import { Text } from "./Text"
import { formatIndian } from "@/lib/predictors"

interface TrendBarsProps {
  points: { year: number; closing: number }[]
}

/**
 * Closing-rank history as bars. Rank is inverted: a *lower* rank is better, so
 * the bar is drawn proportional to how good the rank was, not to its magnitude.
 * Plain views rather than a chart library keeps the bundle and render cheap.
 */
export function TrendBars({ points }: TrendBarsProps) {
  const t = useTheme()
  if (points.length === 0) return null

  const max = Math.max(...points.map((p) => p.closing))
  const min = Math.min(...points.map((p) => p.closing))
  const span = Math.max(1, max - min)

  return (
    <View style={{ gap: space.sm }}>
      {points.map((p) => {
        // Best year fills the row, worst keeps a visible stub.
        const share = 0.25 + 0.75 * (1 - (p.closing - min) / span)
        const isBest = p.closing === min
        return (
          <View key={p.year} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Text variant="label" tone="muted" style={{ width: 34 }}>
              {p.year}
            </Text>
            <View
              style={{
                flex: 1,
                height: 22,
                borderRadius: radius.sm,
                backgroundColor: t.surfaceAlt,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${share * 100}%`,
                  height: "100%",
                  borderRadius: radius.sm,
                  backgroundColor: isBest ? t.accent : t.border,
                }}
              />
            </View>
            <Text variant="caption" tone={isBest ? "accent" : "muted"} style={{ width: 62, textAlign: "right" }}>
              {formatIndian(p.closing)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
