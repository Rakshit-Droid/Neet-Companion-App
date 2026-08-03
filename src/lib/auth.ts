import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  updateProfile,
  onAuthStateChanged,
  type User,
} from "firebase/auth"

import { getFirebaseAuth, isFirebaseConfigured } from "./firebase"
import {
  isMockAuthEnabled,
  mockGetIdToken,
  mockSendReset,
  mockSignIn,
  mockSignOut,
  mockSignUp,
  mockWatchAuth,
} from "./mock-auth"
import type { AuthUser } from "./auth-types"

export { isFirebaseConfigured, isMockAuthEnabled }
export { MOCK_EMAIL, MOCK_PASSWORD } from "./mock-auth"
export type { AuthUser }

/**
 * Whether sign-in can be attempted at all. True for the dev mock as well, so the
 * account screens offer their buttons instead of the "not switched on" notice.
 */
export const isAuthAvailable = isFirebaseConfigured || isMockAuthEnabled

export class AuthNotConfiguredError extends Error {
  constructor() {
    super("Sign-in is not available yet.")
    this.name = "AuthNotConfiguredError"
  }
}

function toAuthUser(u: User): AuthUser {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    emailVerified: u.emailVerified,
  }
}

function requireAuth() {
  const auth = getFirebaseAuth()
  if (!auth) throw new AuthNotConfiguredError()
  return auth
}

/**
 * Firebase error codes are not user-facing. Anything unrecognised is deliberately
 * generic rather than leaking internals, and sign-in failures never reveal
 * whether an account exists.
 */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? ""
  switch (code) {
    case "auth/invalid-email":
      return "That email address does not look right."
    case "auth/missing-password":
      return "Enter your password."
    case "auth/weak-password":
      return "Use at least 6 characters."
    case "auth/email-already-in-use":
      return "An account already exists for this email."
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect."
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes."
    case "auth/network-request-failed":
      return "No connection. Check your network and try again."
    default:
      if (err instanceof AuthNotConfiguredError) return err.message
      return "Something went wrong. Try again."
  }
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthUser> {
  if (isMockAuthEnabled) return mockSignUp(email, password, displayName)
  const auth = requireAuth()
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
  if (displayName?.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() })
  }
  return toAuthUser(cred.user)
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  if (isMockAuthEnabled) return mockSignIn(email, password)
  const auth = requireAuth()
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
  return toAuthUser(cred.user)
}

export async function sendReset(email: string): Promise<void> {
  if (isMockAuthEnabled) return mockSendReset(email)
  const auth = requireAuth()
  await sendPasswordResetEmail(auth, email.trim())
}

export async function signOut(): Promise<void> {
  if (isMockAuthEnabled) return mockSignOut()
  const auth = getFirebaseAuth()
  if (auth) await fbSignOut(auth)
}

/** Fresh ID token for API calls. Cached by the SDK and refreshed near expiry. */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  if (isMockAuthEnabled) return mockGetIdToken()
  const auth = getFirebaseAuth()
  const user = auth?.currentUser
  if (!user) return null
  return user.getIdToken(forceRefresh)
}

/** Subscribes to sign-in state. Fires once on start with the restored session. */
export function watchAuth(cb: (user: AuthUser | null) => void): () => void {
  if (isMockAuthEnabled) return mockWatchAuth(cb)
  const auth = getFirebaseAuth()
  if (!auth) {
    cb(null)
    return () => {}
  }
  return onAuthStateChanged(auth, (u) => cb(u ? toAuthUser(u) : null))
}
