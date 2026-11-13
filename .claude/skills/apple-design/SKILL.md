---
name: apple-design
description: Apple-inspired premium design language: minimal layouts, generous white space, refined typography, restrained motion, and hero product imagery. Use whenever designing or building any website page, landing page, product page, email, or social graphic, or when the user asks for an "Apple-style", "clean", "minimal", or "premium" look.
---

# Apple-Inspired Design

Aim for the calm, confident, product-first feel of Apple's marketing pages. The product is the hero and everything else steps back. Borrow the *principles* only: never Apple's logos, product names, icons, copy or proprietary fonts.

## 1. Core principles
1. Product first. One focal item per view, large, centered and well lit.
2. Restraint. One idea per section, one primary action per screen.
3. White space is a feature. When unsure, add space, not content.
4. Clarity over cleverness. Short headlines, plain language, obvious navigation.
5. Craft in the details. Precise alignment, consistent corner radii, smooth easing, crisp imagery.

## 2. Layout
- 12-column grid. Max content width 1200px; text blocks ≤ 680px.
- Section vertical padding: 96–160px on desktop, 64–96px on mobile.
- Page gutter: 16px mobile, 24px tablet, 40px+ desktop. No horizontal scroll.
- Alternate centered hero sections with split (image | text) sections.
- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160. Use only these.
- Mobile-first. Every layout must look intentional at 375px wide.

## 3. Typography
Use the system font stack (Apple devices render San Francisco natively) with Inter as the web fallback. Never embed SF Pro: its license restricts it to Apple platforms.
--font-sans: -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif;
--font-serif: "Cormorant Garamond", "Times New Roman", serif; /* optional, for names only */

Display 72–96px desktop / 40–48px mobile, weight 600, tracking -0.02em
H2 48–56 / 32–36, 600, -0.015em
H3 28–32 / 22–24, 500, -0.01em
Body 19–21 / 17, 400
Caption 12–14, 500, 0.02em
Line height: 1.05–1.1 display, 1.2 headlines, 1.5 body. Sentence-case headlines. Uppercase eyebrow labels with 0.12em tracking. Max two font families.

## 4. Color
:root { --bg:#ffffff; --bg-alt:#f5f5f7; --text:#1d1d1f; --text-muted:#6e6e73; --hairline:#d2d2d7; --accent:#b08d57; --accent-ink:#ffffff; }
@media (prefers-color-scheme: dark) { :root { --bg:#000000; --bg-alt:#161617; --text:#f5f5f7; --text-muted:#a1a1a6; --hairline:#424245; --accent:#d4b483; --accent-ink:#1d1d1f; } }
- Never pure black text on white. Use one accent sparingly. Contrast must meet WCAG AA.

## 5. Imagery
- Studio-quality shots on clean backgrounds with soft directional light.
- Ingredients as quiet supporting elements at the edges.
- AVIF/WebP with srcset. Lazy-load below the fold. No busy stock photos, heavy filters or text baked into images.

## 6. Components
- Buttons: pill shape (border-radius 980px), 12px × 22px padding, 17px text. Primary = accent fill; secondary = text link with a "›" chevron ("Learn more ›").
- Cards: 18–24px radius, --bg-alt fill, no border, no heavy shadow.
- Nav: slim (44–48px), sticky and translucent: background: rgb(255 255 255 / .72); backdrop-filter: saturate(180%) blur(20px);
- Tiles: image, name, one-line description, price, single CTA.
- Icons: thin line icons (1.5px stroke) with rounded caps.

## 7. Motion
- Fade + 16–24px rise on scroll reveal. Subtle parallax on hero images.
- 300–600ms, easing cubic-bezier(0.25, 0.1, 0.25, 1).
- Always honor prefers-reduced-motion: reduce.

## 8. Copy voice
- Short, sensory, confident. Headlines of 2–6 words, one supporting sentence of ≤ 20 words.
- Concrete over abstract. No exclamation marks, no ALL CAPS, no stacked superlatives.

## 9. Page recipe
Sticky translucent nav → hero (eyebrow, name, tagline, image, two CTAs) → full-bleed mood image with one line of copy → feature rows alternating image | text → menu/pricing cards → collection strip → quiet footer on --bg-alt.

## 10. Checklist before shipping
- One focal item and one primary CTA per screen
- Spacing uses only scale values
- Looks deliberate at 375px, 768px and 1440px
- Light and dark modes both checked; contrast passes AA
- Images sharp and optimized, with meaningful alt text
- Motion respects reduced-motion
- No Apple trademarks, logos, product names or proprietary assets
