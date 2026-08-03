import { useState } from "react"
import { Pressable, View } from "react-native"
import { router } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Field } from "@/components/Field"
import { Button } from "@/components/Button"
import { space } from "@/theme"
import {
  authErrorMessage,
  isAuthAvailable,
  isMockAuthEnabled,
  MOCK_EMAIL,
  MOCK_PASSWORD,
  signIn,
} from "@/lib/auth"

export default function SignInScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // No point letting them submit into a provider that cannot sign anyone in:
  // the button would just return a red error every time.
  const canSubmit =
    isAuthAvailable && email.trim().length > 0 && password.length > 0 && !busy

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
      // Back to the app, not the account screen: signing in is nearly always a
      // step towards a gated tool rather than the destination.
      router.replace("/")
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Sign in" back>
      {isMockAuthEnabled ? (
        <DevCredentialsNotice
          onFill={() => {
            setEmail(MOCK_EMAIL)
            setPassword(MOCK_PASSWORD)
            setError(null)
          }}
        />
      ) : !isAuthAvailable ? (
        <NotConfiguredNotice />
      ) : null}

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

/**
 * Only ever rendered while the dev mock is active, which cannot happen in a
 * release build. Printing the password is the point: it is a throwaway local
 * account, not a credential.
 */
function DevCredentialsNotice({ onFill }: { onFill: () => void }) {
  return (
    <Surface variant="outline" style={{ gap: space.sm }}>
      <Text variant="label" tone="moderate">
        Development sign-in
      </Text>
      <Text variant="caption" tone="muted">
        Firebase is not wired up yet, so accounts are stored on this device only.
        Use {MOCK_EMAIL} with the password {MOCK_PASSWORD}, or create any account
        you like — it works the same way.
      </Text>
      <Button label="Fill test credentials" variant="secondary" onPress={onFill} />
    </Surface>
  )
}

export function NotConfiguredNotice() {
  return (
    <Surface variant="outline" style={{ gap: space.xs }}>
      <Text variant="caption" tone="moderate">
        Accounts are not switched on in this build. Sign-in needs the Firebase project to be
        created and its six config values added to app.json.
      </Text>
      <Text variant="caption" tone="muted">
        Everything else works. Run the app locally to sign in with a test account in the
        meantime.
      </Text>
    </Surface>
  )
}
