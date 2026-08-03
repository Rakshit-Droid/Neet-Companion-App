# Firebase setup — instructions for Ammar

You are creating and configuring the Firebase project that NEET Companion uses for
sign-up, sign-in, forgot-password, and magic-link (passwordless email) sign-in.

At the end you hand back six config values and a confirmation that four console
settings are switched on. Section 10 is the checklist to send back.

Time: about 25 minutes. You do not need to write any code.

---

## 0. Before you start

- Use a Google account that the team will keep long-term. The account that creates
  the project is its Owner, and moving ownership later is annoying.
- Do the whole thing in one browser profile. Firebase console silently switches
  accounts if you are signed into several, and you end up creating the project
  under a personal Gmail by mistake.
- You will need the Vercel deployment domain for step 5. Get it from the developer
  before you start if you do not already have it.

---

## 1. Create the project

1. Go to <https://console.firebase.google.com/>.
2. Click **Create a project** (older wording: "Add project").
3. **Project name:** `NEET Companion`
   Firebase generates a project ID under the name box, something like
   `neet-companion-4f2a1`. **The project ID is permanent and cannot be renamed
   later.** If the auto-generated one is ugly, edit it now. Write it down — it is
   one of the six values you hand back.
4. Google Analytics: **turn it off.** The app does not use it, and leaving it on
   forces you to also create or pick a Google Analytics account. If you leave it
   on by accident it is harmless, just ignore the extra property.
5. Click **Create project**, wait for provisioning, then **Continue**.

Leave the plan on **Spark (free)** for now. See section 8 for when that has to change.

---

## 2. Register a WEB app — this is the step people get wrong

The app is built with Expo and uses the **Firebase JavaScript SDK** (`firebase`
npm package), on Android, iOS and web alike. The JS SDK is configured with the
**Web app** config object.

**Registering only an Android app does not work.** An Android registration gives
you a `google-services.json` file, and this project does not read that file at
all. If you finish setup and only have a `google-services.json`, you have not
produced the values we need — come back and do this section.

You do not need to register an Android or iOS app at all right now. Just the Web app.

1. On the project home page (**Project Overview**), find the row of platform
   buttons under the project name.
2. Click the **web** button — the one labelled with `</>`. Not the Android robot,
   not the Apple logo.
3. **App nickname:** `NEET Companion Web`. This is a console label only; it is not
   used anywhere in the app.
4. **Do NOT tick "Also set up Firebase Hosting."** We deploy on Vercel. Ticking it
   adds a hosting site you then have to ignore forever.
5. Click **Register app**.
6. Firebase now shows a code snippet containing a `firebaseConfig` object. **Those
   are the six values.** Copy the whole block into a scratch file now.

If you clicked past that screen: gear icon next to **Project Overview** →
**Project settings** → **General** tab → scroll to **Your apps** → select the web
app → **SDK setup and configuration** → choose **Config**. The same six values are
there permanently. You can always get them back; nothing is lost.

---

## 3. Where the six values go

The snippet Firebase shows looks like this (your values will differ):

```js
const firebaseConfig = {
  apiKey: "AIzaSyD-EXAMPLE-DO-NOT-COPY-THIS-ONE",
  authDomain: "neet-companion-4f2a1.firebaseapp.com",
  projectId: "neet-companion-4f2a1",
  storageBucket: "neet-companion-4f2a1.firebasestorage.app",
  messagingSenderId: "873920184455",
  appId: "1:873920184455:web:9c1f2e0a7b3d4e5f6a7b8c"
}
```

Every one of the six comes from that one screen. Do not go hunting for them
elsewhere, and do not type any of them from memory — copy and paste each one.

Two that trip people up:

- **storageBucket** ends in `.firebasestorage.app` on projects created recently,
  and `.appspot.com` on older ones. Both are correct. Paste exactly what your
  console shows; do not "fix" it to match a tutorial.
- **messagingSenderId** is a plain number as a string, and it is the same number
  that appears at the start of `appId`. That is expected, not a mistake.

### Where they go in the repo

File: **`app.json`**, at `expo` → `extra` → `firebase`. The keys already exist as
empty strings. Fill in the six values and change nothing else in the file:

```json
"extra": {
  "eas": {
    "projectId": "fb81e908-6099-4540-9c8a-91566a6f2a75"
  },
  "firebase": {
    "apiKey": "AIzaSyD-EXAMPLE-DO-NOT-COPY-THIS-ONE",
    "authDomain": "neet-companion-4f2a1.firebaseapp.com",
    "projectId": "neet-companion-4f2a1",
    "storageBucket": "neet-companion-4f2a1.firebasestorage.app",
    "messagingSenderId": "873920184455",
    "appId": "1:873920184455:web:9c1f2e0a7b3d4e5f6a7b8c"
  }
}
```

