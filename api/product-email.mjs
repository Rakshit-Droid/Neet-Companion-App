import { welcome, creditsLow, watchExpiring, referralPaid } from "./_templates.mjs"

/**
 * Sends the product emails — welcome, low credits, watchlist pausing, referral
 * paid.
 *
 * These fire on events the server knows nothing about: credits, the watchlist
 * and referrals all live on the device. So the app has to ask for them, which
 * makes this endpoint public, which would make it a spam relay for our domain
 * if it took a recipient address.
 *
 * It does not. The caller sends a Firebase ID token and the email goes to
 * whatever address that token belongs to — verified against Firebase on every
 * request. A caller can therefore only ever email themselves, and a stolen
 * endpoint is worth nothing.
 *
 * Environment:
 *   RESEND_API_KEY        Resend key with send permission
 *   FIREBASE_API_KEY      public web API key, used to verify the ID token
 */

const FROM = process.env.EMAIL_FROM ?? "NEET Companion <no-reply@forms.neetcompanion.com>"
const APP_URL = process.env.APP_URL ?? "https://neet-companion-app-five.vercel.app"

const TEMPLATE = { welcome, creditsLow, watchExpiring, referralPaid }

/**
 * Confirms the token is real and returns the address it belongs to.
 *
 * accounts:lookup validates the signature and expiry for us, so there is no JWT
 * verification to get subtly wrong here, and no extra dependency.
 */
/**
 * Not a secret, and deliberately not an environment variable. The Firebase web
 * API key identifies the project and already ships in every client bundle, so
 * requiring it to be configured here would add a deployment step that protects
 * nothing.
 */
const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ?? "AIzaSyA8oYR46eP4nA6mKUHXoewFo_4EoBJUZCE"

async function verifiedEmail(idToken) {
  const key = FIREBASE_API_KEY
  if (!key) throw new Error("FIREBASE_API_KEY is not set")

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  )
  const json = await res.json()
  const user = json?.users?.[0]
  if (!res.ok || !user?.email) throw new Error("INVALID_TOKEN")
  return { email: user.email, name: user.displayName ?? "" }
}

/**
 * Just enough Mustache for these templates: {{key}}, {{#key}}…{{/key}} for a
 * conditional, and the same syntax over an array for repetition. Escapes every
 * substituted value — a college name or display name reaching the markup
 * unescaped would let stored text break the layout.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function render(template, data) {
  return template
    .replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => {
      const value = data[key]
      if (Array.isArray(value)) return value.map((row) => render(inner, row)).join("")
      return value ? render(inner, data) : ""
    })
    .replace(/\{\{(\w+)\}\}/g, (_, key) =>
      data[key] === undefined || data[key] === null ? "" : escapeHtml(data[key]),
    )
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
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      hasResendKey: Boolean(process.env.RESEND_API_KEY),
      hasFirebaseKey: Boolean(process.env.FIREBASE_API_KEY),
      types: Object.keys(TEMPLATE),
    })
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST")
    return res.status(405).json({ error: "Use POST" })
  }

  const { idToken, type, data } = req.body ?? {}
  if (!idToken || typeof idToken !== "string") {
    return res.status(401).json({ error: "Sign-in required" })
  }
  if (!TEMPLATE[type]) {
    return res.status(400).json({ error: `type must be one of ${Object.keys(TEMPLATE).join(", ")}` })
  }

  try {
    const account = await verifiedEmail(idToken)
    const template = TEMPLATE[type]

    const html = render(template.html, {
      appUrl: APP_URL,
      creditsUrl: `${APP_URL}/credits`,
      // No preference centre exists yet, so this points at the account screen
      // rather than a dead link. Every product email must carry one.
      unsubscribeUrl: `${APP_URL}/account`,
      name: account.name,
      ...(data && typeof data === "object" ? data : {}),
    })

    await deliver({ to: account.email, subject: template.subject, html })
    return res.status(200).json({ ok: true })
  } catch (err) {
    const message = String(err?.message ?? err)
    if (message.includes("INVALID_TOKEN")) {
      return res.status(401).json({ error: "Sign-in required" })
    }
    console.error("product-email failed:", message)
    return res.status(500).json({ error: "Could not send the email", detail: message.slice(0, 300) })
  }
}
