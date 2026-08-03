import AsyncStorage from "@react-native-async-storage/async-storage"

import { isFirebaseConfigured } from "./firebase"
import type { AuthUser } from "./auth-types"

/**
 * A stand-in for Firebase Auth so the account-gated screens can be exercised
 * before the Firebase project exists.
 *
 * SECURITY: this is a backdoor. It accepts a hardcoded password and keeps
 * credentials in plaintext, so it must never run in a shipped build. Two
 * independent guards prevent that:
 *
 *   __DEV__               false in every release build (expo export, EAS)
 *   !isFirebaseConfigured false the moment real config lands in app.json
 *
 * Either alone disables it. The second flips as soon as the Firebase config is
 * pasted in, so this dies on its own rather than waiting for someone to
 * remember to delete it.
 */
export const isMockAuthEnabled = __DEV__ && !isFirebaseConfigured

/** Seeded account, shown on the sign-in screen while the mock is active. */
export const MOCK_EMAIL = "dev@neetcompanion.test"
export const MOCK_PASSWORD = "devpass123"

const USERS_KEY = "mock-auth-users-v1"
const SESSION_KEY = "mock-auth-session-v1"

interface MockRecord {
  uid: string
  email: string
  password: string
  displayName: string | null
}

/** Carries a Firebase-shaped `code` so authErrorMessage maps it unchanged. */
class MockAuthError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.name = "MockAuthError"
    this.code = code
  }
}

const listeners = new Set<(user: AuthUser | null) => void>()
let current: AuthUser | null = null
let restored: Promise<void> | null = null

function publicUser(rec: MockRecord): AuthUser {
  return {
    uid: rec.uid,
    email: rec.email,
    displayName: rec.displayName,
    emailVerified: true,
  }
}

function normalise(email: string): string {
  return email.trim().toLowerCase()
}

async function readUsers(): Promise<MockRecord[]> {
  const raw = await AsyncStorage.getItem(USERS_KEY)
  const stored: MockRecord[] = raw ? safeParse(raw) : []

  // The seeded account is re-added rather than written once, so clearing storage
  // or bumping the key never leaves the documented credentials broken.
  if (!stored.some((u) => u.email === MOCK_EMAIL)) {
    stored.push({
      uid: "mock-dev-user",
      email: MOCK_EMAIL,
      password: MOCK_PASSWORD,
      displayName: "Dev User",
    })
  }
  return stored
}

function safeParse(raw: string): MockRecord[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeUsers(users: MockRecord[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function emit(): void {
  for (const cb of listeners) cb(current)
}

async function setSession(user: AuthUser | null): Promise<void> {
  current = user
  if (user) await AsyncStorage.setItem(SESSION_KEY, user.uid)
  else await AsyncStorage.removeItem(SESSION_KEY)
  emit()
}

/** Restores the persisted session once; later calls await the same promise. */
function restoreOnce(): Promise<void> {
  if (restored) return restored
  restored = (async () => {
    const uid = await AsyncStorage.getItem(SESSION_KEY)
    if (!uid) return
    const users = await readUsers()
    const rec = users.find((u) => u.uid === uid)
    current = rec ? publicUser(rec) : null
  })()
  return restored
}

export async function mockSignIn(email: string, password: string): Promise<AuthUser> {
  if (!email.trim()) throw new MockAuthError("auth/invalid-email")
  if (!password) throw new MockAuthError("auth/missing-password")

  const users = await readUsers()
  const rec = users.find((u) => u.email === normalise(email))

  // One error for both branches, matching the real provider: never reveal
  // whether an account exists.
  if (!rec || rec.password !== password) throw new MockAuthError("auth/invalid-credential")

  const user = publicUser(rec)
  await setSession(user)
  return user
}

export async function mockSignUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthUser> {
  const normalised = normalise(email)
  if (!normalised.includes("@")) throw new MockAuthError("auth/invalid-email")
  if (password.length < 6) throw new MockAuthError("auth/weak-password")

  const users = await readUsers()
  if (users.some((u) => u.email === normalised)) {
    throw new MockAuthError("auth/email-already-in-use")
  }

  const rec: MockRecord = {
    uid: `mock-${Date.now().toString(36)}`,
    email: normalised,
    password,
    displayName: displayName?.trim() || null,
  }
  users.push(rec)
  await writeUsers(users)

  const user = publicUser(rec)
  await setSession(user)
  return user
}

/** No mailbox to send to, so this only validates and resolves. */
export async function mockSendReset(email: string): Promise<void> {
  if (!normalise(email).includes("@")) throw new MockAuthError("auth/invalid-email")
}

export async function mockSignOut(): Promise<void> {
  await setSession(null)
}

export function mockWatchAuth(cb: (user: AuthUser | null) => void): () => void {
  listeners.add(cb)
  // Mirrors onAuthStateChanged: always fires once with the restored session.
  restoreOnce().then(() => cb(current))
  return () => {
    listeners.delete(cb)
  }
}

/** Obviously fake on sight, so it can never be mistaken for a real credential. */
export async function mockGetIdToken(): Promise<string | null> {
  await restoreOnce()
  return current ? `mock-id-token:${current.uid}` : null
}

/** Test-only reset of module state; storage is cleared by the caller. */
export function __resetMockAuthForTests(): void {
  listeners.clear()
  current = null
  restored = null
}
