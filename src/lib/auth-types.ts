/**
 * Shared auth shape. Split out from auth.ts so mock-auth.ts can use it without
 * importing auth.ts back — auth.ts imports the mock, and that would be a cycle.
 */
export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  emailVerified: boolean
}
