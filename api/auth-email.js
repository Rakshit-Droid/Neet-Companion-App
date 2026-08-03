import { initializeApp, cert, getApps } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

import { passwordReset, signInLink } from "./_templates.js"

/**
 * Sends the auth emails ourselves instead of letting Firebase compose them.
 *
 * Why this exists: Firebase has locked email template editing on this project
 * ("Email template updates are currently unavailable"), and there was never an
 * editable template for the magic-link email in the first place. The Admin SDK
 * can GENERATE the one-time links without sending anything, so we generate them
 * here and deliver through Resend with the real templates.
 *
 * The links are the same links Firebase would have sent — same one-time codes,
 * same expiry, same action page. Only the envelope changes.
 *
 * Runs on Vercel. Needs two environment variables:
 *   FIREBASE_SERVICE_ACCOUNT  the service account JSON, as one line
 *   RESEND_API_KEY            a Resend key with send permission
 * Both are secrets and must never reach the client bundle, which is why this is
 * a server function and not app code.
 */

const CONTINUE_URL =
  process.env.MAGIC_LINK_URL ?? "https://neet-companion-app-five.vercel.app/magic-link"

const FROM = process.env.EMAIL_FROM ?? "NEET Companion <no-reply@forms.neetcompanion.com>"

function admin() {
  if (getApps().length) return getAuth()
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set")
  initializeApp({ credential: cert(JSON.parse(raw)) })
  return getAuth()
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
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend rejected the message: ${res.status} ${body}`)
  }
  return res.json()
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
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
    const auth = admin()

    const link =
      type === "reset"
        ? await auth.generatePasswordResetLink(email)
        : await auth.generateSignInWithEmailLink(email, {
            url: CONTINUE_URL,
            handleCodeInApp: true,
          })

    const template = type === "reset" ? passwordReset : signInLink
    const html = template.html.replaceAll("%LINK%", link).replaceAll("%EMAIL%", email)

    await deliver({ to: email, subject: template.subject, html })
    return res.status(200).json({ ok: true })
  } catch (err) {
    const code = err?.code ?? ""

    // An unknown address on a reset is not an error the caller should be able to
    // see: answering differently for registered and unregistered addresses turns
    // this endpoint into a way to discover who has an account. Firebase's own
    // enumeration protection does the same thing.
    if (code === "auth/user-not-found") return res.status(200).json({ ok: true })

    console.error("auth-email failed:", code || err?.message, err)
    return res.status(500).json({ error: "Could not send the email" })
  }
}
