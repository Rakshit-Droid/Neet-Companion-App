import { passwordReset, signInLink } from "./_templates.mjs"

// firebase-admin is imported lazily, inside the handler.
//
// Importing it at module scope means any problem loading it — a missing
// dependency, a runtime mismatch — crashes the module before the handler runs,
// and the platform can only answer FUNCTION_INVOCATION_FAILED with no detail.
// That is exactly what happened, and it cost an hour of guessing. Loading it
// here turns the same failure into a readable message.
let adminAuth = null

async function getAdminAuth() {
  if (adminAuth) return adminAuth
  const { initializeApp, cert, getApps } = await import("firebase-admin/app")
  const { getAuth } = await import("firebase-admin/auth")

  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set")
    initializeApp({ credential: cert(JSON.parse(raw)) })
  }
  adminAuth = getAuth()
  return adminAuth
}

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

/**
 * Puts the action link on our own domain.
 *
 * Firebase always generates it on <project>.firebaseapp.com, and the project
 * config that would change it is locked — callbackUri is refused with the same
 * EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED as the templates. Since we compose the email
 * ourselves, we can swap the host instead: the path and query are identical, so
 * the link works as long as AUTH_LINK_DOMAIN resolves to the same Firebase
 * Hosting site.
 *
 * Off unless AUTH_LINK_DOMAIN is set. Pointing it at a domain that is not
 * actually serving Firebase's handler would break every reset, so this stays
 * inert until the DNS is real.
 *
 * The link cannot be made SHORT — oobCode is the one-time secret and apiKey
 * tells the handler which project to talk to. Only the domain is ours to change.
 */
function brandLink(link) {
  const custom = process.env.AUTH_LINK_DOMAIN
  if (!custom) return link
  try {
    const url = new URL(link)
    // Only rewrite Firebase's own host, never anything else that turns up here.
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
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend rejected the message: ${res.status} ${body}`)
  }
  return res.json()
}

export default async function handler(req, res) {
  // GET is a health check. It reports whether the pieces this function needs are
  // present without revealing any of them, so a deployment can be diagnosed
  // without log access.
  if (req.method === "GET") {
    let adminImport = "ok"
    try {
      await import("firebase-admin/app")
    } catch (err) {
      adminImport = err?.message ?? "failed"
    }
    return res.status(200).json({
      ok: true,
      hasServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
      hasResendKey: Boolean(process.env.RESEND_API_KEY),
      adminImport,
      node: process.version,
      templates: Object.keys({ passwordReset, signInLink }).length,
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
    const auth = await getAdminAuth()

    const link =
      type === "reset"
        ? await auth.generatePasswordResetLink(email)
        : await auth.generateSignInWithEmailLink(email, {
            url: CONTINUE_URL,
            handleCodeInApp: true,
          })

    const template = type === "reset" ? passwordReset : signInLink
    const branded = brandLink(link)
    const html = template.html.replaceAll("%LINK%", branded).replaceAll("%EMAIL%", email)

    await deliver({ to: email, subject: template.subject, html })
    return res.status(200).json({ ok: true })
  } catch (err) {
    const code = err?.code ?? ""

    // An unknown address on a reset is not an error the caller should be able to
    // see: answering differently for registered and unregistered addresses turns
    // this endpoint into a way to discover who has an account. Firebase's own
    // enumeration protection does the same thing.
    if (code === "auth/user-not-found") return res.status(200).json({ ok: true })

    // The code and message travel back with the 500 on purpose. Without log
    // access a bare "could not send" is undiagnosable, and neither field carries
    // a credential — Firebase codes are public constants and Resend's errors
    // describe the message, not the key.
    console.error("auth-email failed:", code || err?.message, err)
    return res.status(500).json({
      error: "Could not send the email",
      code: code || null,
      detail: String(err?.message ?? err).slice(0, 300),
    })
  }
}
