---
sketch: 003
name: building-dashboard
question: "How should a single building's control-center dashboard be organized, with a Documents tab/area?"
winner: null
tags: [dashboard, building, documents, control-center]
---

# Sketch 003: Building Dashboard / Control Center

## Design Question
A richer, dashboard-style page for ONE building that acts as a control center — KPIs,
quick access to all building functions (units, occupants, managers, maintenance,
announcements, millèsimes), and a first-class **Documents** area backed by the
BunnyCDN folder (`properties/{id}/buildings/{id}/`).

## How to View
open .planning/sketches/003-building-dashboard/index.html

## Variants
- **A: Section Rail + KPIs** — left section navigation + KPI header; content swaps per section. Documents is one section. Best for deep, frequent module switching.
- **B: Hero + Tabs** — dark building "hero" with KPI strip, horizontal content tabs. Documents tab opens by default (file grid + upload). Most "dashboard/control center" feel.
- **C: Card-Grid Hub** — overview as a grid of module cards (each a function with quick stats/actions); a prominent Documents card. Best at-a-glance hub.

## What to Look For
- Where do Documents belong — a peer section (A), a tab (B), or a featured card + dedicated view (C)?
- Does the KPI placement (header vs hero vs grid) read as a control center?
- How quickly can you reach a building function from landing?
- Does it stay within the DG/Fluent light look (DG Red primary, Segoe, neutral greys)?
