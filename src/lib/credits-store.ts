import AsyncStorage from "@react-native-async-storage/async-storage"

import { setLedgerStore, type LedgerEntry, type LedgerStore } from "./credits"

/**
 * Persistent ledger backend, kept apart from credits.ts so that module stays
 * importable in plain node for tests. This is the file Firestore replaces.
 */

const KEY = (uid: string) => `ledger-v1:${uid}`

export const asyncStorageLedger: LedgerStore = {
  async read(uid) {
    const raw = await AsyncStorage.getItem(KEY(uid))
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as LedgerEntry[]) : []
    } catch {
      // Corrupt storage reads as empty rather than throwing: a broken ledger
      // should not make the app unusable.
      return []
    }
  },
  async write(uid, entries) {
    await AsyncStorage.setItem(KEY(uid), JSON.stringify(entries))
  },
}

/** Called once at startup, before anything reads a balance. */
export function installPersistentLedger(): void {
  setLedgerStore(asyncStorageLedger)
}
