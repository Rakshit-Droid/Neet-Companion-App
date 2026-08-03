import { useState } from "react"
import { Pressable, View } from "react-native"
import { router } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Field } from "@/components/Field"
import { Button } from "@/components/Button"
import { space } from "@/theme"
import { authErrorMessage, isFirebaseConfigured, signIn } from "@/lib/auth"

export default function SignInScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
      router.replace("/account")
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Sign in" back>
      {!isFirebaseConfigured ? <NotConfiguredNotice /> : null}

      <Surface style={{ gap: space.lg }}>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          editable={!busy}
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!busy}
          error={error ?? undefined}
        />
        <Button label="Sign in" onPress={submit} disabled={!canSubmit} loading={busy} />
      </Surface>

      <View style={{ gap: space.sm, alignItems: "center" }}>
        <Pressable accessibilityRole="button" onPress={() => router.push("/forgot-password")}>
          <Text variant="bodySm" tone="accent">
            Forgot your password?
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/sign-up")}>
          <Text variant="bodySm" tone="secondary">
            No account yet? Create one
          </Text>
        </Pressable>
      </View>
    </Screen>
  )
}

export function NotConfiguredNotice() {
  return (
    <Surface variant="outline">
      <Text variant="caption" tone="moderate">
        Accounts are not switched on yet. The screens work, but sign-in needs the Firebase
        project to be created and its config added to app.json.
      </Text>
    </Surface>
  )
}
