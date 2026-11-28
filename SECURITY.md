# Amed Cafe — security notes

Static site on GitHub Pages (`amedcaferest.com`), Firebase project `amed-cafe` (Firestore + Google sign-in for staff).
Everything served by GitHub Pages is public, including JavaScript. **Access control lives only in `firestore.rules`.**

## Data model and who can reach it

| Path | Contents | Public | Staff | Owner |
|---|---|---|---|---|
| `public/meta` | programs, levels, offers, events, cafe WhatsApp | read | read | write (fixed shape) |
| `cards/<32-hex key>` | first name, member code, counts | **get one exact key** (no list) | list, write (bounds-checked) | write, larger corrections |
| `gifts/<16-char code>` | gift card | get one exact code | create, redeem/void once | delete |
| `reports/<secret id>` | nightly summary (written by the reports@ reader account) | get one exact id | — | write |
| `customers/<phone>` | name, phone (doc id), PIN, history | — | read/write | read/write |
| `settings/*` | loyalty settings | — | read | write |
| `invites/*` | staff join codes, shift-PIN hashes | — | list | write |
| `staffclaims/<uid>` | legacy join-code claims | — | read | — (users create their own) |
| `staff/<uid>` | staff allowlist (Console/Admin SDK only) | — | read own | — |
| `private/owner` | owner check | — | — | read |
| anything else | | denied | denied | denied |

"Staff" = signed in with Firebase Auth **and** (owner e-mail, verified) or a `staff/<uid>` document or (legacy) a claim of an active join code.

## Customer card key

`key = PBKDF2-HMAC-SHA256(password = PIN, salt = "amed-cafe:" + normalised phone, 100 000 iterations, 128 bits)`, computed in the browser with Web Crypto (`crypto.subtle`), identically in `card/index.html` (`hash`) and `staff/bridge.js` (`cardKey`).

* Normalisation: Arabic/Persian digits → 0–9, non-digits removed, `00`/`+` removed, home country code 964 removed (when the number is longer than 10 digits), leading zeros removed; foreign numbers keep their country code. The card page accepts only 7–15 digits and a 6-digit PIN (or an old 4-digit one) before hashing.
* The salt is per customer (their phone number). There is **no client-side pepper**: any value shipped to the browser is public, so it would add no secrecy.
* **Limit (be aware):** customer PINs are 6 digits since Nov 2026 (1,000,000 combinations per person); members who have not been given a new PIN yet still have a 4-digit one (10,000). Someone who knows a member's phone number can try PINs against Firestore one read at a time, and Firestore rules cannot rate-limit reads. The only harm is reading that member's first name, member code and stamp counts; nobody can write a card without staff access. To reduce this further:
  1. enable and **enforce Firebase App Check** (below), which blocks scripted access from outside the real site;
  2. give every member a 6-digit PIN (staff tool → member → "Edit or remove member" → "Make a new PIN"); long term, move the lookup behind a Cloud Function with per-IP/per-phone rate limiting.
* `card/index.html` also slows guessing in the browser (after 5 misses: 30 s, doubling up to 15 min). That is a deterrent only.

## Browser storage

| Key | Holds | Notes |
|---|---|---|
| `amed-session` | `{"v":1,"k":"<card key>","t":<first sign-in ms>,"s":<last use ms>}` | Never the phone, PIN or name. Rejected and removed if malformed, in the future, or unused for 90 days; removed on Sign out or when the card no longer exists. Older phones' bare-key value is upgraded on the next visit. |
| `amed-live-at` | time of the last celebrated stamp | Only a number in the past is trusted; removed with the session. |
| `amed-lang` | `ku`/`ar`/`en`/`de` | Validated against the known languages. |
| `amed-meta-cache` | last `public/meta` (public info) | Offline fallback only; any `cards` field is dropped. |
| `amed-lookup-lock` | miss counter + wait-until time | Guessing deterrent. |

