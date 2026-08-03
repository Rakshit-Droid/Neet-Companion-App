import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as fbSignOut,
  updateProfile,
  onAuthStateChanged,
  type User,
} from "firebase/auth"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"

import { getFirebaseAuth, isFirebaseConfigured } from "./firebase"
import {
  isMockAuthEnabled,
  mockCompleteMagicLink,
  mockGetIdToken,
  mockIsMagicLink,
  mockSendMagicLink,
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
    case "auth/invalid-action-code":
    case "auth/expired-action-code":
      return "That sign-in link has expired or was already used. Request a new one."
    case "auth/operation-not-allowed":
      return "Email link sign-in is not switched on for this project yet."
    case "auth/unauthorized-continue-uri":
      return "This app's domain is not authorised in Firebase yet."
    default:
      if (err instanceof AuthNotConfiguredError) return err.message
      if (err instanceof MagicLinkEmailNeededError) return err.message
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

// -- magic link ---------------------------------------------------------------

/**
 * The email the link was requested for.
 *
 * Firebase will not complete an email-link sign-in from the link alone — it
 * needs the address too, so a stolen link is useless on its own. Opening the
 * link on the same device finds this; opening it elsewhere has to ask.
 */
const PENDING_EMAIL_KEY = "magic-link-email-v1"

/**
 * Where the link sends people back to. Must be https on a domain listed under
 * Authentication → Settings → Authorized domains; a custom scheme is rejected
 * here, which is the usual reason a link errors on arrival.
 */
function continueUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as { magicLinkUrl?: string }
  if (!extra.magicLinkUrl) {
    throw new Error("expo.extra.magicLinkUrl is not set in app.json")
  }
  return extra.magicLinkUrl
}

export interface MagicLinkRequest {
  /**
   * Only set by the development stand-in, which has no mailbox to send to. The
   * screen shows it so the flow can be walked end to end before Firebase exists.
   */
  devLink?: string
}

export async function sendMagicLink(email: string): Promise<MagicLinkRequest> {
  const address = email.trim()
  await AsyncStorage.setItem(PENDING_EMAIL_KEY, address)

  if (isMockAuthEnabled) return mockSendMagicLink(address)

  const auth = requireAuth()
  await sendSignInLinkToEmail(auth, address, {
    url: continueUrl(),
    handleCodeInApp: true,
    android: { packageName: "me.techefy.neetcompanion", installApp: true },
    iOS: { bundleId: "me.techefy.neetcompanion" },
  })
  return {}
}

/** Whether a URL the app was opened with is a sign-in link. */
export function isMagicLink(url: string): boolean {
  if (isMockAuthEnabled) return mockIsMagicLink(url)
  const auth = getFirebaseAuth()
  return Boolean(auth) && isSignInWithEmailLink(auth!, url)
}

export async function pendingMagicLinkEmail(): Promise<string | null> {
  return AsyncStorage.getItem(PENDING_EMAIL_KEY)
}

/**
 * Completes a sign-in from a link. `email` is only needed when the link is
 * opened on a device that did not request it, where nothing is stored.
 */
export async function completeMagicLink(url: string, email?: string): Promise<AuthUser> {
  const address = email?.trim() || (await pendingMagicLinkEmail())
  if (!address) throw new MagicLinkEmailNeededError()

  const user = isMockAuthEnabled
    ? await mockCompleteMagicLink(url, address)
    : toAuthUser((await signInWithEmailLink(requireAuth(), address, url)).user)

  // Only cleared on success: a failed attempt should not force the user to
  // retype an address the device already knew.
  await AsyncStorage.removeItem(PENDING_EMAIL_KEY)
  return user
}

export class MagicLinkEmailNeededError extends Error {
  constructor() {
    super("Confirm the email address this link was sent to.")
    this.name = "MagicLinkEmailNeededError"
  }
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
