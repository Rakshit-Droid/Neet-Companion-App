import { Tabs } from "expo-router"

import { TabBar } from "@/components/TabBar"
import { useTheme } from "@/theme"

export default function TabsLayout() {
  const t = useTheme()

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ tabBarLabel: "Home" }} />
      <Tabs.Screen name="index" options={{ tabBarLabel: "Predict" }} />
      <Tabs.Screen name="colleges" options={{ tabBarLabel: "Colleges" }} />
      <Tabs.Screen name="states" options={{ tabBarLabel: "States" }} />
      <Tabs.Screen name="choice-filling" options={{ tabBarLabel: "Choices" }} />
    </Tabs>
  )
}
