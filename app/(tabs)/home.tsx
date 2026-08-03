import { Linking, Pressable, View } from "react-native"
import { router } from "expo-router"
import { Feather } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { radius, space, useTheme } from "@/theme"
import {
  DISCLAIMER,
  FEATURES,
  HERO,
  OFFICIAL_LINKS,
  STEPS,
  TESTIMONIALS,
} from "@/content/marketing"
import {
  LATEST_CUTOFF_YEAR,
  PLATFORM_STATS,
  PLATFORM_TOP_STATES,
  formatIndian,
} from "@/lib/predictors"

export default function HomeScreen() {
  const t = useTheme()
  const topStates = PLATFORM_TOP_STATES()

  return (
    <Screen title={HERO.title} eyebrow={HERO.eyebrow}>
      <Text variant="bodyL" tone="secondary">
        {HERO.body}
      </Text>

      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Cta label="Predict my rank" onPress={() => router.push("/")} primary />
        <Cta label="Browse colleges" onPress={() => router.push("/colleges")} />
      </View>

      <Surface style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Metric value={formatIndian(PLATFORM_STATS.colleges)} label="Colleges" />
        <Metric value={String(PLATFORM_STATS.states)} label="States" />
        <Metric value={String(PLATFORM_STATS.courses)} label="Courses" />
        <Metric value={String(PLATFORM_STATS.years)} label="Years" />
      </Surface>

      <Section title="Everything you need">
        {FEATURES.map((f) => (
          <Pressable
            key={f.title}
            accessibilityRole={f.route ? "button" : "text"}
            accessibilityLabel={f.route ? f.cta : `${f.title}, coming soon`}
            disabled={!f.route}
            onPress={() => f.route && router.push(f.route as never)}
          >
            {({ pressed }) => (
              <Surface
                borderRadius={radius.sm}
                style={{ gap: space.xs, opacity: pressed ? 0.7 : f.soon ? 0.75 : 1 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <Feather name={f.icon} size={18} color={f.soon ? t.textMuted : t.accentText} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {f.title}
                  </Text>
                  {f.soon ? (
                    <View
                      style={{
                        paddingHorizontal: space.sm,
                        paddingVertical: 2,
                        borderRadius: radius.sm,
                        backgroundColor: t.surfaceAlt,
                      }}
                    >
                      <Text variant="label" tone="muted">
                        Soon
                      </Text>
                    </View>
                  ) : (
                    <Feather name="arrow-right" size={16} color={t.accentText} />
                  )}
                </View>
                <Text variant="bodySm" tone="muted">
                  {f.body}
                </Text>
              </Surface>
            )}
          </Pressable>
        ))}
      </Section>

      <Section title="How it works">
        <Surface style={{ gap: space.base }}>
          {STEPS.map((s, i) => (
            <View
              key={s.n}
              style={{
                flexDirection: "row",
                gap: space.base,
                paddingTop: i === 0 ? 0 : space.base,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: t.border,
              }}
            >
              <Text variant="displayL" tone="accent" style={{ fontSize: 22, lineHeight: 26 }}>
                {s.n}
              </Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body">{s.title}</Text>
                <Text variant="bodySm" tone="muted">
                  {s.body}
                </Text>
              </View>
            </View>
          ))}
        </Surface>
      </Section>

      <Section title="Most colleges by state">
        <Surface style={{ gap: space.sm }}>
          {topStates.map((s, i) => (
            <Pressable
              key={s.slug}
              accessibilityRole="button"
              accessibilityLabel={`Open ${s.state}`}
              onPress={() => router.push(`/state/${s.slug}`)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: i === 0 ? 0 : space.sm,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: t.border,
              }}
            >
              <Text variant="bodySm">{s.state}</Text>
              <Text variant="h2">{s.count}</Text>
            </Pressable>
          ))}
        </Surface>
      </Section>

      <Section title="What students say">
        {TESTIMONIALS.map((q) => (
          <Surface key={q.name} borderRadius={radius.sm} style={{ gap: space.sm }}>
            <Text variant="bodyRegular" tone="secondary">
              “{q.quote}”
            </Text>
            <Text variant="caption" tone="muted">
              {q.name}, {q.detail}
            </Text>
          </Surface>
        ))}
      </Section>

      <Section title="Official sources">
        <Surface style={{ gap: space.sm }}>
          {OFFICIAL_LINKS.map((l, i) => (
            <Pressable
              key={l.url}
              accessibilityRole="link"
              accessibilityLabel={`Open ${l.label}`}
              onPress={() => Linking.openURL(l.url).catch(() => {})}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: i === 0 ? 0 : space.sm,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: t.border,
              }}
            >
              <Text variant="bodySm">{l.label}</Text>
              <Feather name="external-link" size={15} color={t.textMuted} />
            </Pressable>
          ))}
        </Surface>
      </Section>

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          {DISCLAIMER} Cutoffs cover MCC counselling through {LATEST_CUTOFF_YEAR}; state-quota
          seats are run separately and are not included.
        </Text>
      </Surface>
    </Screen>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" tone="muted">
        {title}
      </Text>
      {children}
    </View>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Text variant="displayL" style={{ fontSize: 24, lineHeight: 28 }}>
        {value}
      </Text>
      <Text variant="label" tone="muted">
        {label}
      </Text>
    </View>
  )
}

function Cta({
  label,
  onPress,
  primary = false,
}: {
  label: string
  onPress: () => void
  primary?: boolean
}) {
  const t = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.sm,
        borderWidth: 1,
        backgroundColor: primary ? t.accent : "transparent",
        borderColor: primary ? t.accent : t.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text variant="label" tone={primary ? "onAccent" : "default"}>
        {label}
      </Text>
    </Pressable>
  )
}