`card/sw.js` caches only the page and its static files (no query strings, never `.json`). Firestore is a different origin and is never cached. The cache name went from `amed-card-v3` to `amed-card-v4`, so old caches, which could hold a copy of `data.json`, are deleted on the next visit.

## URLs

* `/card/` ignores and removes every query parameter (`?id=`, `?code=`, `?ref=`, `?k=`…) and every hash except a language (`#ku`, `#ar`, `#en`, `#de`). Only phone number + PIN open a card. Member and referral codes are labels, never credentials.
* `/staff/#m-CODE` (from a customer's QR) only selects a member in the staff-only list that is already loaded. It is accepted only as `[A-Z0-9]{6}`, and it needs a signed-in staff account like everything else on that page. There is no Firestore query by code: the staff list is a snapshot of `customers`, which only staff can read.
* `/scan/` sends scans only to its own origin (`postMessage(…, location.origin)`) and accepts answers only from it. The old `"*"` target, the `claude.ai` origin and the public ntfy.sh relay are gone.

## Staff authentication

* Real gate: Google sign-in (Firebase Auth) plus `firestore.rules`. The name + 4-digit "shift PIN" on the shared tablet only records **who** is working on a device that is already signed in to the cafe account. It is not a security boundary, and the rules never rely on it.
* Join codes are now `AMED-` + 8 random characters. Codes made earlier with 4 characters still work: switch them off and add the person again when convenient.
* Preferred: give each staff member a `staff/<uid>` document in the Firebase Console (fields: `name`, `active: true`, `role: "staff"`). Once everyone has one, remove `|| legacyClaim()` from `isStaff()` in `firestore.rules`. That closes join-code guessing entirely.

## Inspection deterrent (`js/guard.js`)

On `/card/` and `/staff/` it blocks the right-click menu (not in text fields), F12, Ctrl+Shift+I/J/C/K, Ctrl+U and Cmd+Option+I/J/C/U, and on computers shows "Inspection of this system has been disabled." while DevTools appear to be open. **This is UX deterrence, not security.** Static files on GitHub Pages and Firestore traffic can always be seen at the transport level (proxy, `curl`, extensions, JavaScript turned off). The real protection is removing `data.json`, the Firestore rules and App Check.

## Public identifiers that are not secrets

The Firebase web `apiKey`, project id and app id, the Cloudflare Web Analytics token, and the cafe's own business phone/WhatsApp are meant to be public. In Google Cloud Console → APIs & Services → Credentials → *Browser key*, add **API restrictions** (Cloud Firestore API, Identity Toolkit API, Token Service API). Add **Website restrictions** (`https://amedcaferest.com/*`, `https://thameralyas-ai.github.io/*`) only after the nightly summary task stops calling Firestore with `curl` and this key, because that call sends no referrer and would be refused.

## Firebase App Check (rollout order matters)

`vendor/amed-firebase.js` does **not** include the App Check module yet. The homepage (`index.html`), the gift page and the nightly summary task call Firestore's REST API directly. So:

1. Firebase Console → App Check → register the web app with **reCAPTCHA Enterprise** (domain `amedcaferest.com`), and leave Firestore **un-enforced** (monitoring only).
2. Rebuild `vendor/amed-firebase.js` with `initializeAppCheck` + `ReCaptchaEnterpriseProvider` and call it right after `initializeApp` in `card/index.html` and `staff/bridge.js`. Send the `X-Firebase-AppCheck` header from the REST calls in `index.html` and `gift/index.html`. Move the nightly summary to a service account.
3. Watch App Check → Firestore metrics until verified requests are close to 100%, then **Enforce**.

Enforcing before step 2 makes the card page, the staff tool, the homepage rewards and the gift page stop working.

## Tests

```bash
npm i -D firebase-tools @firebase/rules-unit-testing firebase
npx firebase emulators:exec --only firestore --project demo-amed "node --test tests/firestore.rules.test.mjs"
```
