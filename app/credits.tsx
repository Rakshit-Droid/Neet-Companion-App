import { useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { radius, space, useTheme } from "@/theme"
import { useSession } from "@/state/session"
import { useCredits } from "@/state/credits"
import {
  CREDITS_PER_PACK,
  PACK_PRICE_INR,
  PRICE,
  REASON_LABEL,
  SIGNUP_GRANT,
  type LedgerEntry,
} from "@/lib/credits"

export default function CreditsScreen() {
  const t = useTheme()
  const { signedIn, user } = useSession()
  const { balance, ledger, buyPack } = useCredits()
  const [busy, setBusy] = useState(false)

  async function handleBuy() {
    if (!user) return
    setBusy(true)
    try {
      // A real purchase is keyed on the store's transaction id. Until Play
      // Billing lands there is no transaction, so each press is its own.
      await buyPack(`dev-purchase:${user.uid}:${Date.now()}`)
    } finally {
      setBusy(false)
    }
  }

  if (!signedIn) {
    return (
      <Screen title="Credits" back>
        <Surface style={{ gap: space.sm }}>
          <Text variant="h2">Sign in first</Text>
          <Text variant="bodyRegular" tone="secondary">
            Credits belong to an account, so they follow you rather than the device.
          </Text>
          <Button label="Sign in or create account" onPress={() => router.push("/sign-in")} />
        </Surface>
      </Screen>
    )
  }

  return (
    <Screen title="Credits" back>
      <Surface style={{ alignItems: "center", gap: space.xs }}>
        <Text variant="displayL" tone="accent">
          {balance}
        </Text>
        <Text variant="label" tone="muted">
          credits available
        </Text>
      </Surface>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">
          Top up
        </Text>
        <Surface style={{ gap: space.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <Text variant="h2">{CREDITS_PER_PACK} credits</Text>
            <Text variant="h2" tone="accent">
              ₹{PACK_PRICE_INR}
            </Text>
          </View>
          <Text variant="bodySm" tone="muted">
            {CREDITS_PER_PACK / PRICE.search} choice lists. Credits never expire.
          </Text>
          <Button
            label={`Buy for ₹${PACK_PRICE_INR}`}
            onPress={handleBuy}
            loading={busy}
            disabled={busy}
          />
        </Surface>
        <Surface variant="outline">
          <Text variant="caption" tone="moderate">
            Payments are not connected yet. This button grants the credits directly so the rest of
            the app can be used; Google Play Billing replaces it before launch.
          </Text>
        </Surface>
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">
          What things cost
        </Text>
        <Surface borderRadius={radius.sm} style={{ gap: space.sm }}>
          <PriceRow label="Build a choice list" cost={PRICE.search} />
          <Divider />
          <PriceRow label="Add a college to your watchlist" cost={PRICE.watchlist} />
          <Divider />
          <PriceRow label="State quota search" cost={PRICE.stateQuota} />
          <Divider />
          <PriceRow label="Welcome credits on signup" cost={-SIGNUP_GRANT} />
        </Surface>
        <Text variant="caption" tone="muted">
          Repeating an identical search within 24 hours is not charged again.
        </Text>
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">
          History
        </Text>
        {ledger.length === 0 ? (
          <Surface>
            <Text variant="bodySm" tone="muted">
              Nothing yet.
            </Text>
          </Surface>
        ) : (
          <Surface borderRadius={radius.sm} style={{ gap: space.sm }}>
            {ledger.map((entry, i) => (
              <View key={entry.id} style={{ gap: space.sm }}>
                {i > 0 ? <Divider /> : null}
                <LedgerRow entry={entry} />
              </View>
            ))}
          </Surface>
        )}
      </View>

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          Every credit in and out is recorded, so this list always adds up to your balance. Nothing
          is deducted without a line here.
        </Text>
      </Surface>
    </Screen>
  )
}

function Divider() {
  const t = useTheme()
  return <View style={{ height: 1, backgroundColor: t.border }} />
}

function PriceRow({ label, cost }: { label: string; cost: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        gap: space.sm,
      }}
    >
      <Text variant="bodySm" tone="muted" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodySm" tone={cost < 0 ? "safe" : undefined}>
        {cost < 0 ? `+${-cost}` : `${cost}`}
      </Text>
    </View>
  )
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const positive = entry.delta > 0
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: space.sm,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="bodySm">{REASON_LABEL[entry.reason]}</Text>
        <Text variant="caption" tone="muted">
          {formatWhen(entry.createdAt)}
        </Text>
      </View>
      <Text variant="body" tone={positive ? "safe" : "muted"}>
        {positive ? "+" : ""}
        {entry.delta}
      </Text>
    </View>
  )
}

function formatWhen(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}
