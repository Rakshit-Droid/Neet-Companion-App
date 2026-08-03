import AsyncStorage from "@react-native-async-storage/async-storage"

/**
 * Stops the same search being billed twice.
 *
 * Why this exists: the choice list used to recompute on every keystroke. At 2
 * credits a search that is roughly 48 rupees a minute of typing. Charging is now
 * tied to an explicit button, and this adds the second guard — re-running an
 * identical query is free for a day, so going back to tweak one filter and
 * returning to a previous combination does not cost again.
 */

const KEY = (uid: string) => `billed-searches-v1:${uid}`
const WINDOW_MS = 24 * 60 * 60 * 1000

type Billed = Record<string, number>

async function read(uid: string): Promise<Billed> {
  const raw = await AsyncStorage.getItem(KEY(uid))
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as Billed) : {}
  } catch {
    return {}
  }
}

/** True when this exact query was already paid for inside the window. */
export async function wasRecentlyBilled(uid: string, fingerprint: string): Promise<boolean> {
  const billed = await read(uid)
  const at = billed[fingerprint]
  return typeof at === "number" && Date.now() - at < WINDOW_MS
}

export async function markBilled(uid: string, fingerprint: string): Promise<void> {
  const billed = await read(uid)
  const now = Date.now()

  // Drop expired keys on write so the record cannot grow without bound.
  const fresh: Billed = { [fingerprint]: now }
  for (const [k, at] of Object.entries(billed)) {
    if (now - at < WINDOW_MS) fresh[k] = at
  }
  await AsyncStorage.setItem(KEY(uid), JSON.stringify(fresh))
}
