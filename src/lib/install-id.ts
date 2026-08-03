import * as SecureStore from "expo-secure-store"
import * as Crypto from "expo-crypto"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform } from "react-native"

const KEY = "install-id"

/**
 * Stable per-install identifier. Used to meter anonymous free searches and, later,
 * to block one obvious referral self-award (same device claiming its own code).
 *
 * It is not a security boundary: reinstalling issues a new one. SecureStore is
 * used where available simply because it survives more cases than AsyncStorage;
 * web has no SecureStore so it falls back.
 */
let cached: string | null = null

async function read(): Promise<string | null> {
  if (Platform.OS === "web") return AsyncStorage.getItem(KEY)
  return SecureStore.getItemAsync(KEY)
}

async function write(value: string): Promise<void> {
  if (Platform.OS === "web") return AsyncStorage.setItem(KEY, value)
  return SecureStore.setItemAsync(KEY, value)
}

export async function getInstallId(): Promise<string> {
  if (cached) return cached
  try {
    const existing = await read()
    if (existing) {
      cached = existing
      return existing
    }
    const fresh = Crypto.randomUUID()
    await write(fresh)
    cached = fresh
    return fresh
  } catch {
    // Storage unavailable: fall back to a per-session id rather than crashing.
    cached = cached ?? Crypto.randomUUID()
    return cached
  }
}