Warnings:

- `extra.eas.projectId` is a **different thing** from `extra.firebase.projectId`.
  The EAS one is already filled in and must not be touched or overwritten with the
  Firebase project ID.
- All six must be non-empty strings. The app treats "configured" as
  `apiKey`, `appId` and `projectId` all being non-empty; if any of those three is
  blank it stays on the offline development stand-in and your real project is never
  contacted.
- Filling this in **automatically disables the development mock login**
  (`src/lib/mock-auth.ts`). That is intended. The seeded test account
  `dev@neetcompanion.test` stops working the moment real config lands, and every
  sign-in goes to Firebase. Do not be alarmed when that test login stops working.
- After editing `app.json` the dev server must be restarted with a cleared cache
  (`npx expo start -c`). Config is read at bundle time, so a hot reload will not
  pick it up and it will look like nothing happened.

If you would rather not edit the repo yourself, just send the six values to the
developer and skip the file edit. Send them as text, not a screenshot.

---

## 4. Enable the sign-in methods

Console: **Authentication** in the left sidebar → **Get started** (only shown the
first time) → **Sign-in method** tab.

1. In the list of providers, click **Email/Password**.
2. Turn on the **first** toggle, `Email/Password`. This powers sign-up, sign-in and
   forgot-password.
3. In the same panel there is a **second, separate** toggle: **Email link
   (passwordless sign-in)**. Turn that on too. This is the magic link. It is easy
   to miss because it sits inside the Email/Password provider rather than being its
   own row in the provider list.
4. **Save.**

Both toggles must be on. Enabling only the first is the usual mistake, and the
symptom is magic links failing with an "operation not allowed" error later.

Do not enable Google, Facebook, Apple, phone, or anonymous sign-in. The app does
not use them, and phone auth in particular needs a different SDK.

---

## 5. Authorised domains

Email action links (password reset, magic link) only work on domains Firebase
trusts. Console: **Authentication** → **Settings** tab → **Authorized domains**.

`localhost` and the two default project domains (`<project-id>.firebaseapp.com`
and `<project-id>.web.app`) are already listed. **Leave `localhost` in place** —
removing it breaks local development.

Add:

- the **Vercel production domain** (for example `neetcompanion.vercel.app`, or the
  custom domain if one is attached — ask the developer for the exact one)
- any **Vercel preview domain** you actually need to test on

Enter domains only: no `https://`, no trailing slash, no path.

Note that Vercel preview deployments get a new random subdomain on every push, so
they cannot all be pre-authorised. Test auth on production or on localhost.

---

## 6. Email templates

Console: **Authentication** → **Templates** tab. There is one template per email
type; pick it from the list and click the pencil/edit icon.

### 6a. Password reset

The app sends password reset emails with no custom redirect settings, so the reset
flow is handled end to end by the Firebase-hosted page.

- **Do not change the action URL** on this template. The default
  (`https://<project-id>.firebaseapp.com/__/auth/action`) is what the code expects.
  Overriding it points users at a page nobody has built, and the reset silently
  stops working.
- **Do** change the sender name from the default to `NEET Companion`.
- **Do** change the subject line to something a student will recognise, e.g.
  `Reset your NEET Companion password`.
- Change the body text if you like, but leave the `%LINK%` placeholder exactly as
  it is. Deleting it produces an email with no link in it.

### 6b. Magic link / email sign-in

The template is the one for email sign-in (listed alongside the password reset and
email verification templates). Same rules: set the sender name and a clear subject
such as `Your NEET Companion sign-in link`, and leave `%LINK%` untouched.

Unlike the reset flow, the magic link has to come **back into the app**. The
relevant pieces:

- The app's custom URL scheme is **`neetcompanion`** — links of the form
  `neetcompanion://...`. This is set in `app.json` (`expo.scheme`) and must not be
  changed; changing it breaks every deep link in the app.
- The Android package name and iOS bundle identifier are both
  **`me.techefy.neetcompanion`**. If the developer asks you to register an Android
  or iOS app later for App Links, use exactly that.
- The **continue URL** (where the user lands after clicking the link) must be an
  `https://` URL on a domain from section 5 — a custom scheme cannot be used as
  the continue URL. The intended target is a small page on the Vercel domain that
  hands off to `neetcompanion://`.

The continue URL is set in application code, not in the console, so **you do not
have to configure it.** Your job here is only: sender name, subject, `%LINK%`
intact, and the Vercel domain authorised in section 5. Tell the developer which
Vercel domain you authorised so they point the continue URL at the same one.

