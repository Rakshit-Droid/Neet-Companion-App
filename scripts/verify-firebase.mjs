#!/usr/bin/env node
/**
 * Checks that the Firebase project is actually wired up, against the live API.
 *
 *   npm run firebase:verify -- you@yourdomain.com
 *
 * Every one of these otherwise fails silently and is discovered days later by a
 * user who cannot log in. Each check reports the raw Firebase error code, which
 * is what you need to fix it.
 *
 * Side effects: creates one throwaway account and deletes it again, and sends
 * two real emails to the address you pass. Nothing else is touched.
 */

import { readFileSync } from "node:fs"

const IDT = "https://identitytoolkit.googleapis.com/v1"

const app = JSON.parse(readFileSync("app.json", "utf8"))
const cfg = app.expo?.extra?.firebase ?? {}
const continueUrl = app.expo?.extra?.magicLinkUrl

const email = process.argv[2]
if (!email || !email.includes("@")) {
  console.error(
    "Pass an email you can actually open:\n\n  npm run firebase:verify -- you@yourdomain.com\n",
  )
  process.exit(1)
}

const missing = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"]
  .filter((k) => !cfg[k])
if (missing.length) {
  console.error(`app.json is missing: ${missing.join(", ")}\n\nRun: npm run firebase:config`)
  process.exit(1)
}

async function call(path, body) {
  const res = await fetch(`${IDT}/${path}?key=${cfg.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

function code(json) {
  return json?.error?.message ?? `HTTP ${json?.error?.code ?? "?"}`
}

const results = []
function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? `\n        ${detail}` : ""}`)
}

console.log(`\nProject: ${cfg.projectId}\nSending test mail to: ${email}\n`)

// 1. Does the key and project exist at all? No side effects.
{
  const { ok, json } = await call("accounts:createAuthUri", {
    identifier: email,
    continueUri: "http://localhost",
  })
  const detail = ok
    ? ""
    : code(json) === "CONFIGURATION_NOT_FOUND"
      ? "Project has no Identity Toolkit config — open Authentication in the console and click Get started."
      : code(json)
  record("API key and project reachable", ok, detail)
  if (!ok) finish()
}

// 2. Is Email/Password enabled? A throwaway account, deleted below.
const throwaway = `verify-${Date.now().toString(36)}@neetcompanion.invalid`
let idToken = null
{
  const { ok, json } = await call("accounts:signUp", {
    email: throwaway,
    password: `Vf-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    returnSecureToken: true,
  })
  idToken = json.idToken ?? null
  const detail = ok
    ? ""
    : code(json) === "OPERATION_NOT_ALLOWED"
      ? "Email/Password is off. Authentication → Sign-in method → Email/Password → first toggle."
      : code(json)
  record("Email/Password sign-in enabled", ok, detail)
}

// 3. Password reset. Real email, and the first thing that proves SMTP works.
{
  const { ok, json } = await call("accounts:sendOobCode", {
    requestType: "PASSWORD_RESET",
    email,
  })
  const detail = ok
    ? "Check the inbox — and https://resend.com/emails if SMTP is pointed there."
    : code(json) === "EMAIL_NOT_FOUND"
      ? `No account exists for ${email} yet. Sign up in the app first, then re-run.`
      : code(json)
  record("Password reset email accepted", ok, detail)
}

// 4. Magic link. Fails loudly when the continue domain is not authorised.
{
  if (!continueUrl) {
    record("Email-link sign-in enabled", false, "expo.extra.magicLinkUrl is not set in app.json")
  } else {
    const { ok, json } = await call("accounts:sendOobCode", {
      requestType: "EMAIL_SIGNIN",
      email,
      continueUrl,
      canHandleCodeInApp: true,
    })
    const c = code(json)
    const detail = ok
      ? `Continue URL: ${continueUrl}`
      : c === "OPERATION_NOT_ALLOWED"
        ? "Email link sign-in is off. It is the SECOND toggle inside the Email/Password provider."
        : c.startsWith("UNAUTHORIZED_DOMAIN") || c.includes("DOMAIN_NOT_ALLOWLISTED")
          ? `Add ${new URL(continueUrl).hostname} under Authentication → Settings → Authorized domains.`
          : c
    record("Email-link (magic link) sign-in enabled", ok, detail)
  }
}

// Clean up the throwaway so the project is left as it was found.
if (idToken) {
  const { ok } = await call("accounts:delete", { idToken })
  record("Throwaway test account removed", ok, ok ? "" : "Delete it by hand in Authentication → Users.")
}

finish()

function finish() {
  const failed = results.filter((r) => !r.ok)
  console.log()
  if (failed.length === 0) {
    console.log("All checks passed. Restart with a cleared cache: npx expo start -c\n")
    console.log("Then remove EXPO_PUBLIC_ALLOW_DEV_AUTH=1 from vercel.json — the dev")
    console.log("sign-in is dead now that real config exists, so the flag is dead weight.\n")
    process.exit(0)
  }
  console.log(`${failed.length} check${failed.length === 1 ? "" : "s"} failed. Fix and re-run.\n`)
  process.exit(1)
}
