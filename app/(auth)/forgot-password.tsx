import { useState } from "react"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Field } from "@/components/Field"
import { Button } from "@/components/Button"
import { space } from "@/theme"
import { authErrorMessage, isAuthAvailable, sendReset } from "@/lib/auth"
import { NotConfiguredNotice } from "./sign-in"

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!isAuthAvailable || !email.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await sendReset(email)
      setSent(true)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Reset password" back>
      {!isAuthAvailable ? <NotConfiguredNotice /> : null}

      {sent ? (
        <Surface style={{ gap: space.sm }}>
          <Text variant="h2">Check your email</Text>
          <Text variant="bodyRegular" tone="secondary">
            If an account exists for {email.trim()}, a reset link is on its way. It expires
            after a short while, so use it soon.
          </Text>
        </Surface>
      ) : (
        <Surface style={{ gap: space.lg }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!busy}
            error={error ?? undefined}
          />
          <Button
            label="Send reset link"
            onPress={submit}
            disabled={!email.trim() || busy}
            loading={busy}
          />
        </Surface>
      )}
    </Screen>
  )
}
