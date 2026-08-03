import { router } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Field } from "@/components/Field"
import { Segmented } from "@/components/Segmented"
import { Button } from "@/components/Button"
import { space } from "@/theme"
import { useProfile } from "@/state/profile"
import {
  CATEGORIES,
  CATEGORY_LABEL,
  COURSES,
  REGIONS,
  STATES_BY_REGION,
  type Region,
} from "@/lib/predictors"

export default function ProfileScreen() {
  const { profile, update } = useProfile()

  const region: "None" | Region = profile.homeState
    ? ((REGIONS.find((r) => STATES_BY_REGION[r].includes(profile.homeState!)) ??
        "None") as Region)
    : "None"

  return (
    <Screen title="Your details" back>
      <Surface style={{ gap: space.lg }}>
        <Field
          label="All India Rank"
          value={profile.rank ? String(profile.rank) : ""}
          onChangeText={(v) => update({ rank: v ? Number(v) : null })}
          placeholder="Enter your AIR"
          keyboardType="number-pad"
          hint="Leave blank if results are not out yet."
        />
        <Segmented
          label="Category"
          options={CATEGORIES}
          value={profile.category}
          onChange={(c) => update({ category: c })}
          labelFor={(c) => CATEGORY_LABEL[c]}
          collapseAfter={5}
        />
        <Segmented
          label="Course"
          options={COURSES}
          value={profile.course}
          onChange={(c) => update({ course: c })}
        />
        <Segmented
          label="Preferred region"
          options={["None", ...REGIONS] as ("None" | Region)[]}
          value={region}
          onChange={(r) =>
            update({ homeState: r === "None" ? null : (STATES_BY_REGION[r][0] ?? null) })
          }
          collapseAfter={4}
        />
      </Surface>

      <Surface variant="outline">
        <Text variant="caption" tone="muted">
          Saved on this device and reused by every tool, so you never retype it. Preferred region
          only affects how your choice list is ordered, never which seats appear.
        </Text>
      </Surface>

      <Button label="Done" onPress={() => router.back()} />
    </Screen>
  )
}
