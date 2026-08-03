import { useState } from "react"
import { Pressable, View } from "react-native"
import { router } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Field } from "@/components/Field"
import { Button } from "@/components/Button"
import { space } from "@/theme"
import { authErrorMessage, isAuthAvailable, signUp } from "@/lib/auth"
import { recordReferral } from "@/lib/referrals"
import { SIGNUP_GRANT } from "@/lib/credits"
import { NotConfiguredNotice } from "./sign-in"

const MIN_PASSWORD = 6

export default function SignUpScreen() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [referral, setReferral] = useState("")
  const [referralNote, setReferralNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD
  const canSubmit =
    isAuthAvailable && email.trim().length > 0 && password.length >= MIN_PASSWORD && !busy

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const user = await signUp(email, password, name)

      // A bad code must not cost someone their account: the signup has already
      // succeeded by this point, so attribution failing is reported, not thrown.
      if (referral.trim()) {
        const attempt = await recordReferral(user.uid, referral)
        if (attempt.status === "unknownCode") {
          setReferralNote("That referral code was not recognised, so it was not applied.")
        }
      }
      router.replace("/")
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Create account" back>
      {!isAuthAvailable ? <NotConfiguredNotice /> : null}

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
        <Field
          label="Referral code (optional)"
          value={referral}
          onChangeText={(v) => {
            setReferral(v)
            setReferralNote(null)
          }}
          placeholder="From a friend"
          autoCapitalize="characters"
          editable={!busy}
          hint={referralNote ?? "Your friend earns credits when you buy your first pack."}
        />
        <Button label="Create account" onPress={submit} disabled={!canSubmit} loading={busy} />
      </Surface>

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          You start with {SIGNUP_GRANT} free credits, enough for your first few choice lists. By
          continuing you agree to our terms and privacy policy.
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
