import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"

import { getIdToken } from "./auth"

/**
 * Fires the product emails — welcome, low credits, watchlist pausing, referral
 * paid.
 *
 * These are triggered from the app rather than a server because the events that
 * cause them only exist here: credits, the watchlist and referrals all live on
 * the device. The endpoint sends to whatever address the ID token belongs to, so
 * a user can only ever email themselves.
 *
 * Sending is best-effort and never blocks or fails the action that caused it.
 * Nobody should lose a purchase because an email did not go out.
 */

export type ProductEmail = "welcome" | "creditsLow" | "watchExpiring" | "referralPaid"

/** How often each may be sent. Matches the rules in emails/README.md. */
const EVERY: Record<ProductEmail, number> = {
  welcome: Number.POSITIVE_INFINITY, // once per account, ever
  creditsLow: 7 * 24 * 60 * 60 * 1000,
  watchExpiring: 7 * 24 * 60 * 60 * 1000,
  referralPaid: 0, // keyed per referred friend, so each payout is its own event
}

const KEY = (uid: string, type: ProductEmail, tag: string) =>
  `product-email-v1:${uid}:${type}${tag ? `:${tag}` : ""}`

function apiBase(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string }
  return extra.apiBaseUrl ?? "https://neet-companion-app-five.vercel.app"
}

/**
 * True when enough time has passed since the last send of this kind.
 *
 * A balance sitting just under the threshold would otherwise email on every
 * single check, which is the fastest way to get a sending domain marked as spam.
 */
async function due(uid: string, type: ProductEmail, tag: string): Promise<boolean> {
  const gap = EVERY[type]
  if (gap === 0) {
    // Keyed events: send once per tag and never again for that tag.
    return (await AsyncStorage.getItem(KEY(uid, type, tag))) === null
  }
  const last = await AsyncStorage.getItem(KEY(uid, type, tag))
  if (last === null) return true
  const at = Number(last)
  if (!Number.isFinite(at)) return true
  return Date.now() - at >= gap
}

/**
 * Sends one, if it is due.
 *
 * `tag` separates events that repeat for different subjects — a referral payout
 * is per friend, so it carries the friend's id and each one sends once.
 */
export async function sendProductEmail(
  uid: string,
  type: ProductEmail,
  data: Record<string, unknown> = {},
  tag = "",
): Promise<void> {
  try {
    if (!(await due(uid, type, tag))) return

    const idToken = await getIdToken()
    if (!idToken) return

    const res = await fetch(`${apiBase()}/api/product-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, type, data }),
    })
    // Only record a send that actually happened, so a failure retries next time
    // rather than silently swallowing the notice for a week.
    if (res.ok) await AsyncStorage.setItem(KEY(uid, type, tag), String(Date.now()))
  } catch {
    // Best effort. The caller's action has already succeeded.
  }
}
