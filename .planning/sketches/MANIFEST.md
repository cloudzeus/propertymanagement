# Sketch Manifest

## Design Direction
Greek-first management UI for a single-tenant building-management platform, built on the existing
DG / Fluent 2 design system (light surfaces, neutral greys, DG Red primary, Segoe UI). Two surfaces:
(1) a schematic, scannable representation of the deep entity hierarchy
Customer → Property (Ιδιοκτησία) → Building (Κτήριο) → Floor (Όροφος) → {Common areas, Units}, with
per-entity action menus; (2) a leaf-level detail page (Common area / Unit) that is the home for
βλάβες (issue reports) and other per-entity functions.

## Reference Points
- Existing app: DG/Fluent light sidebar, DataTable, expandable rows (current CustomerTree/BuildingsTree).
- Fluent 2 / Microsoft 365 admin trees; macOS Finder column view; Linear/Notion detail panels.

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | hierarchy-tree | How to schematically present the deep entity hierarchy with per-entity actions? | TBD | tree, navigation |
| 002 | entity-detail | How should the leaf detail page (common area / unit) present βλάβες + functions? | TBD | detail, issues |
