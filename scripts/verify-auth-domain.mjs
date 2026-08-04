#!/usr/bin/env node
/**
 * Checks that a custom auth domain is safe to switch on.
 *
 *   npm run verify:authdomain -- auth.neetcompanion.com
 *
 * Proxying Firebase's action page is not a documented Firebase setup, so this
 * exists to prove it works before production emails point at it. Enabling
 * AUTH_LINK_DOMAIN while the domain does not serve the handler would break every
 * password reset, and the only symptom would be users unable to get back in.
 */

import { promises as dns } from "node:dns"

const domain = process.argv[2] ?? "auth.neetcompanion.com"
const FIREBASE_HOST = "neet-companion-4c9bb.firebaseapp.com"

const results = []
function record(name, ok, detail = "") {
  results.push(ok)
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? `\n        ${detail}` : ""}`)
}

async function get(url) {
  try {
    const res = await fetch(url, { redirect: "follow" })
    return { ok: res.ok, status: res.status, body: await res.text(), url: res.url }
  } catch (err) {
    return { ok: false, status: 0, body: "", error: String(err?.message ?? err) }
  }
}

console.log(`\nChecking ${domain}\n`)

// 1. DNS.
{
  let target = null
  try {
    target = (await dns.resolveCname(domain))[0] ?? null
  } catch {
    /* an A record is fine too */
  }
  let addrs = []
  try {
    addrs = await dns.resolve4(domain)
  } catch {
    /* reported below */
  }
  const ok = Boolean(target) || addrs.length > 0
  record("DNS resolves", ok, ok ? `CNAME ${target ?? "(none)"} A ${addrs.join(", ") || "(none)"}` : "Record missing or still propagating")
  if (!ok) finish()
}

// 2. The root should be our app, not a parking page or a certificate error.
{
  const res = await get(`https://${domain}/`)
  const ok = res.ok && /<div id="root"|expo|NEET/i.test(res.body)
  record("Root serves the app", ok, res.error ?? `HTTP ${res.status}`)
}

// 3. The action page has to come through the proxy. This is the check that
//    matters: everything else can pass while this one silently serves the SPA.
const ACTION = `/__/auth/action?mode=verifyEmail&oobCode=probe&apiKey=probe`
{
  const mine = await get(`https://${domain}${ACTION}`)
  const theirs = await get(`https://${FIREBASE_HOST}${ACTION}`)

  const looksLikeFirebase = (body) => /firebase|identitytoolkit|__\/auth/i.test(body)
  const looksLikeOurApp = (body) => /<div id="root"|_expo\/static/i.test(body)

  const ok = mine.ok && looksLikeFirebase(mine.body) && !looksLikeOurApp(mine.body)
  record(
    "Action page proxies to Firebase",
    ok,
    !mine.ok
      ? `HTTP ${mine.status} — the proxy is not routing`
      : looksLikeOurApp(mine.body)
        ? "Served our SPA instead of Firebase — the rewrite is not matching"
        : ok
          ? `${mine.body.length} bytes, Firebase's page (theirs: ${theirs.body.length})`
          : "Reachable but does not look like Firebase's page",
  )
}

finish()

function finish() {
  const failed = results.filter((r) => !r).length
  console.log()
  if (failed === 0) {
    console.log("Safe to switch on. In Vercel add:\n")
    console.log(`  AUTH_LINK_DOMAIN = ${domain}\n`)
    console.log("Then redeploy, send yourself a reset, and complete it before")
    console.log("telling anyone else the flow works.\n")
    process.exit(0)
  }
  console.log(`${failed} check${failed === 1 ? "" : "s"} failed. Do NOT set AUTH_LINK_DOMAIN yet —`)
  console.log("switching it on now would break password resets in production.\n")
  process.exit(1)
}
