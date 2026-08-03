import { useEffect, useState } from "react"
import { Modal, Pressable, View } from "react-native"
import { router } from "expo-router"
import Feather from "@expo/vector-icons/Feather"
import AsyncStorage from "@react-native-async-storage/async-storage"

import { Text } from "./Text"
import { Button } from "./Button"
import { layout, radius, space, useTheme } from "@/theme"
import { useSession } from "@/state/session"
import { REFERRAL_HEADLINE, REFERRAL_TERMS } from "@/lib/referrals"
import { PACK_PRICE_INR } from "@/lib/credits"

/**
 * Shown once per account, the first time they land in the app after signing in.
 *
 * Once, not every launch: a referral prompt that reappears is an advert, and the
 * dismissal is recorded per uid so a second account on the same device still
 * sees it. Opening the referral screen counts as dismissing it — they have the
 * information either way.
 */
const KEY = (uid: string) => `referral-prompt-seen-v1:${uid}`

export function ReferralPrompt() {
  const t = useTheme()
  const { signedIn, user } = useSession()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!signedIn || !user) {
      setOpen(false)
      return
    }
    AsyncStorage.getItem(KEY(user.uid)).then((seen) => {
      if (!cancelled && !seen) setOpen(true)
    })
    return () => {
      cancelled = true
    }
  }, [signedIn, user])

  async function dismiss(then?: () => void) {
    setOpen(false)
    if (user) await AsyncStorage.setItem(KEY(user.uid), String(Date.now()))
    then?.()
  }

  if (!open) return null

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => dismiss()}
      accessibilityViewIsModal
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={() => dismiss()}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        {/* Swallows taps so pressing inside the sheet does not dismiss it. */}
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: t.bg,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: space.lg,
            gap: space.base,
            maxWidth: layout.proseMaxWidth,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.pill,
                backgroundColor: t.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="gift" size={18} color={t.onAccent} />
            </View>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text variant="h2">{REFERRAL_HEADLINE}</Text>
              <Text variant="bodySm" tone="secondary">
                When a friend signs up with your code and buys their first ₹{PACK_PRICE_INR} pack.
              </Text>
            </View>
          </View>

          <View style={{ gap: space.xs }}>
            {REFERRAL_TERMS.map((line) => (
              <View key={line} style={{ flexDirection: "row", gap: space.sm }}>
                <Text variant="caption" tone="muted">
                  •
                </Text>
                <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                  {line}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ gap: space.sm }}>
            <Button
              label="Get my code"
              onPress={() => dismiss(() => router.push("/referrals"))}
            />
            <Button label="Not now" variant="secondary" onPress={() => dismiss()} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
