import { Platform, Pressable, type StyleProp, type ViewStyle } from "react-native"
import * as Haptics from "expo-haptics"

import { layout, radius, space, useTheme } from "@/theme"
import { Text } from "./Text"

interface ButtonProps {
  label: string
  onPress?: () => void
  variant?: "accent" | "secondary"
  disabled?: boolean
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
  style,
}: ButtonProps) {
  const t = useTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
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
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text variant="h2" tone={variant === "accent" ? "onAccent" : "default"}>
        {label}
      </Text>
    </Pressable>
  )
}
