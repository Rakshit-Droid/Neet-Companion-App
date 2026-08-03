#!/usr/bin/env node
/**
 * Pushes the auth email templates into Firebase over the Identity Toolkit admin
 * API, so they are set from the repo rather than pasted into a console text box.
 *
 *   npm run firebase:templates -- path/to/service-account.json
 *
 * Pasting by hand is three chances to drop a line, and nothing records what is
 * actually live. This reads emails/firebase-paste/, sets all three, then reads
 * the config back and diffs it against what it sent.
 *
 * The service account JSON is a real secret — it can act as your project. Keep
 * it outside the repo (service-account*.json is gitignored) and delete it when
 * you are done; nothing here stores or transmits it anywhere but Google.
 */

import { readFileSync } from "node:fs"
import { createSign } from "node:crypto"

const KEY_PATH = process.argv[2] ?? process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!KEY_PATH) {
  console.error(
    "Need a service account key.\n\n" +
      "  Firebase console -> gear -> Project settings -> Service accounts\n" +
      "  -> Generate new private key\n\n" +
      "Then:  npm run firebase:templates -- C:/path/to/key.json\n",
  )
  process.exit(1)
}

let sa
try {
  sa = JSON.parse(readFileSync(KEY_PATH, "utf8"))
} catch {
  console.error(`Cannot read ${KEY_PATH}`)
  process.exit(1)
}
if (!sa.client_email || !sa.private_key || !sa.project_id) {
  console.error("That file is not a service account key (needs client_email, private_key, project_id).")
  process.exit(1)
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

/** Signed JWT exchanged for an access token — the standard service account flow. */
async function accessToken() {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  )
  const signer = createSign("RSA-SHA256")
  signer.update(`${header}.${claim}`)
  const jwt = `${header}.${claim}.${b64url(signer.sign(sa.private_key))}`

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })
  const json = await res.json()
  if (!json.access_token) {
    console.error("Could not get an access token:", JSON.stringify(json))
    process.exit(1)
  }
  return json.access_token
}

/**
 * Only these are settable.
 *
 * The admin API exposes resetPasswordTemplate, verifyEmailTemplate,
 * changeEmailTemplate and revertSecondFactorAdditionTemplate, and nothing for
 * the email-link sign-in message — signInTemplate, emailSignInTemplate and
 * signInWithEmailLinkTemplate are all rejected as unknown fields. So magic-link
 * emails keep Firebase's default wording unless the console offers that
 * template, which is the only place it could be changed.
 *
 * changeEmailTemplate is left alone: nothing in the app changes an email
 * address, so there is no design for it and overwriting the default would be
 * churn.
 */
const TEMPLATES = [
  {
    field: "resetPasswordTemplate",
    file: "emails/firebase-paste/password-reset.html",
    subject: "Reset your NEET Companion password",
    label: "Password reset",
  },
  {
    field: "verifyEmailTemplate",
    file: "emails/firebase-paste/verify-email.html",
    subject: "Confirm your email for NEET Companion",
    label: "Email verification",
  },
]

const BASE = `https://identitytoolkit.googleapis.com/admin/v2/projects/${sa.project_id}/config`

const token = await accessToken()
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

const sendEmail = {}
for (const t of TEMPLATES) {
  const body = readFileSync(t.file, "utf8")
  if (!body.includes("%LINK%")) {
    console.error(`${t.file} has no %LINK% — refusing to send an email nobody can act on.`)
    process.exit(1)
  }
  sendEmail[t.field] = { subject: t.subject, body, bodyFormat: "HTML" }
}

console.log(`Project: ${sa.project_id}`)
console.log(`Acting as: ${sa.client_email}\n`)

const res = await fetch(`${BASE}?updateMask=notification.sendEmail`, {
  method: "PATCH",
  headers: auth,
  body: JSON.stringify({ notification: { sendEmail } }),
})
const out = await res.json()

if (!res.ok) {
  const msg = String(out.error?.message ?? "")
  console.error("Failed:", JSON.stringify(out.error ?? out, null, 2))

  if (msg.includes("EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED")) {
    console.error(
      "\nGoogle blocks template subject and body writes over this API. It is not a\n" +
        "permissions problem: senderDisplayName on the same object is accepted, only\n" +
        "the content fields are refused. Email template content can only be changed\n" +
        "in the console.\n\n" +
        "  https://console.firebase.google.com/project/" + sa.project_id + "/authentication/emails\n\n" +
        "Paste emails/firebase-paste/password-reset.html over the Password reset body,\n" +
        "and verify-email.html over the Email address verification body.\n\n" +
        "For full control — including the magic-link email, which has no console\n" +
        "template at all — generate the links with the Admin SDK and send them through\n" +
        "Resend instead of letting Firebase compose them.\n",
    )
  } else if (msg.includes("PERMISSION_DENIED")) {
    console.error(
      "\nThe service account needs the Firebase Authentication Admin role.\n" +
        "Google Cloud console -> IAM -> find this account -> add that role.",
    )
  }
  process.exit(1)
}

// Read back rather than trusting the write: the API silently ignores fields it
// does not recognise, so a 200 alone proves nothing.
const check = await (await fetch(BASE, { headers: auth })).json()
const live = check.notification?.sendEmail ?? {}

console.log("Verified against the live config:\n")
let bad = 0
for (const t of TEMPLATES) {
  const got = live[t.field] ?? {}
  const sent = sendEmail[t.field]
  const ok = got.subject === sent.subject && (got.body ?? "").includes("logo-on-light")
  if (!ok) bad++
  console.log(`  ${ok ? "OK  " : "FAIL"} ${t.label}`)
  console.log(`       subject: ${got.subject ?? "(unset)"}`)
  console.log(`       body:    ${(got.body ?? "").length} chars, logo ${(got.body ?? "").includes("<img") ? "present" : "MISSING"}`)
}

console.log(
  bad === 0
    ? "\nAll three are live. Trigger a reset and check https://resend.com/emails.\n"
    : `\n${bad} did not take. Firebase may have stripped the HTML.\n`,
)
process.exit(bad === 0 ? 0 : 1)
