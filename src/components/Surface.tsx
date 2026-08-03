import type { ReactNode } from "react"
import { View, type ViewStyle, type StyleProp } from "react-native"

import { radius, space, useTheme } from "@/theme"

interface SurfaceProps {
  children?: ReactNode
  /**
   * `card` is the default grouping block. `accent` is a solid brand fill used
   * sparingly for the single most important number on a screen. `outline` is
   * the lightest grouping, a hairline only.
   */
  variant?: "card" | "accent" | "outline" | "plain"
  borderRadius?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Flat by construction: no shadow, no elevation. Separation comes from fill and
 * a hairline border, which is what keeps long lists cheap to render.
 */
export function Surface({
  children,
  variant = "card",
  borderRadius = radius.md,
  style,
}: SurfaceProps) {
  const t = useTheme()

  const base: ViewStyle = {
    borderRadius,
    padding: space.base,
  }

  const byVariant: Record<NonNullable<SurfaceProps["variant"]>, ViewStyle> = {
    card: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border },
    accent: { backgroundColor: t.accent },
    outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: t.border },
    plain: { backgroundColor: "transparent", padding: 0 },
  }

  return <View style={[base, byVariant[variant], style]}>{children}</View>
}
