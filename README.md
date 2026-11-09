# Amed Cafe website and loyalty card

Served by GitHub Pages at **https://amedcaferest.com** (branch `main`, `CNAME`).

## Website (root)
- `index.html` is the public website ("Espresso & Gold" design): menu, rewards, offers and events, gallery and visit/contact, in Badini Kurdish, Arabic and English (flag switcher; Badini and Arabic are right-to-left).
- Visitors who have signed in to their loyalty card (localStorage `amed-session`) are sent straight to `/card/`, so old links, printed QR codes and old Home Screen icons keep opening the card. Add `?home` to the address to see the website anyway.
- `menu.json` holds the menu (names in `en`/`ar`/`ku`, prices in IQD). It is a **sample** until the real menu arrives; set `"sample": false` when it is real.
- Contact details (WhatsApp, Instagram, phone, Google Maps link, address in 3 languages) are in the `CONTACT` block at the top of the script in `index.html`. Empty values show as "coming soon".
- Offers and events come from `data.json` (`offers`, `events`), so whatever the staff add in the staff tool appears automatically.
- Gallery tiles are placeholders until real photos arrive.

## Loyalty card (`/card/`)
- `card/index.html` is the customer card page (phone + PIN). Its footer links back to the website (`../?home`). It reads `../data.json` and the shared images (`../logo*.png`, `../shisha-*.png`).
- `card/sw.js` (service worker, scope `/card/`), `card/manifest*.webmanifest` and `card/icon-*.png` belong to the card. The service worker and the iPhone "Add to Home Screen" tip only run on `amedcaferest.com` / `github.io`.
- `sw.js` at the root is a retired worker that removes itself if an old copy is installed there.

## Shared files (keep at the root)
- `data.json` holds the cards, levels, offers and events. **Do not edit by hand**: it is regenerated hourly from the staff tool by `tools/sync.py` (run by the "Amed Cafe – hourly customer-page updater" routine). It contains no names or phone numbers: each card is stored under a key made from the customer's phone number and PIN. Do not move or rename `data.json` or `tools/sync.py` without updating that routine.
- `staff-guide.html` is the staff guide (linked from the staff tool).
- `logo.png`, `logo-gold.png`, `logo-silver.png`, `logo-copper.png` and `shisha-gold.png`, `shisha-silver.png`, `shisha-copper.png` are the brand logo and real photos of the cafe's shishas.
