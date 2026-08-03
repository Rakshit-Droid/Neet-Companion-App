import { useState } from "react"
import { TextInput, View, type KeyboardTypeOptions } from "react-native"

import { layout, radius, space, type as typeScale, useTheme } from "@/theme"
import { Text } from "./Text"

interface FieldProps {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  keyboardType?: KeyboardTypeOptions
  suffix?: string
  hint?: string
  error?: string
}

/** Label above, hint or error below. Focus is a 2px accent border, not a glow. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "number-pad",
  suffix,
  hint,
  error,
}: FieldProps) {
  const t = useTheme()
  const [focused, setFocused] = useState(false)

  const borderColor = error ? t.reach : focused ? t.accent : t.border

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>

      <View
        style={{
          height: layout.inputHeight,
          borderRadius: radius.sm,
          backgroundColor: t.bg,
          borderWidth: focused || error ? 2 : 1,
          borderColor,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: space.base,
          gap: space.sm,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.textMuted}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[typeScale.bodyL, { flex: 1, color: t.text, paddingVertical: 0 }]}
        />
        {suffix ? (
          <Text variant="label" tone="muted" numberOfLines={1} style={{ flexShrink: 0 }}>
            {suffix}
          </Text>
        ) : null}
      </View>

      {error ? (
        <Text variant="caption" tone="reach">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  )
}
