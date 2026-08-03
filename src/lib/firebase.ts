import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import {
  initializeAuth,
  getAuth,
  type Auth,
} from "firebase/auth"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import { Platform } from "react-native"

// This file and src/lib/auth.ts are the ONLY places allowed to import from
// firebase/*. Everything else goes through the auth wrapper, so swapping the
// JS SDK for react-native-firebase later (needed if we add phone OTP) is a
// two-file change rather than a codebase-wide one.

interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

const extra = (Constants.expoConfig?.extra ?? {}) as { firebase?: Partial<FirebaseConfig> }
const cfg = extra.firebase ?? {}

/** False until the Firebase project exists and its config is in app.json. */
export const isFirebaseConfigured =
  Boolean(cfg.apiKey) && Boolean(cfg.appId) && Boolean(cfg.projectId)

let app: FirebaseApp | null = null
let auth: Auth | null = null

/**
 * Persistence matters more than it looks: without an AsyncStorage-backed
 * persistence layer the SDK silently falls back to in-memory, and every user is
 * signed out on cold start.
 */
function initAuth(instance: FirebaseApp): Auth {
  if (Platform.OS === "web") return getAuth(instance)

  // getReactNativePersistence is exported at runtime but has historically been
  // missing from the published types, hence the cast rather than a plain import.
  const { getReactNativePersistence } = require("firebase/auth") as {
    getReactNativePersistence?: (storage: unknown) => unknown
  }

  if (!getReactNativePersistence) return getAuth(instance)

  return initializeAuth(instance, {
    persistence: getReactNativePersistence(AsyncStorage),
  } as Parameters<typeof initializeAuth>[1])
}

/** Returns null when Firebase is not configured, so the app still runs. */
export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured) return null
  if (auth) return auth

  app = getApps().length ? getApp() : initializeApp(cfg as FirebaseConfig)
  try {
    auth = initAuth(app)
  } catch {
    // initializeAuth throws if called twice on the same app.
    auth = getAuth(app)
  }
  return auth
}
