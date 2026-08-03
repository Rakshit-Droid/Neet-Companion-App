import { Text as RNText, type TextProps as RNTextProps } from "react-native"

import { useTheme, type as typeScale } from "@/theme"

type Variant = keyof typeof typeScale
type Tone =
  | "default"
  | "secondary"
  | "muted"
  | "accent"
  | "safe"
  | "moderate"
  | "reach"
  | "onAccent"

interface TextProps extends RNTextProps {
  variant?: Variant
  tone?: Tone
}

/** Every tone clears WCAG AA on its surface in both schemes. */
export function Text({ variant = "bodyRegular", tone = "default", style, ...rest }: TextProps) {
  const t = useTheme()

  const color = {
    default: t.text,
    secondary: t.textSecondary,
    muted: t.textMuted,
    accent: t.accentText,
    safe: t.safe,
    moderate: t.moderate,
    reach: t.reach,
    onAccent: t.onAccent,
  }[tone]

  return <RNText style={[typeScale[variant], { color }, style]} {...rest} />
}