---

## 7. Firebase Dynamic Links is dead — do not enable it

**Firebase Dynamic Links shut down on 25 August 2025.** It no longer exists.

Almost every magic-link / email-link tutorial written before mid-2025 tells you to
"enable Dynamic Links" or "set up a `page.link` domain" as part of passwordless
sign-in. **All of those tutorials are out of date.** If a guide tells you to do
this, stop reading it — the rest of its advice is likely stale too.

What replaces it: the link is delivered over a normal `https://` URL, and the app
captures it with **Android App Links** (a verified `assetlinks.json` on the web
domain) or the **`neetcompanion://` custom scheme**. That is developer-side work.

Concretely, for you: do not go looking for a Dynamic Links section, do not create a
`.page.link` domain, and do not follow any step that mentions
`dynamicLinkDomain`. If you cannot find Dynamic Links in the console, nothing is
wrong — it is gone.

---

## 8. Spark vs Blaze — when you must upgrade

- **Authentication works fully on the free Spark plan.** Sign-up, sign-in,
  forgot-password and magic links can all be built and tested without spending
  anything. Do not upgrade just to get login working.
- **Cloud Functions cannot be deployed on Spark.** The moment the project needs
  server-side code — verifying credit purchases, referral rewards, anything that
  must not run on the user's phone — the deploy fails until the project is on
  **Blaze (pay-as-you-go)**. This is a hard block, not a warning; there is no way
  around it and no workaround worth trying.

To upgrade when the time comes: the plan indicator / **Upgrade** control is at the
bottom of the left sidebar in the console. Blaze requires a billing account with a
real card.

Blaze still includes the same free monthly allowance, so a low-traffic app usually
bills ₹0 — but it *can* bill. **Set a budget alert** when you upgrade (Google Cloud
Console → Billing → Budgets & alerts) so a runaway function cannot quietly run up a
bill. Do the upgrade and the budget alert in the same sitting.

Ask the developer before upgrading. Do not upgrade pre-emptively.

---

## 9. Is the `apiKey` a secret? No.

It is not. Do not treat it as one.

The Firebase `apiKey` **identifies** the project; it does not **authorise** anyone.
It is compiled into every copy of the app — anyone who installs the app or opens
the website can read it in about thirty seconds. This is by design and Google
documents it as such.

So:

- It is fine that it sits in `app.json` in the repo. Committing it is normal.
- Do not put it in an environment variable, a secrets manager, or a `.env` file
  believing that hides it. It ships to the client either way; you would only be
  making the build more complicated.
- Do not panic, and do not rotate the key, if someone points out that it is
  visible in the repo or in the JS bundle. Nothing is leaked.

**What actually protects the data:**

- **Firebase Security Rules** on Firestore/Storage — server-enforced rules about
  which signed-in user may read or write which document. This is the real access
  control, and it is written in code by the developer.
- **Firebase Auth** itself — the key does not let anyone log in as anyone. They
  still need a valid password or a link sent to a mailbox they control.
- Optionally **API key restrictions** in Google Cloud Console (restricting the key
  to specific APIs). Worth doing eventually; not required, and it does not make the
  key secret.

The one genuine secret in a Firebase project is a **service account JSON private
key** (Project settings → Service accounts). If you ever download one of those, it
must never be committed, emailed, or pasted into a chat. You do not need one for
this setup — do not generate one.

---

## 10. Hand back to the developer

Send this filled in.

**Config values** (paste as text, not a screenshot):

- [ ] `apiKey`
- [ ] `authDomain`
- [ ] `projectId`
- [ ] `storageBucket` (paste exactly, `.firebasestorage.app` and `.appspot.com` are both valid)
- [ ] `messagingSenderId`
- [ ] `appId`

**Confirmations:**

- [ ] The app registered in Firebase is a **Web** app (`</>`), not only Android/iOS
- [ ] **Email/Password** sign-in is enabled
- [ ] **Email link (passwordless sign-in)** is enabled — the second toggle
- [ ] Authorised domains include `localhost` and the Vercel domain, which is: `___________`
- [ ] Password reset template: sender name and subject set, **action URL left at default**
- [ ] Email sign-in template: sender name and subject set, `%LINK%` intact
- [ ] Plan is Spark (or Blaze, if the developer asked for it) — state which: `___________`
- [ ] Whether the six values were pasted into `app.json` already, or the developer should do it

**Also state:**

- The Firebase **project ID**, in plain text, so the developer can find the project
- Which **Google account** owns the project, so access can be shared
- Whether you added anyone else as a project member (Project settings → Users and
  permissions)

**Do not send:** any service account JSON key file (section 9). The six values
above are all that is needed.
