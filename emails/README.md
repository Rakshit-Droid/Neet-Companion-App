# Email templates

Setup lives in [../docs/EMAIL_SETUP.md](../docs/EMAIL_SETUP.md). This file is the
subject lines and the rules for each send.

## Auth emails — Firebase sends these

Paste only the `<!-- BODY -->` section into the Firebase console. `%LINK%` must
survive intact in all three.

| File | Subject | Preheader |
|---|---|---|
| `password-reset.html` | Reset your NEET Companion password | Set a new password. The link works once and expires in an hour. |
| `sign-in-link.html` | Your NEET Companion sign-in link | Tap to sign in. No password needed. |
| `verify-email.html` | Confirm your email for NEET Companion | Confirm the address your credits and watchlist are tied to. |

Sender name: **NEET Companion**. Sender address: **no-reply@mail.neetcompanion.com**
(or whatever domain you verified in Resend).

Subjects say what the email is, not what the brand is. `Reset your NEET Companion
password` beats `NEET Companion — Account Notification`: a student searching their
inbox for "reset" finds the first one.

## Product emails — we send these, over the Resend API

Not built yet; Cloud Functions need Blaze. These are the templates to send when
they are.

| File | Subject | Trigger | Rate limit |
|---|---|---|---|
| `welcome.html` | Welcome to NEET Companion | account created | once, obviously |
| `credits-low.html` | You are low on credits | balance < one search | 1 per user per week |
| `watch-expiring.html` | A college you watch is about to stop being tracked | week ends within 2 days **and** balance cannot cover it | 1 per user per week, all colleges in one email |
| `referral-paid.html` | You earned 50 credits | referred friend's first pack settles | per payout |

### Rules worth not rediscovering the hard way

- **`watch-expiring` only sends when the renewal will actually fail.** A renewal
  that will succeed is a silent automatic charge; emailing about it is noise.
- **`referral-paid` sends on `status: "paid"` only**, never `"alreadySettled"`.
  Racing settlements all reach the payout branch, and only one of them moves
  credits — see `settleReferralOnPurchase` in `src/lib/referrals.ts`.
- **`referral-paid` never names the friend.** The referrer does not need to know
  who bought what, and telling them leaks someone else's purchase.
- **Every product email needs an unsubscribe link.** Auth emails must not have
  one — you cannot unsubscribe from your own password reset.

## Design

One column, 520px, tables and inline styles. No external images, so nothing
breaks when a client blocks remote content and there is no tracking pixel to
justify.

Lime `#7ccf00` with `#12200a` text on it — measured 8.72:1. White on lime is
1.95:1 and unusable, which is why no button uses it. Body text `#0a0a0a`, muted
`#646464` (5.92:1 on white).

The app's Quantico wordmark cannot be used: custom fonts do not load reliably in
email. The letter-spaced bold sans in the header is the stand-in.

Product emails carry a `prefers-color-scheme: dark` block. The auth emails do not
— Firebase's editor strips `<style>`, so they are light-only by necessity.

## Testing

Send yourself one of each before launch. The three that break most often:

- **Gmail on Android** clips emails over ~102KB — these are all far under.
- **Outlook desktop** renders with Word, which ignores `border-radius`. Buttons
  come out square there. Acceptable, and the reason they are table cells rather
  than styled `<div>`s.
- **Dark mode on iOS Mail** inverts colours it thinks are backgrounds. Check the
  lime blocks in `referral-paid.html` still read.

Resend's dashboard shows every send with its delivery status, which beats
guessing from Firebase.
