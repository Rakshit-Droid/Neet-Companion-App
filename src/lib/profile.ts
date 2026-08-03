import AsyncStorage from "@react-native-async-storage/async-storage"

import { CATEGORIES, COURSES, type Category, type Course } from "./predictors"

const KEY = "profile-v1"

/**
 * The candidate's own details, entered once and reused everywhere.
 *
 * Before this, rank and category were local state on each screen, so the same
 * three facts were retyped on every visit and nothing survived a restart.
 */
/** What the candidate optimises for. Drives the choice-ordering weights. */
export const PRIORITIES = ["Balanced", "Top colleges", "Near home", "Government"] as const
export type Priority = (typeof PRIORITIES)[number]

export interface Profile {
  rank: number | null
  category: Category
  course: Course
  /** State code, used to weight choice ordering toward home. */
  homeState: string | null
  priority: Priority
}

export const EMPTY_PROFILE: Profile = {
  rank: null,
  category: "UR",
  course: "MBBS",
  homeState: null,
  priority: "Balanced",
}

function sanitise(raw: unknown): Profile {
  if (!raw || typeof raw !== "object") return EMPTY_PROFILE
  const p = raw as Partial<Profile>
  return {
    rank:
      typeof p.rank === "number" && Number.isFinite(p.rank) && p.rank > 0
        ? Math.round(p.rank)
        : null,
    // Guard against a stored value that a later release no longer supports.
    category: CATEGORIES.includes(p.category as Category)
      ? (p.category as Category)
      : EMPTY_PROFILE.category,
    course: COURSES.includes(p.course as Course)
      ? (p.course as Course)
      : EMPTY_PROFILE.course,
    homeState: typeof p.homeState === "string" && p.homeState ? p.homeState : null,
    priority: PRIORITIES.includes(p.priority as Priority)
      ? (p.priority as Priority)
      : EMPTY_PROFILE.priority,
  }
}

export async function loadProfile(): Promise<Profile> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    return raw ? sanitise(JSON.parse(raw)) : EMPTY_PROFILE
  } catch {
    return EMPTY_PROFILE
  }
}

export async function saveProfile(profile: Profile): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(sanitise(profile)))
  } catch {
    // A failed profile write is not worth interrupting the user over.
  }
}

export function isComplete(profile: Profile): boolean {
  return profile.rank !== null
}
