import { useState } from "react"
import { Pressable, View } from "react-native"
import { router } from "expo-router"
import { Feather } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { ThemeToggle } from "@/components/ThemeToggle"
import { radius, space, useTheme } from "@/theme"
import { useSession } from "@/state/session"
import { signOut } from "@/lib/auth"

export default function AccountScreen() {
  const t = useTheme()
  const { user, signedIn, loading, available } = useSession()
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    setBusy(true)
    try {
      await signOut()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title={signedIn ? "Account" : "Your account"} back>
      {loading ? (
        <Surface>
          <Text variant="bodyRegular" tone="muted">
            Checking your session…
          </Text>
        </Surface>
      ) : signedIn ? (
        <>
          <Surface style={{ gap: space.xs }}>
            <Text variant="label" tone="muted">
              Signed in as
            </Text>
            <Text variant="body">{user?.displayName || user?.email}</Text>
            {user?.displayName && user.email ? (
              <Text variant="bodySm" tone="muted">
                {user.email}
              </Text>
            ) : null}
          </Surface>

          <Surface variant="outline">
            <Text variant="caption" tone="muted">
              Credits and purchase history will appear here once they are switched on.
            </Text>
          </Surface>

          <Button
            label="Sign out"
            variant="secondary"
            onPress={handleSignOut}
            loading={busy}
          />
        </>
      ) : (
        <>
          <Surface style={{ gap: space.sm }}>
            <Text variant="h2">Not signed in</Text>
            <Text variant="bodyRegular" tone="secondary">
              Everything you can see right now works without an account. Signing in is only
              needed for features that save something for you.
            </Text>
          </Surface>

          {available ? (
            <View style={{ gap: space.sm }}>
              <Button label="Create account" onPress={() => router.push("/sign-up")} />
              <Button
                label="Sign in"
                variant="secondary"
                onPress={() => router.push("/sign-in")}
              />
            </View>
          ) : (
            <Surface variant="outline">
              <Text variant="caption" tone="moderate">
                Accounts are not switched on yet.
              </Text>
            </Surface>
          )}
        </>
      )}

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">
          Saved
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open watchlist"
          onPress={() => router.push("/watchlist")}
        >
          {({ pressed }) => (
            <Surface
              borderRadius={radius.sm}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: pressed ? 0.7 : 1,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodySm">Watchlist</Text>
                <Text variant="caption" tone="muted">
                  Colleges you are tracking
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={t.textMuted} />
            </Surface>
          )}
        </Pressable>
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">
          Appearance
        </Text>
        <Surface
          borderRadius={radius.sm}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="bodySm">Theme</Text>
            <Text variant="caption" tone="muted">
              System, light or dark
            </Text>
          </View>
          <ThemeToggle />
        </Surface>
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">
          About
        </Text>
        <Surface borderRadius={radius.sm} style={{ gap: space.sm }}>
          <Row label="Cutoff data" value="MCC counselling, 2019 to 2025" />
          <View style={{ height: 1, backgroundColor: t.border }} />
          <Row label="Coverage" value="All India Quota only" />
        </Surface>
      </View>
    </Screen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.sm,
      }}
    >
      <Text variant="bodySm" tone="muted">
        {label}
      </Text>
      <Text variant="bodySm" style={{ flexShrink: 1, textAlign: "right" }}>
        {value}
      </Text>
    </View>
  )
}
