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

## 1. Resend: verify a domain

Emails must come from a domain you own. `onboarding@resend.dev` works for testing
but must never be used in production — it is shared, and Firebase will happily
send real password resets from it.

1. <https://resend.com/domains> → **Add Domain**.
2. Enter the domain you will send from. A subdomain is the better choice:
   **`mail.neetcompanion.com`** rather than the bare domain. Sending from a
   subdomain keeps a deliverability problem with marketing mail from poisoning
   the reputation of your transactional mail, and vice versa.
3. Resend shows DNS records to add — an MX record, and TXT records for SPF and
   DKIM. Add them at whoever hosts the domain's DNS.
4. Wait for all records to show **Verified**. This is usually minutes but the TTL
   on existing records can make it an hour.

Do not skip DKIM. Without it Gmail marks the mail as unauthenticated, and
password resets land in spam — which reads to users as the app being broken.

Recommended once verified: add a **DMARC** record (`_dmarc.mail.neetcompanion.com`,
`v=DMARC1; p=none; rua=mailto:you@neetcompanion.com`). Start at `p=none`, which
only reports and never blocks.

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
- **Sender address:** `no-reply@mail.neetcompanion.com` — must be on the domain
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
mail as your domain. It belongs in the Firebase console and in Cloud Functions
config only. **Never** put it in `app.json`, in the repo, or in any
`EXPO_PUBLIC_*` variable — those are compiled into the client and readable by
anyone who installs the app.

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
