# Public Landing Page + CMS — Design

**Ημερομηνία:** 2026-06-30
**Κατάσταση:** Approved (design)
**Scope:** Redesign του public landing σε δομημένα, CMS-managed sections + admin UI για διαχείρισή τους. Δεν αγγίζει τα υπάρχοντα /pricing, /faq, /contact, legal pages.

## Πλαίσιο

Το public landing (`app/page.tsx`) είναι σήμερα hardcoded (emoji icons, μπλε χρώματα εκτός DG/Fluent). Υπάρχουν ήδη CMS models (`CMSPage`, `FAQ`, `PricingTier`) και σελίδες /pricing /faq /contact /legal, αλλά **κανένα** admin UI και το landing δεν είναι CMS-driven. Το logged-in force-redirect αφαιρέθηκε σε προηγούμενη φάση (βλ. surfaces work).

## Στόχος

Το landing γίνεται σύνθεση **δομημένων sections** που ο super admin διαχειρίζεται από admin UI: επεξεργασία κειμένων/εικόνων/εικονιδίων, σειρά, και enable/disable ανά section. Επαγγελματικό «SaaS» look (split hero + product), DG/Fluent, react-icons/ri (όχι emoji).

## Layout (κατεύθυνση B — split + product)

Header (nav: Home/Pricing/FAQ/Contact + Login + «Δοκιμή»· logged-in → «Μετάβαση στον χώρο μου», ήδη υλοποιημένο) → **Hero** (τίτλος+subcopy+2 CTA αριστερά, screenshot δεξιά) → **Trust band/LOGOS** (λογότυπα ή στατιστικά) → **Features** (εναλλασσόμενες σειρές εικόνα/κείμενο) → **Pricing** (από `PricingTier`) → **Testimonials** (cards) → **CTA banner** → Footer (legal links).

## Data model — `LandingSection`

Νέος Prisma model:
```
model LandingSection {
  id        String   @id @default(cuid())
  type      String   // HERO | LOGOS | FEATURES | PRICING | TESTIMONIALS | CTA
  enabled   Boolean  @default(true)
  order     Int      @default(0)
  data      Json     // typed shape per type (see below)
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
  @@index([enabled, order])
}
```

- `type` τιμές περιορισμένες σε ένα TS union (όχι Prisma enum — ευελιξία· validated στο app layer).
- `data` JSON, με TS-typed shape ανά type (σε `lib/cms/landing-types.ts`). i18n: τα κείμενα μπαίνουν ως απλά strings (ελληνικά) τώρα· η δομή επιτρέπει προσθήκη `en` αργότερα χωρίς migration.
- **PRICING** section: το `data` κρατά μόνο επικεφαλίδα/υπότιτλο· τα πλάνα διαβάζονται live από `PricingTier` (καμία διπλοεγγραφή).
- **TESTIMONIALS** section: τα testimonials ζουν μέσα στο `data` JSON (array), όχι ξεχωριστός πίνακας.

### Typed `data` shapes (lib/cms/landing-types.ts)
- HERO: `{ title, subtitle, primaryCta:{label,href}, secondaryCta:{label,href}, imageUrl }`
- LOGOS: `{ heading?, items: { label, imageUrl? }[] }` (ή stats: `{ value, label }[]`)
- FEATURES: `{ heading, items: { icon (ri name string), title, body, imageUrl? }[] }`
- PRICING: `{ heading, subtitle }`
- TESTIMONIALS: `{ heading, items: { quote, author, role?, avatarUrl? }[] }`
- CTA: `{ heading, body?, cta:{label,href} }`

Η `icon` κρατείται ως **όνομα react-icons/ri** (π.χ. `"RiBuildingLine"`) και map-άρεται σε component μέσω ενός allowlist registry (`lib/cms/icon-registry.ts`) — όχι αυθαίρετο dynamic import.

## Rendering

- `app/page.tsx` γίνεται **server component** που: φέρνει `LandingSection` (enabled, order asc), και κάνει render μέσω **section registry** (`components/landing/section-registry.tsx`) — ένα component ανά type (`HeroSection`, `LogosSection`, `FeaturesSection`, `PricingSection`, `TestimonialsSection`, `CtaSection`).
- Το header (με το logged-in CTA) γίνεται ξεχωριστό client component `components/landing/landing-header.tsx` (χρειάζεται `useSession`).
- Όλα σε DG/Fluent tokens, react-icons/ri linear. Καθαρή αφαίρεση των emoji.
- `PricingSection` φέρνει `PricingTier` (published, order) όπως η /pricing.

## Admin UI

Κάτω από super-admin: `app/(company)/super-admin/cms/landing/`:
- Λίστα sections (ordered) με: enable/disable toggle, reorder (up/down), και «Επεξεργασία» που ανοίγει type-specific form.
- Server actions (`app/actions/landing-cms.ts`): `updateSection(id, data)`, `toggleSection(id)`, `reorderSection(id, dir)`. Μόνο SUPER_ADMIN (proxy ήδη φρουρεί /super-admin· οι actions επαναελέγχουν τον ρόλο).
- Εικόνες: αρχικά πεδίο URL. (Προαιρετικό upload μέσω `lib/bunnycdn.ts` / pattern του `app/actions/brand.ts` — αν χωρέσει εύκολα, αλλιώς URL-only.)
- Προσθήκη entry «CMS / Landing» στο SUPER_ADMIN menu (`components/admin/sidebar-nav.tsx`), react-icons/ri.

## Seed

Migration + seed που δημιουργεί τα 6 sections με το **σημερινό** περιεχόμενο του landing (μεταφορά των hardcoded κειμένων/feature list), ώστε το νέο landing να δείχνει ό,τι και πριν, απλώς CMS-driven και restyled.

## Out of scope
- Πολυγλωσσικό περιεχόμενο (en) — η δομή το επιτρέπει αργότερα.
- Επεξεργασία /pricing /faq /contact /legal (μένουν).
- Page-builder / drag-drop blocks (επιλέξαμε δομημένα sections).
- Image upload UI πέρα από URL (προαιρετικό stretch).

## Σημεία προσοχής
- `app/page.tsx` σήμερα είναι `'use client'`· γίνεται server component με το header αποσπασμένο σε client child — προσοχή να μη σπάσει το logged-in CTA (`homePathForRole`).
- Το icon registry πρέπει να είναι allowlist (ασφάλεια/bundle), όχι αυθαίρετο string→component.
- Seed: να τρέξει idempotent (upsert ανά type) ώστε να μην διπλασιάζει sections.
