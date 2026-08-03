# Email — Resend + Firebase

Every email this product sends falls into one of two groups, and they are wired up
completely differently. Getting this distinction right first saves a lot of wasted
work.

| Group | Sent by | How Resend is involved | Needs Cloud Functions |
|---|---|---|---|
| **Auth emails** — password reset, sign-in link, address verification | Firebase Auth | Firebase's **custom SMTP**, pointed at Resend | No |
| **Product emails** — welcome, credits low, watch expiring, referral paid | Our own code | Resend's **HTTP API** | Yes (Blaze) |

**You cannot make the app send a password reset through Resend directly.** The app
calls `sendPasswordResetEmail()`, and Firebase generates the one-time code and
sends the mail from its own servers. The only supported way to change who
delivers that mail — and to make it come from your domain — is to give Firebase
an SMTP server to relay through. That is what section 2 does.

---

## 1. Resend: the sending domain

**Already done.** `forms.neetcompanion.com` is verified in Resend with sending
enabled, so there is no DNS work for this. Send as:

```
no-reply@forms.neetcompanion.com
```

It must be on that subdomain. Resend rejects a From address on a domain it has
not verified, and the root `neetcompanion.com` is not verified — its MX points at
Zoho, which is the real inbox and should stay untouched.

`onboarding@resend.dev` works for a smoke test but must never reach production:
it is shared infrastructure, and Firebase will happily send real password resets
from it.

Worth adding at some point: the domain has **no DMARC record**. Add a TXT record
named `_dmarc` with `v=DMARC1; p=none; rua=mailto:you@neetcompanion.com`.
`p=none` only reports and never blocks, so it is safe to add today, and it
protects the Zoho mail as well as this. DNS for the domain is at Hostinger —
nameservers are `ns1/ns2.dns-parking.com`.

---

## 2. Resend SMTP into Firebase

### Get the SMTP credentials

Resend → **API Keys** → **Create API Key**. Sending permission is enough; it does
not need full access. Copy it — the key is shown once.

Resend's SMTP endpoint:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `587` (STARTTLS) or `465` (TLS) |
| Username | `resend` — the literal word, not your email |
| Password | the API key, `re_...` |

The username being the fixed string `resend` catches people out; it is not an
address and not an account name.

### Point Firebase at it

Firebase console → **Authentication** → **Templates** → **SMTP settings** (the
link sits above the template list, not inside a template).

- **Sender name:** `NEET Companion`
- **Sender address:** `no-reply@forms.neetcompanion.com` — must be on the domain
  verified in step 1, or Resend rejects the message
- **SMTP server address:** `smtp.resend.com`
- **Port:** `587`
- **Username:** `resend`
- **Password:** the Resend API key
- **Security mode:** `STARTTLS` for port 587, `SSL` for 465

Save, then use **Send test email** if the console offers it. If not, trigger a
real password reset from the app and watch <https://resend.com/emails> — every
send appears there with its delivery status, which is far better debugging than
Firebase gives you.

### The API key IS a secret

Unlike the Firebase `apiKey`, which is public by design, the Resend key can send
mail as your domain — that is a spoofing and reputation risk, not a minor one.
It belongs in the Firebase console and in Cloud Functions config only.

**Never** put it in `app.json`, in this repo, or in any `EXPO_PUBLIC_*` variable.
Those are compiled into the client and readable by anyone who installs the app.
There is deliberately no Resend key anywhere in this codebase.

If a key has ever been pasted into a chat, a ticket, or a screenshot, treat it as
compromised and rotate it: create a new key at <https://resend.com/api-keys>,
update the Firebase SMTP password, then delete the old one.

---

## 3. Auth email templates

Console → **Authentication** → **Templates**. Three templates matter:

| Template | When it fires | Our code |
|---|---|---|
| Password reset | user taps "Forgot your password?" | `sendReset()` in `src/lib/auth.ts` |
| Email address sign-in | user asks for a sign-in link | `sendMagicLink()` |
| Email address verification | only if verification is switched on later | not called yet |

Paste the bodies from [`emails/`](../emails/) — `password-reset.html`,
`sign-in-link.html`, `verify-email.html`.

Rules that are easy to get wrong:

- **`%LINK%` must survive intact.** It is the one-time URL. Delete it and you send
  an email with no way to act on it. `%EMAIL%`, `%APP_NAME%` and `%DISPLAY_NAME%`
  are also available.
