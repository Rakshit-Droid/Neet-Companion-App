import { useCallback, useState } from "react"
import { Pressable, View } from "react-native"
import { useFocusEffect } from "expo-router"
import { Feather } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { radius, space, useTheme } from "@/theme"
import { CATEGORY_LABEL, LATEST_CUTOFF_YEAR, formatIndian } from "@/lib/predictors"
import { listWatches, removeWatch, type WatchStatus } from "@/lib/watchlist"
import { RoundLadder } from "@/components/RoundLadder"
import { roundEvidence } from "@/lib/rounds"
import { useProfile } from "@/state/profile"

export default function WatchlistScreen() {
  const t = useTheme()
  const { profile } = useProfile()
  const [items, setItems] = useState<WatchStatus[] | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    listWatches().then((v) => {
      if (!cancelled) setItems(v)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Re-read on focus so removing a college elsewhere is reflected here.
  useFocusEffect(load)

  async function drop(slug: string) {
    await removeWatch(slug)
    setItems((prev) => prev?.filter((i) => i.college.slug !== slug) ?? null)
  }

  return (
    <Screen title="Watchlist" back>
      {items === null ? (
        <Surface>
          <Text variant="bodyRegular" tone="muted">
            Loading…
          </Text>
        </Surface>
      ) : items.length === 0 ? (
        <Surface style={{ gap: space.sm }}>
          <Text variant="h2">Nothing watched yet</Text>
          <Text variant="bodyRegular" tone="secondary">
            Open any college and tap Watch. We record its cutoff at that moment, so you can see
            what has moved since.
          </Text>
        </Surface>
      ) : (
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">
            {items.length} {items.length === 1 ? "college" : "colleges"}
          </Text>

          {items.map((item) => (
            <Surface key={item.college.slug} borderRadius={radius.sm} style={{ gap: space.xs }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: space.sm,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="body">{item.college.name}</Text>
                  <Text variant="bodySm" tone="muted">
                    {item.college.state}, {item.college.type}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Stop watching ${item.college.name}`}
                  hitSlop={8}
                  onPress={() => drop(item.college.slug)}
                >
                  <Feather name="x" size={18} color={t.textMuted} />
                </Pressable>
              </View>

              {item.current ? (
                <View
                  style={{
                    marginTop: space.xs,
                    paddingTop: space.sm,
                    borderTopWidth: 1,
                    borderTopColor: t.border,
                    gap: 2,
                  }}
                >
                  <Text variant="caption" tone="muted">
                    {CATEGORY_LABEL[item.current.category]}, {item.current.course},{" "}
                    {LATEST_CUTOFF_YEAR}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      gap: space.sm,
                    }}
                  >
                    <Text variant="h2">{formatIndian(item.current.closing)}</Text>
                    {item.change ? (
                      <Text variant="caption" tone={item.change > 0 ? "safe" : "reach"}>
                        {item.change > 0 ? "+" : ""}
                        {formatIndian(item.change)} since you added it
                      </Text>
                    ) : (
                      <Text variant="caption" tone="muted">
                        unchanged since you added it
                      </Text>
                    )}
                  </View>
                </View>
              ) : null}

              {/* The point of watching: how this seat behaves as counselling
                  moves through its rounds, judged against your saved rank. */}
              {profile.rank && item.current?.quota ? (
                <View
                  style={{
                    marginTop: space.xs,
                    paddingTop: space.sm,
                    borderTopWidth: 1,
                    borderTopColor: t.border,
                    gap: space.xs,
                  }}
                >
                  <Text variant="label" tone="muted">
                    Rounds at AIR {formatIndian(profile.rank)}
                  </Text>
                  <RoundLadder
                    rounds={roundEvidence(
                      item.college.slug,
                      item.current.category,
                      item.current.course,
                      item.current.quota,
                      profile.rank,
                    )}
                  />
                </View>
              ) : null}

              {item.nowReachable ? (
                <Surface
                  variant="plain"
                  style={{ backgroundColor: t.safeBg, padding: space.sm, borderRadius: radius.sm }}
                >
                  <Text variant="caption" tone="safe">
                    This cutoff has moved past your rank since you added it.
                  </Text>
                </Surface>
              ) : null}
            </Surface>
          ))}
        </View>
      )}

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          Cutoffs are bundled with the app, so watched colleges update when a new version ships
          with refreshed MCC data, not live during counselling. Always check mcc.nic.in for the
          current round.
        </Text>
      </Surface>
    </Screen>
  )
}
