import { useEffect, useState } from "react"
import { Pressable, View } from "react-native"
import { router } from "expo-router"
import * as Linking from "expo-linking"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Field } from "@/components/Field"
import { Button } from "@/components/Button"
import { space } from "@/theme"
import {
  MagicLinkEmailNeededError,
  authErrorMessage,
  completeMagicLink,
  isAuthAvailable,
  isMagicLink,
  isMockAuthEnabled,
  pendingMagicLinkEmail,
  sendMagicLink,
} from "@/lib/auth"
import { NotConfiguredNotice } from "./sign-in"

/**
 * Sign in with a link instead of a password. Useful for a cohort that reuses
 * passwords across every site and forgets them anyway.
 */
export default function MagicLinkScreen() {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [devLink, setDevLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Set when a link arrived but this device does not know whose it is. */
  const [confirming, setConfirming] = useState<string | null>(null)

  const canSubmit = isAuthAvailable && email.trim().length > 0 && !busy

  // The continue URL points back at this route, so an arriving link lands here
  // and is completed in place rather than dumping the user on a request form
  // they have already filled in.
  const incoming = Linking.useURL()

  useEffect(() => {
    let cancelled = false
    if (!incoming || !isAuthAvailable || !isMagicLink(incoming)) return
    ;(async () => {
      setBusy(true)
      try {
        const known = await pendingMagicLinkEmail()
        await completeMagicLink(incoming, known ?? undefined)
        if (!cancelled) router.replace("/")
      } catch (err) {
        if (cancelled) return
        // Opened on a different device from the one that asked: Firebase needs
        // the address as well as the link, so it has to be re-entered.
        if (err instanceof MagicLinkEmailNeededError) setConfirming(incoming)
        else setError(authErrorMessage(err))
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [incoming])

  async function confirmEmail() {
    if (!confirming || !email.trim()) return
    setBusy(true)
    setError(null)
    try {
      await completeMagicLink(confirming, email)
      router.replace("/")
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const result = await sendMagicLink(email)
      setDevLink(result.devLink ?? null)
      setSent(true)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  /** Development only: no mailbox exists, so the link is followed in place. */
  async function followDevLink() {
    if (!devLink) return
    setBusy(true)
    setError(null)
    try {
      await completeMagicLink(devLink, email)
      router.replace("/")
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Sign in with a link" back>
      {!isAuthAvailable ? <NotConfiguredNotice /> : null}

      {confirming ? (
        <Surface style={{ gap: space.lg }}>
          <Text variant="h2">Confirm your email</Text>
          <Text variant="bodyRegular" tone="secondary">
            This link was opened on a different device from the one that requested it. Enter the
            address it was sent to and you are in.
          </Text>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={confirmEmail}
            editable={!busy}
            error={error ?? undefined}
          />
          <Button
            label="Sign in"
            onPress={confirmEmail}
            disabled={!email.trim() || busy}
            loading={busy}
          />
        </Surface>
      ) : sent ? (
        <>
          <Surface style={{ gap: space.sm }}>
            <Text variant="h2">Check your email</Text>
            <Text variant="bodyRegular" tone="secondary">
              If an account can be created or found for {email.trim()}, a sign-in link is on its
              way. Open it on this device and you will be signed straight in.
            </Text>
            <Text variant="caption" tone="muted">
              The link works once and expires. Requesting another cancels the previous one.
            </Text>
          </Surface>

          {devLink ? (
            <Surface variant="outline" style={{ gap: space.sm }}>
              <Text variant="label" tone="moderate">
                Development
              </Text>
              <Text variant="caption" tone="muted">
                No email was actually sent — Firebase is not connected yet. Follow the link here
                instead.
              </Text>
              <Button label="Open the link" onPress={followDevLink} loading={busy} />
              {error ? (
                <Text variant="caption" tone="reach">
                  {error}
                </Text>
              ) : null}
            </Surface>
          ) : null}

          <Button
            label="Use a different email"
            variant="secondary"
            onPress={() => {
              setSent(false)
              setDevLink(null)
            }}
          />
        </>
      ) : (
        <>
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
              hint="No password needed. We email you a link that signs you in."
            />
            <Button
              label="Email me a link"
              onPress={submit}
              disabled={!canSubmit}
              loading={busy}
            />
          </Surface>

          {isMockAuthEnabled ? (
            <Surface variant="outline">
              <Text variant="caption" tone="moderate">
                Firebase is not connected, so nothing is emailed. The link appears on the next
                screen for you to follow.
              </Text>
            </Surface>
          ) : null}

          <View style={{ alignItems: "center" }}>
            <Pressable accessibilityRole="button" onPress={() => router.replace("/sign-in")}>
              <Text variant="bodySm" tone="secondary">
                Use a password instead
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </Screen>
  )
}
