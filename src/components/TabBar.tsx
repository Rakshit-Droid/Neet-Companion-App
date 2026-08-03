import { Platform, Pressable, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
// expo-router vendors react-navigation rather than depending on it directly.
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { layout, space, useTheme } from "@/theme"
import { Text } from "./Text"

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  index: "target",
  colleges: "home",
  states: "map",
  "choice-filling": "list",
}

/**
 * Solid bar anchored to the edge, not a floating pill. The active tab is marked
 * by an accent rule plus accent icon and label, so it reads without elevation.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.bg,
        borderTopWidth: 1,
        borderTopColor: t.border,
        paddingBottom: insets.bottom,
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index
        const { options } = descriptors[route.key]!
        const label =
          typeof options.tabBarLabel === "string" ? options.tabBarLabel : route.name

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              })
              if (focused || event.defaultPrevented) return
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
              }
              navigation.navigate(route.name)
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: layout.touchMin,
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              paddingTop: space.sm,
              paddingBottom: space.sm,
              borderTopWidth: 2,
              borderTopColor: focused ? t.accent : "transparent",
              marginTop: -1,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Feather
              name={ICONS[route.name] ?? "circle"}
              size={20}
              color={focused ? t.accentText : t.textMuted}
            />
            <Text
              variant="label"
              tone={focused ? "accent" : "muted"}
              numberOfLines={1}
              style={{ fontSize: 9, letterSpacing: 0.6 }}
            >
              {label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
