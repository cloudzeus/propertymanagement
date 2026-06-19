---
sketch: 001
name: hierarchy-tree
question: "How to schematically present the deep entity hierarchy with per-entity actions?"
winner: null
tags: [tree, navigation, hierarchy]
---

# Sketch 001: Hierarchy Tree

## Design Question
How do we present the deep hierarchy (Customer → Property → Building → Floor → {Common areas, Units})
so it is instantly scannable AND gives a per-entity action menu at every level?

## How to View
open .planning/sketches/001-hierarchy-tree/index.html

## Variants
- **A: Indented tree** — single expandable tree with connector lines, color-coded entity icons, hover kebab (⋯) menu per row. Closest to the current implementation, refined.
- **B: Miller columns** — Finder-style cascading panels; pick level by level, each column reveals the next. Great for deep/wide data, less "schematic at a glance".
- **C: Nested cards** — each top entity is a card; children nest in tinted card bodies. Strong visual grouping, heavier vertically.

## What to Look For
- Which reads most clearly as a *schema* of the structure?
- Do the per-entity ⋯ actions feel discoverable but unobtrusive?
- How does each scale to 3 buildings × 3 floors × 4 units (deep nesting)?
- Color-coding per entity type (property/building/floor/unit/common-area) — helpful or noisy?
