import { useState } from "react"
import { Platform, Pressable, View } from "react-native"
import * as Haptics from "expo-haptics"

import { layout, radius, space, useTheme } from "@/theme"
import { Text } from "./Text"

interface SegmentedProps<T extends string> {
  label?: string
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  /** Maps a raw value to display text, e.g. the MCC code "UR" to "General". */
  labelFor?: (option: T) => string
  /**
   * Show only the first N options behind a "more" chip. Used for categories,
   * where the five PwD variants would otherwise add two rows to the form.
   */
  collapseAfter?: number
}

function tap() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }
}

/** Selection is a solid accent fill, readable at a glance across the form. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  labelFor,
  collapseAfter,
}: SegmentedProps<T>) {
  const t = useTheme()
  const [expanded, setExpanded] = useState(false)

  const hiddenCount =
    collapseAfter === undefined ? 0 : Math.max(0, options.length - collapseAfter)
  const selectionHidden =
    hiddenCount > 0 && options.indexOf(value) >= (collapseAfter ?? 0)
  const showAll = hiddenCount === 0 || expanded || selectionHidden
  const visible = showAll ? options : options.slice(0, collapseAfter)

  const chipStyle = {
    paddingHorizontal: space.base,
    minHeight: layout.touchMin,
    justifyContent: "center" as const,
    borderRadius: radius.pill,
    borderWidth: 1,
  }

  return (
    <View style={{ gap: space.sm }}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {visible.map((option) => {
          const selected = option === value
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                tap()
                onChange(option)
              }}
              style={({ pressed }) => [
                chipStyle,
                {
                  backgroundColor: selected ? t.accent : t.surface,
                  borderColor: selected ? t.accent : t.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text variant="label" tone={selected ? "onAccent" : "secondary"}>
                {labelFor ? labelFor(option) : option}
              </Text>
            </Pressable>
          )
        })}

        {hiddenCount > 0 && !selectionHidden ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              expanded ? "Show fewer options" : `Show ${hiddenCount} more options`
            }
            onPress={() => {
              tap()
              setExpanded((v) => !v)
            }}
            style={({ pressed }) => [
              chipStyle,
              {
                backgroundColor: "transparent",
                borderColor: t.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text variant="label" tone="accent">
              {expanded ? "Less" : `+${hiddenCount} more`}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
