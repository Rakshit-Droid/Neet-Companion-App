import AsyncStorage from "@react-native-async-storage/async-storage"

import {
  LATEST_CUTOFF_YEAR,
  collegeBySlug,
  collegeDetail,
  type Category,
  type College,
  type Course,
} from "./predictors"

const KEY = "watchlist-v1"

/**
 * What a college's numbers looked like when it was added. Kept so the app can
 * show what has moved since, without a server.
 *
 * Honest limitation: the dataset is bundled, so these only change when a new
 * app version ships with refreshed cutoffs. This tracks "what changed since you
 * started watching", not live counselling.
 */
export interface WatchSnapshot {
  year: number
  category: Category
  course: Course
  /**
   * Which quota the snapshot came from. Needed to look up the round history for
   * this exact seat — the same college and course under a different quota is a
   * different cutoff entirely. Optional because entries saved before this field
   * existed have no value for it.
   */
  quota?: string
  closing: number
  seats: number
}

export interface WatchEntry {
  slug: string
  addedAt: number
  /** The rank the user had in mind, so we can say when a cutoff passes it. */
  rank: number | null
  snapshot: WatchSnapshot | null
}

export interface WatchStatus {
  entry: WatchEntry
  college: College
  current: WatchSnapshot | null
  /** Positive means the cutoff loosened since it was added. */
  change: number | null
  /** True when the cutoff has moved past the user's saved rank since adding. */
  nowReachable: boolean
}

async function readAll(): Promise<WatchEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as WatchEntry[]) : []
  } catch {
    return []
  }
}

async function writeAll(entries: WatchEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // Storage failures are not worth crashing a watchlist over.
  }
}

/** Headline numbers for a college right now, for the chosen category and course. */
export function snapshotOf(
  slug: string,
  category: Category = "UR",
  course?: Course,
): WatchSnapshot | null {
  const detail = collegeDetail(slug)
  if (!detail) return null

  const rows = detail.latest.filter(
    (c) => c.category === category && (!course || c.course === course),
  )
  const head = rows.sort((a, b) => a.closing - b.closing)[0]
  if (!head) return null

  return {
    year: head.year,
    category: head.category,
    course: head.course,
    quota: head.quota,
    closing: head.closing,
    seats: detail.seatsFor(head.category, head.course),
  }
}

export async function listWatches(): Promise<WatchStatus[]> {
  const entries = await readAll()
  const out: WatchStatus[] = []

  for (const entry of entries) {
    const college = collegeBySlug(entry.slug)
    if (!college) continue

    const current = snapshotOf(
      entry.slug,
      entry.snapshot?.category ?? "UR",
      entry.snapshot?.course,
    )
    const change =
      current && entry.snapshot ? current.closing - entry.snapshot.closing : null

    out.push({
      entry,
      college,
      current,
      change,
      nowReachable: Boolean(
        entry.rank &&
          current &&
          entry.snapshot &&
          entry.snapshot.closing < entry.rank &&
          current.closing >= entry.rank,
      ),
    })
  }

  return out.sort((a, b) => b.entry.addedAt - a.entry.addedAt)
}

export async function isWatched(slug: string): Promise<boolean> {
  return (await readAll()).some((e) => e.slug === slug)
}

export async function addWatch(
  slug: string,
  category: Category = "UR",
  course?: Course,
  rank?: number | null,
): Promise<void> {
  const entries = await readAll()
  if (entries.some((e) => e.slug === slug)) return
  entries.push({
    slug,
    addedAt: Date.now(),
    rank: rank ?? null,
    snapshot: snapshotOf(slug, category, course),
  })
  await writeAll(entries)
}

export async function removeWatch(slug: string): Promise<void> {
  await writeAll((await readAll()).filter((e) => e.slug !== slug))
}

export async function toggleWatch(
  slug: string,
  category: Category = "UR",
  course?: Course,
  rank?: number | null,
): Promise<boolean> {
  if (await isWatched(slug)) {
    await removeWatch(slug)
    return false
  }
  await addWatch(slug, category, course, rank)
  return true
}

export const WATCHLIST_YEAR = LATEST_CUTOFF_YEAR
