import {
  ActivityIndicator,
  Platform,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import * as Haptics from "expo-haptics"

import { layout, radius, space, useTheme } from "@/theme"
import { Text } from "./Text"

interface ButtonProps {
  label: string
  onPress?: () => void
  variant?: "accent" | "secondary"
  disabled?: boolean
  /** Shows a spinner and blocks presses, so a slow request cannot be double-fired. */
  loading?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Flat fill, immediate press feedback. No shadow and no scale spring: the
 * touch-first system reads state through colour, so feedback is instant.
 */
export function Button({
  label,
  onPress,
  variant = "accent",
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const t = useTheme()
  const blocked = disabled || loading

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      onPressIn={() => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        }
      }}
      style={({ pressed }) => [
        {
          height: layout.buttonHeight,
          paddingHorizontal: space.lg,
          borderRadius: radius.sm,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          backgroundColor: variant === "accent" ? t.accent : t.surface,
          borderColor: variant === "accent" ? t.accent : t.border,
          opacity: blocked ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "accent" ? t.onAccent : t.text} />
      ) : (
        <Text variant="h2" tone={variant === "accent" ? "onAccent" : "default"}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}
