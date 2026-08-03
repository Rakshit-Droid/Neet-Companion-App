import { useState } from "react"
import { Pressable, View } from "react-native"
import { router } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Field } from "@/components/Field"
import { Button } from "@/components/Button"
import { space } from "@/theme"
import { authErrorMessage, isFirebaseConfigured, signUp } from "@/lib/auth"
import { NotConfiguredNotice } from "./sign-in"

const MIN_PASSWORD = 6

export default function SignUpScreen() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD
  const canSubmit =
    email.trim().length > 0 && password.length >= MIN_PASSWORD && !busy

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await signUp(email, password, name)
      router.replace("/account")
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Create account" back>
      {!isFirebaseConfigured ? <NotConfiguredNotice /> : null}

      <Surface style={{ gap: space.lg }}>
        <Field
          label="Name (optional)"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoCapitalize="words"
          autoComplete="name"
          editable={!busy}
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!busy}
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder={`At least ${MIN_PASSWORD} characters`}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!busy}
          hint={passwordTooShort ? undefined : "Use something you do not reuse elsewhere."}
          error={error ?? (passwordTooShort ? `At least ${MIN_PASSWORD} characters.` : undefined)}
        />
        <Button label="Create account" onPress={submit} disabled={!canSubmit} loading={busy} />
      </Surface>

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          Creating an account is optional. Browsing colleges, states and cutoffs works without
          one. By continuing you agree to our terms and privacy policy.
        </Text>
      </Surface>

      <View style={{ alignItems: "center" }}>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/sign-in")}>
          <Text variant="bodySm" tone="secondary">
            Already have an account? Sign in
          </Text>
        </Pressable>
      </View>
    </Screen>
  )
}
