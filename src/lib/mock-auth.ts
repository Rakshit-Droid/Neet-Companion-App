import AsyncStorage from "@react-native-async-storage/async-storage"

import { isFirebaseConfigured } from "./firebase"
import type { AuthUser } from "./auth-types"

/**
 * A stand-in for Firebase Auth so the account-gated screens can be exercised
 * before the Firebase project exists.
 *
 * SECURITY: this is a backdoor. It accepts a hardcoded password and keeps
 * credentials in plaintext. It runs only when BOTH of these hold:
 *
 *   1. the build is a dev build, or EXPO_PUBLIC_ALLOW_DEV_AUTH is explicitly
 *      set to "1" at build time
 *   2. Firebase is not configured
 *
 * Condition 2 is the one that matters most: the moment real Firebase config
 * lands in app.json this dies regardless of any flag, so it cannot outlive its
 * purpose or be left on by accident.
 *
 * The env flag exists so a staging deploy can be signed into before Firebase is
 * ready. It defaults to off, and turning it on means publishing a known
 * password on whatever URL that build is served from. Never set it on a
 * deployment that has real users.
 *
 * Note on what "disabled" means: the strings and functions below still ship in
 * the bundle when this is off — Metro does not eliminate them across module
 * boundaries — but nothing can reach them, because signIn() and friends in
 * auth.ts branch on isMockAuthEnabled first. The password is documented in the
 * README anyway; it is a throwaway local account, not a secret.
 */
const allowInDeployedBuild = process.env.EXPO_PUBLIC_ALLOW_DEV_AUTH === "1"

export const isMockAuthEnabled = (__DEV__ || allowInDeployedBuild) && !isFirebaseConfigured

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

// -- magic link ---------------------------------------------------------------

/**
 * There is no mailbox, so the "sent" link is handed straight back for the screen
 * to show. That makes the flow walkable end to end — request, follow, land
 * signed in — without waiting on Firebase.
 */
const MOCK_LINK_PREFIX = "neetcompanion://magic-link?token="

export async function mockSendMagicLink(email: string): Promise<{ devLink: string }> {
  const address = normalise(email)
  if (!address.includes("@")) throw new MockAuthError("auth/invalid-email")

  const users = await readUsers()
  if (!users.some((u) => u.email === address)) {
    // Email-link sign-in creates the account if it does not exist, matching
    // Firebase. The password is unreachable — this account signs in by link.
    users.push({
      uid: `mock-${Date.now().toString(36)}`,
      email: address,
      password: `link-only-${Date.now().toString(36)}`,
      displayName: null,
    })
    await writeUsers(users)
  }
  return { devLink: MOCK_LINK_PREFIX + encodeURIComponent(address) }
}

export function mockIsMagicLink(url: string): boolean {
  return url.startsWith(MOCK_LINK_PREFIX)
}

export async function mockCompleteMagicLink(url: string, email: string): Promise<AuthUser> {
  if (!mockIsMagicLink(url)) throw new MockAuthError("auth/invalid-action-code")

  const token = decodeURIComponent(url.slice(MOCK_LINK_PREFIX.length))
  // The link is bound to the address it was issued for, so a link for one
  // account cannot be redeemed against another.
  if (token !== normalise(email)) throw new MockAuthError("auth/invalid-action-code")

  const users = await readUsers()
  const rec = users.find((u) => u.email === token)
  if (!rec) throw new MockAuthError("auth/invalid-action-code")

  const user = publicUser(rec)
  await setSession(user)
  return user
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
