import { View } from "react-native"
import { Slot } from "expo-router"

import { BottomNav, SideNav, useIsWide } from "@/components/AppNav"
import { useTheme } from "@/theme"

/**
 * Responsive shell. A left rail where there is width, bottom tabs on phones.
 * Built on Slot rather than Tabs because Tabs pins its bar to the bottom, which
 * makes a side rail impossible without fighting the layout.
 */
export default function AppLayout() {
  const t = useTheme()
  const wide = useIsWide()

  if (wide) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: t.bg }}>
        <SideNav />
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      <BottomNav />
    </View>
  )
}
