import { Platform, Pressable, View, useWindowDimensions } from "react-native"
import { Feather } from "@expo/vector-icons"
import { router, usePathname } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Haptics from "expo-haptics"

import { layout, radius, space, useTheme } from "@/theme"
import { Text } from "./Text"

export interface NavItem {
  href: string
  label: string
  icon: keyof typeof Feather.glyphMap
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/aiq", label: "All India", icon: "target" },
  { href: "/state-quota", label: "State quota", icon: "map-pin" },
  { href: "/watchlist", label: "Watchlist", icon: "bookmark" },
]

/** Tablets and landscape get a rail; phones get bottom tabs. */
export const WIDE_BREAKPOINT = 768

export function useIsWide(): boolean {
  const { width } = useWindowDimensions()
  return width >= WIDE_BREAKPOINT
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname === "/index"
  return pathname.startsWith(href)
}

function tap() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }
}

/**
 * Bottom bar for phones. Deliberately not a drawer: on Android a drawer hides
 * navigation behind a hamburger and puts it out of thumb reach.
 */
export function BottomNav() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const pathname = usePathname()

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
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Pressable
            key={item.href}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            onPress={() => {
              if (active) return
              tap()
              router.replace(item.href as never)
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: layout.touchMin,
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              paddingVertical: space.sm,
              borderTopWidth: 2,
              borderTopColor: active ? t.accent : "transparent",
              marginTop: -1,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Feather
              name={item.icon}
              size={20}
              color={active ? t.accentText : t.textMuted}
            />
            <Text
              variant="label"
              tone={active ? "accent" : "muted"}
              numberOfLines={1}
              style={{ fontSize: 9, letterSpacing: 0.6 }}
            >
              {item.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Persistent left rail for tablets and wide windows. */
export function SideNav() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const pathname = usePathname()

  return (
    <View
      style={{
        width: 232,
        backgroundColor: t.bg,
        borderRightWidth: 1,
        borderRightColor: t.border,
        paddingTop: insets.top + space.lg,
        paddingBottom: insets.bottom + space.base,
        paddingHorizontal: space.sm,
        gap: space.xs,
      }}
    >
      <Text variant="h2" style={{ paddingHorizontal: space.sm, marginBottom: space.base }}>
        NEET Companion
      </Text>

      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Pressable
            key={item.href}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            onPress={() => {
              if (active) return
              tap()
              router.replace(item.href as never)
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
              minHeight: layout.touchMin,
              paddingHorizontal: space.sm,
              borderRadius: radius.sm,
              backgroundColor: active ? t.accent : "transparent",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Feather
              name={item.icon}
              size={18}
              color={active ? t.onAccent : t.textMuted}
            />
            <Text variant="bodySm" tone={active ? "onAccent" : "secondary"}>
              {item.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
