import { useState } from "react"
import {
  Pressable,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native"
import { Feather } from "@expo/vector-icons"

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
  secureTextEntry?: boolean
  autoCapitalize?: TextInputProps["autoCapitalize"]
  autoComplete?: TextInputProps["autoComplete"]
  textContentType?: TextInputProps["textContentType"]
  returnKeyType?: TextInputProps["returnKeyType"]
  onSubmitEditing?: TextInputProps["onSubmitEditing"]
  editable?: boolean
}

/** Label above, hint or error below. Focus is a 2px accent border, not a glow. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  // Default is deliberately the plain keyboard. It used to be "number-pad",
  // which silently gave every text field a numeric keypad.
  keyboardType = "default",
  suffix,
  hint,
  error,
  secureTextEntry,
  autoCapitalize = "none",
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  editable = true,
}: FieldProps) {
  const t = useTheme()
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const borderColor = error ? t.reach : focused ? t.accent : t.border
  // Only masked fields get a reveal toggle, and revealing it un-masks the input.
  const masked = Boolean(secureTextEntry) && !revealed

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
          secureTextEntry={masked}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            typeScale.bodyL,
            { flex: 1, color: t.text, paddingVertical: 0, opacity: editable ? 1 : 0.5 },
          ]}
        />
        {suffix ? (
          <Text variant="label" tone="muted" numberOfLines={1} style={{ flexShrink: 0 }}>
            {suffix}
          </Text>
        ) : null}

        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            accessibilityState={{ selected: revealed }}
            // The row is only inputHeight tall, so the tap target is widened
            // with hitSlop rather than by making the field taller.
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
            onPress={() => setRevealed((v) => !v)}
            style={({ pressed }) => ({ flexShrink: 0, opacity: pressed ? 0.6 : 1 })}
          >
            <Feather
              name={revealed ? "eye-off" : "eye"}
              size={18}
              color={revealed ? t.accentText : t.textMuted}
            />
          </Pressable>
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
