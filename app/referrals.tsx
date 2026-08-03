import { useCallback, useState } from "react"
import { Pressable, Share, View } from "react-native"
import { router, useFocusEffect } from "expo-router"
import Feather from "@expo/vector-icons/Feather"
import * as Clipboard from "expo-clipboard"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { radius, space, useTheme } from "@/theme"
import { useSession } from "@/state/session"
import {
  REFERRAL_HEADLINE,
  REFERRAL_TERMS,
  claimReferralCode,
  referralsBy,
  type Referral,
} from "@/lib/referrals"
import { CREDITS_PER_PACK, PACK_PRICE_INR, REFERRAL_REWARD } from "@/lib/credits"

export default function ReferralsScreen() {
  const t = useTheme()
  const { signedIn, user } = useSession()
  const [code, setCode] = useState<string | null>(null)
  const [friends, setFriends] = useState<Referral[]>([])
  const [copied, setCopied] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      if (!user) return
      ;(async () => {
        const c = await claimReferralCode(user.uid)
        const list = await referralsBy(user.uid)
        if (cancelled) return
        setCode(c)
        setFriends(list)
      })()
      return () => {
        cancelled = true
      }
    }, [user]),
  )

  const settled = friends.filter((f) => f.settledAt !== null)

  async function copy() {
    if (!code) return
    await Clipboard.setStringAsync(code)
    setCopied(true)
  }

  async function share() {
    if (!code) return
    await Share.share({
      message:
        `I'm using NEET Companion to build my counselling choice list from real MCC cutoffs. ` +
        `Use my code ${code} when you sign up.`,
    })
  }

  if (!signedIn) {
    return (
      <Screen title="Refer a friend" back>
        <Surface style={{ gap: space.sm }}>
          <Text variant="h2">Sign in first</Text>
          <Text variant="bodyRegular" tone="secondary">
            Your referral code belongs to your account.
          </Text>
          <Button label="Sign in or create account" onPress={() => router.push("/sign-in")} />
        </Surface>
      </Screen>
    )
  }

  return (
    <Screen title="Refer a friend" back>
      <Surface variant="accent" style={{ alignItems: "center", gap: space.xs }}>
        <Text variant="label" tone="onAccent">
          {REFERRAL_HEADLINE}
        </Text>
        <Text variant="bodySm" tone="onAccent" style={{ textAlign: "center" }}>
          When they buy their first ₹{PACK_PRICE_INR} pack.
        </Text>
      </Surface>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">
          Your code
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Copy code" onPress={copy}>
          {({ pressed }) => (
            <Surface
              style={{
                alignItems: "center",
                gap: space.xs,
                opacity: pressed ? 0.7 : 1,
                borderColor: t.accent,
              }}
            >
              <Text variant="displayL" style={{ letterSpacing: 4 }}>
                {code ?? "…"}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
                <Feather name={copied ? "check" : "copy"} size={13} color={t.textMuted} />
                <Text variant="caption" tone="muted">
                  {copied ? "Copied" : "Tap to copy"}
                </Text>
              </View>
            </Surface>
          )}
        </Pressable>
        <Button label="Share code" onPress={share} />
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">
          Friends you brought in
        </Text>
        <Surface style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Stat label="Signed up" value={friends.length} />
            <Stat label="Bought a pack" value={settled.length} />
            <Stat label="Credits earned" value={settled.length * REFERRAL_REWARD} accent />
          </View>
          {friends.length === 0 ? (
            <Text variant="caption" tone="muted">
              Nobody yet. Share your code to get started.
            </Text>
          ) : settled.length === 0 ? (
            <Text variant="caption" tone="muted">
              {friends.length === 1 ? "Your friend has" : "Your friends have"} signed up but not
              bought a pack yet, so nothing has paid out.
            </Text>
          ) : null}
        </Surface>
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">
          Terms
        </Text>
        <Surface borderRadius={radius.sm} style={{ gap: space.sm }}>
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
        </Surface>
        <Text variant="caption" tone="muted">
          A pack is {CREDITS_PER_PACK} credits for ₹{PACK_PRICE_INR}.
        </Text>
      </View>
    </Screen>
  )
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="h2" tone={accent ? "accent" : undefined}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  )
}
