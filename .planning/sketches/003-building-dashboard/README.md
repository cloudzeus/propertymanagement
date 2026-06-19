---
sketch: 003
name: building-dashboard
question: "How should a single building's control-center dashboard be organized, with a Documents tab/area?"
winner: "refined (B): in-app-shell + 2-row wrapping tabs, synced theme"
tags: [dashboard, building, documents, control-center]
---

# Sketch 003: Building Dashboard / Control Center

## Design Question
A richer, dashboard-style page for ONE building that acts as a control center holding a
LOT of information across many modules:

- **Αρχεία** — σχέδια/κατόψεις, φωτογραφίες, έγγραφα/συμβόλαια, πιστοποιητικά (BunnyCDN `properties/{id}/buildings/{id}/`)
- **Ημερολόγιο & Εργασίες** — επαναλαμβανόμενες εργασίες (συντήρηση ανελκυστήρα, καθαρισμός, απολύμανση…)
- **Επαφές & Χρήσιμα τηλέφωνα** — συντηρητές, προμηθευτές, έκτακτη ανάγκη
- **Κοινόχρηστα & Αποδείξεις** — μηνιαία έξοδα + συνημμένες αποδείξεις
- **Πληρωμές** — εισπράξεις/οφειλές ανά μονάδα
- **Εγκαταστάσεις & Σημεία Πρόσβασης** — ΔΕΗ μετρητές, κουτί ΟΤΕ, ταράτσα, κεραία TV, λεβητοστάσιο: φωτογραφία, όροφος/θέση, κλείδωμα, ποιος έχει πρόσβαση, ποιος κρατά το κλειδί
- Μονάδες · Ένοικοι/Ιδιοκτήτες · Διαχειριστές · Συντήρηση/Βλάβες · Ανακοινώσεις · Χιλιοστά

Plus KPIs and quick actions at the top.

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
