#!/usr/bin/env node
/**
 * Paste the firebaseConfig block from the console; this writes it into app.json.
 *
 *   npm run firebase:config
 *   <paste the whole snippet, then Ctrl+Z on Windows / Ctrl+D elsewhere>
 *
 * Retyping six opaque strings by hand is how a wrong appId ends up in the repo
 * and costs an afternoon. This takes whatever shape the console gave you — the
 * JS snippet, a JSON object, or bare key: value lines — and validates each value
 * before writing anything.
 */

import { readFileSync, writeFileSync } from "node:fs"

const KEYS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
]

/** Shape checks for the mistakes that actually happen, not exhaustive validation. */
const EXPECT = {
  apiKey: {
    test: (v) => v.startsWith("AIza") && v.length > 30,
    why: 'should start with "AIza"',
  },
  authDomain: {
    test: (v) => v.endsWith(".firebaseapp.com"),
    why: 'should end with ".firebaseapp.com"',
  },
  projectId: {
    test: (v) => /^[a-z0-9-]+$/.test(v),
    why: "should be lowercase letters, digits and hyphens",
  },
  storageBucket: {
    test: (v) => v.endsWith(".appspot.com") || v.endsWith(".firebasestorage.app"),
    why: 'should end with ".firebasestorage.app" or ".appspot.com"',
  },
  messagingSenderId: {
    test: (v) => /^\d+$/.test(v),
    why: "should be digits only",
  },
  appId: {
    test: (v) => /^\d+:\d+:(web|android|ios):/.test(v),
    why: 'should look like "1:123…:web:abc…"',
  },
}

function read() {
  try {
    return readFileSync(0, "utf8")
  } catch {
    return ""
  }
}

function parse(text) {
  const found = {}
  for (const key of KEYS) {
    // Matches   apiKey: "x"   "apiKey": 'x'   apiKey = "x"
    const m = text.match(new RegExp(`["']?${key}["']?\\s*[:=]\\s*["']([^"']+)["']`))
    if (m) found[key] = m[1].trim()
  }
  return found
}

const raw = read()
if (!raw.trim()) {
  console.error(
    "Nothing pasted.\n\n" +
      "  npm run firebase:config\n" +
      "  then paste the firebaseConfig block and press Ctrl+Z (Windows) or Ctrl+D.\n",
  )
  process.exit(1)
}

const cfg = parse(raw)
const missing = KEYS.filter((k) => !cfg[k])
if (missing.length) {
  console.error(`Could not find: ${missing.join(", ")}`)
  console.error("\nPaste the whole block, including the braces. It looks like:\n")
  console.error('  const firebaseConfig = {\n    apiKey: "AIza…",\n    …\n  };\n')
  process.exit(1)
}

const wrong = KEYS.filter((k) => !EXPECT[k].test(cfg[k]))
if (wrong.length) {
  console.error("These do not look right:\n")
  for (const k of wrong) console.error(`  ${k}: ${EXPECT[k].why}\n    got: ${cfg[k]}`)
  console.error("\nNothing written. Check you copied from the Web app, not Android.")
  process.exit(1)
}

if (cfg.appId.includes(":android:") || cfg.appId.includes(":ios:")) {
  console.error(
    "That appId is for an Android or iOS app.\n" +
      "This project uses the Firebase JS SDK on every platform, so it needs the\n" +
      "WEB app config. Register one with the </> button in the console.",
  )
  process.exit(1)
}

const path = "app.json"
const app = JSON.parse(readFileSync(path, "utf8"))
app.expo.extra ??= {}
const before = app.expo.extra.firebase ?? {}
app.expo.extra.firebase = Object.fromEntries(KEYS.map((k) => [k, cfg[k]]))
writeFileSync(path, JSON.stringify(app, null, 2) + "\n")

console.log(`Wrote ${path}\n`)
for (const k of KEYS) {
  const was = before[k]
  const now = cfg[k]
  const shown = k === "apiKey" ? now.slice(0, 10) + "…" : now
  console.log(`  ${k.padEnd(18)} ${shown}${was && was !== now ? "   (changed)" : ""}`)
}

console.log(
  "\nNext:\n" +
    "  1. npm run firebase:verify -- you@yourdomain.com\n" +
    "  2. Restart the dev server with a cleared cache: npx expo start -c\n" +
    "\nThe development sign-in (dev@neetcompanion.test) stops working now that real\n" +
    "config exists. That is intended.\n",
)
