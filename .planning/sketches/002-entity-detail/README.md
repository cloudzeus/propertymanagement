---
sketch: 002
name: entity-detail
question: "How should the leaf detail page (common area / unit) present βλάβες + functions?"
winner: null
tags: [detail, issues, βλάβες]
---

# Sketch 002: Entity Detail (Common area / Unit)

## Design Question
The leaf detail page is where βλάβες (issue reports) and other per-entity functions live. How should it
be laid out so issue reporting is front-and-center while specs and other functions stay accessible?

## How to View
open .planning/sketches/002-entity-detail/index.html

## Variants
- **A: Header + Tabs** — breadcrumb + entity header with primary "Νέα βλάβη"; tabs Επισκόπηση / Βλάβες / Έγγραφα / Ιστορικό. Functions as a card of actions.
- **B: Δίστηλο + feed** — issues feed as the main column (primary surface), specs in a right rail, functions below. Issue-first.
- **C: Single-scroll + sticky bar** — specs → issues in one scroll, sticky action bar at the bottom with the primary actions.

All three share: breadcrumb to the full path, "Νέα βλάβη" drawer (category/priority/photos), color-coded
issue statuses (Ανοιχτή / Σε εξέλιξη / Ολοκληρώθηκε).

## What to Look For
- Is "Νέα βλάβη" obviously the primary action?
- Tabs (A) vs everything-visible (B/C) — which suits a manager scanning quickly?
- Same template works for both Unit and Common area (only specs differ) — does it hold?
- The slide-in drawer for reporting an issue — right weight, or should it be a full page?
