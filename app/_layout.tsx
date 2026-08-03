import { useEffect } from "react"
import { View } from "react-native"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useFonts } from "expo-font"
import * as SplashScreen from "expo-splash-screen"
// Imported one weight at a time. The package barrel re-exports every weight and
// italic, and Expo bundles every font it can reach from an import — that alone
// was shipping ~6MB of Inter for the three faces this app actually renders.
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular"
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium"
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold"

import { ThemeProvider, useTheme } from "@/theme"
import { SessionProvider } from "@/state/session"
import { ProfileProvider } from "@/state/profile"
import { CreditsProvider } from "@/state/credits"

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const [loaded, error] = useFonts({
    "Quantico-Regular": require("../assets/fonts/Quantico/Quantico-Regular.ttf"),
    "Quantico-Bold": require("../assets/fonts/Quantico/Quantico-Bold.ttf"),
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  })

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {})
  }, [loaded, error])

  if (!loaded && !error) return null

  return (
    <ThemeProvider>
      <SessionProvider>
        <ProfileProvider>
          <CreditsProvider>
            <ThemedStack />
          </CreditsProvider>
        </ProfileProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}

/** Split out so it can read the theme from inside the provider. */
function ThemedStack() {
  const t = useTheme()

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
          animation: "fade",
        }}
      />
    </View>
  )
}
