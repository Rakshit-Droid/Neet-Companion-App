import AsyncStorage from "@react-native-async-storage/async-storage"

import { setReferralStore, type ReferralState, type ReferralStore } from "./referrals"

/**
 * Persistent referral backend, kept apart from referrals.ts so that module stays
 * importable in plain node for tests. This is the file a server replaces.
 *
 * Honest limitation: codes and attributions live on one device, so a code can
 * only be redeemed on the device that issued it until this moves server-side.
 * The seam exists precisely so that move is a one-file change.
 */

const KEY = "referrals-v1"
const EMPTY: ReferralState = { owners: {}, referrals: {} }

export const asyncStorageReferrals: ReferralStore = {
  async read() {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return EMPTY
    try {
      const parsed = JSON.parse(raw) as Partial<ReferralState>
      return {
        owners: parsed?.owners ?? {},
        referrals: parsed?.referrals ?? {},
      }
    } catch {
      return EMPTY
    }
  },
  async write(state) {
    await AsyncStorage.setItem(KEY, JSON.stringify(state))
  },
}

/** Called once at startup, before any code is claimed or resolved. */
export function installPersistentReferrals(): void {
  setReferralStore(asyncStorageReferrals)
}
