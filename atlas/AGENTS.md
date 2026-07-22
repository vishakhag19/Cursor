# Atlas product rules (agent memory)

Keep these constraints in mind for all Atlas UI and routing work.

## 1. Search input + suggestion list (Google Maps style)

- Search field and suggestion list share **one** white rounded card (soft shadow), not a separate bordered dropdown.
- Suggestion rows: leading icon (history clock / place pin / my_location) + **one line** of text.
- Matched query text is **bold**; the rest of the name and the address/subtitle stay regular weight in grey (`#70757a`), on the **same line** as the title (not stacked).
- Search chrome includes a trailing search affordance and a blue circular **Directions** action (Google Maps pattern).

## 2. Route options

- By default return up to **5** route options that represent the best **shortest** and **fastest** choices (deduped).
- Label badges clearly (e.g. Shortest route / Fastest route).
- Alternatives are **toggleable on the map** (show/hide), not only selectable. The active route stays visible.

## 3. Edit mode vias

- Users can **delete** a via/drag point, not only add or move it.
- Provide a clear control on each via (marker affordance or edit toolbar).

## 4. Edited route quality

- After adding/moving/deleting vias, always recompute the **shortest path that visits the vias in order** (origin → vias… → destination).
- Do not leave the user on a stale or non-optimal geometry relative to the current via set.
- Prefer snapping waypoints to the road network before the final rebuild.