- **Do not change the action URL** on the password-reset template. The default
  (`https://<project-id>.firebaseapp.com/__/auth/action`) is the page that
  actually performs the reset, and nobody has built a replacement.
- The sign-in-link template is the one whose continue URL the app sets in code —
  `expo.extra.magicLinkUrl` in `app.json`. That domain must be listed under
  **Authentication → Settings → Authorized domains** or the link errors on
  arrival with `auth/unauthorized-continue-uri`.

### Firebase's editor is limited

It accepts HTML, but it is not a full email builder: no `<style>` blocks, no
media queries, and it may strip attributes it does not recognise. The three auth
templates in `emails/` are written for that constraint — tables, inline styles
only, single column, no external images. They will look plainer than the product
emails, and that is deliberate.

Paste the contents of the `<!-- BODY -->` section, not the whole file. Each file
says where that starts.

---

## 4. Product emails (later, needs Blaze)

These are ours to send, over Resend's HTTP API from a Cloud Function:

| Template | Trigger |
|---|---|
| `welcome.html` | account created |
| `credits-low.html` | balance falls below the cost of one search |
| `watch-expiring.html` | a watched college's week ends within 2 days |
| `referral-paid.html` | a referred friend buys their first pack |

None of these exist in code yet — Cloud Functions need the Blaze plan, and the
credit ledger is still on the device. When that moves server-side, these are the
templates to send.

They have no Firebase editor to survive, so they carry the full design.

**Send rules, when you build them:**

- Every one of these is a notification, not a transaction the user asked for, so
  each needs an unsubscribe path. Auth emails do not — you cannot unsubscribe
  from your own password reset.
- `credits-low` and `watch-expiring` must be rate limited to at most one a week
  per user. A balance that hovers below the threshold otherwise emails on every
  single check.
- Do not send `watch-expiring` for a college whose renewal will succeed anyway.
  Only warn when the balance cannot cover it.

---

## 5. The logo

Every template opens with the logo, top left. Two files, both served from the web
build:

| File in repo | Served at | Used when |
|---|---|---|
| `public/email/logo-on-light.png` | `/email/logo-on-light.png` | light background — always, for auth emails |
| `public/email/logo-on-dark.png` | `/email/logo-on-dark.png` | dark background — product emails only |

Anything in `public/` is copied to the root of the web export, so these deploy
with the app and need no separate hosting.

**Why not inline the logo as a `data:` URI.** It would be self-contained and
immune to image blocking, and it is the obvious idea. **Gmail does not render
`data:` URI images** — it drops them entirely, and Gmail is most of this
audience. So the logo has to be a hosted `https://` URL, which means some clients
will hide it until the reader taps "show images". That is why the `alt` text on
every logo is styled to match the wordmark it replaced: with images blocked, the
email still opens with "NEET Companion" in the right place and weight rather than
a broken-image icon.

**The dark variant is swapped by the same `prefers-color-scheme` query that
darkens the card**, not a separate one. They cannot disagree: a client that
supports the query gets the dark card and the light-ink logo together, and one
that does not gets the light card and the dark-ink logo together. Auth emails
have no `<style>` block to swap in — Firebase strips it — so they are light-only
and use the dark-ink logo unconditionally.

**If the app moves to a custom domain**, the `src` on both images in all seven
templates has to change with it. They are absolute URLs; there is no base tag to
edit in one place, because email clients ignore `<base>`.

---

## 6. Under-18 recipients

The audience is largely 17–18. Under India's DPDP Act 2023 an under-18 is a
child, and behavioural or promotional emailing to children is restricted.

Everything in section 4 is transactional — account state and things the user
themselves set up — which is the safe category. **Do not** add promotional
campaigns, streaks, or re-engagement sequences to this list without dealing with
age and consent first.

---

## 7. Checklist

- [ ] Domain added in Resend and all DNS records verified, DKIM included
- [ ] DMARC record added at `p=none`
- [ ] Resend API key created (sending permission)
- [ ] Firebase SMTP settings filled in and saved
- [ ] Test password reset actually arrives, and appears in the Resend dashboard
- [ ] Password reset template: body pasted, `%LINK%` intact, action URL untouched
- [ ] Sign-in link template: body pasted, `%LINK%` intact
- [ ] Vercel domain listed under Authorized domains
- [ ] API key is nowhere in the repo
- [ ] Logo loads at `/email/logo-on-light.png` on the deployed domain
