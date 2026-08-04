import { createSign } from "node:crypto"

import { passwordReset, signInLink } from "./_templates.mjs"

/**
 * Sends the auth emails ourselves instead of letting Firebase compose them.
 *
 * Firebase has locked email template editing on this project ("Email template
 * updates are currently unavailable"), and there was never an editable template
 * for the magic-link email at all. So we ask Firebase for the one-time link
 * without sending anything, and deliver it through Resend with the real design.
 * The links are identical to the ones Firebase would have sent — same codes,
 * same expiry, same action page. Only the envelope changes.
 *
 * Deliberately does NOT use firebase-admin. All it was needed for was minting a
 * token and calling one REST endpoint, and it drags in a jwks-rsa/jose pair that
 * breaks under ESM with ERR_REQUIRE_ESM. Signing the JWT here is about thirty
 * lines and cannot rot the same way.
 *
 * Environment:
 *   FIREBASE_SERVICE_ACCOUNT  service account JSON, one line
 *   RESEND_API_KEY            Resend key with send permission
 *   AUTH_LINK_DOMAIN          optional, puts the link on our own domain
 * All are secrets or config that must stay server-side.
 */

const CONTINUE_URL =
  process.env.MAGIC_LINK_URL ?? "https://neet-companion-app-five.vercel.app/magic-link"

const FROM = process.env.EMAIL_FROM ?? "NEET Companion <no-reply@forms.neetcompanion.com>"

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

let cachedToken = null

/** Service account JWT exchanged for an access token, cached until near expiry. */
async function accessToken() {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expires > now + 60) return cachedToken.value

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set")
  const sa = JSON.parse(raw)

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
  if (!json.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(json)}`)

  cachedToken = { value: json.access_token, expires: now + (json.expires_in ?? 3600) }
  return cachedToken.value
}

/**
 * Asks Firebase for the action link without sending an email.
 *
 * returnOobLink is what makes it hand the link back instead of mailing it, and
 * it requires an OAuth token rather than the public API key — which is exactly
 * why this runs on a server and not in the app.
 */
async function generateLink(type, email) {
  const token = await accessToken()
  const body =
    type === "reset"
      ? { requestType: "PASSWORD_RESET", email, returnOobLink: true }
      : {
          requestType: "EMAIL_SIGNIN",
          email,
          returnOobLink: true,
          continueUrl: CONTINUE_URL,
          canHandleCodeInApp: true,
        }

  const res = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message ?? `sendOobCode failed (${res.status})`)
  if (!json.oobLink) throw new Error("Firebase returned no link")
  return json.oobLink
}

/**
 * Puts the link on our own domain when AUTH_LINK_DOMAIN is set.
 *
 * Firebase always generates it on <project>.firebaseapp.com and the setting that
 * would change that is locked, but since we compose the email the host can be
 * swapped: path and query are identical, so the link keeps working as long as
 * the domain serves the same Firebase Hosting handler.
 *
 * The link cannot be made SHORT — oobCode is the one-time secret and apiKey
 * selects the project. Only the domain is ours.
 */
function brandLink(link) {
  const custom = process.env.AUTH_LINK_DOMAIN
  if (!custom) return link
  try {
    const url = new URL(link)
    // Never rewrite anything that is not Firebase's own host.
    if (!url.hostname.endsWith(".firebaseapp.com")) return link
    url.hostname = custom
    return url.toString()
  } catch {
    return link
  }
}

async function deliver({ to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  if (!res.ok) throw new Error(`Resend rejected the message: ${res.status} ${await res.text()}`)
  return res.json()
}

export default async function handler(req, res) {
  // GET is a health check: reports whether the pieces are present without
  // revealing any of them, so a deployment can be diagnosed without log access.
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      hasServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
      hasResendKey: Boolean(process.env.RESEND_API_KEY),
      linkDomain: process.env.AUTH_LINK_DOMAIN ?? "firebase default",
      node: process.version,
      templates: 2,
    })
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST")
    return res.status(405).json({ error: "Use POST" })
  }

  const { type, email } = req.body ?? {}
  if (typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "A valid email is required" })
  }
  if (type !== "reset" && type !== "signin") {
    return res.status(400).json({ error: 'type must be "reset" or "signin"' })
  }

  try {
    const link = brandLink(await generateLink(type, email.trim()))
    const template = type === "reset" ? passwordReset : signInLink
    const html = template.html.replaceAll("%LINK%", link).replaceAll("%EMAIL%", email.trim())

    await deliver({ to: email.trim(), subject: template.subject, html })
    return res.status(200).json({ ok: true })
  } catch (err) {
    const message = String(err?.message ?? err)

    // An unknown address on a reset must not be distinguishable from a known
    // one, or this endpoint becomes a way to discover who has an account.
    if (message.includes("EMAIL_NOT_FOUND")) return res.status(200).json({ ok: true })

    console.error("auth-email failed:", message)
    return res.status(500).json({ error: "Could not send the email", detail: message.slice(0, 300) })
  }
}
