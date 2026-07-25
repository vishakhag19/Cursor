# Design assumptions to review

Flagged guesses from the route-control suite implementation (not product-final):

1. **Brand label** — product name is **Maps** (document title and user-facing copy).
2. **Traffic** — mock light/moderate/heavy from duration + turn density + route id hash. No live traffic API.
3. **Highway / road-quality metrics** — inferred from OSRM step names & maneuver types (not OSM `highway=*` tags).
4. **Route options** — Avoid tolls / highways / ferries + Scenic roads / Fewest turns / Good roads / Prefer fuel-efficient, with In your vehicle (avatar, toll pass prices, engine type). Instant toggles; no Apply button. Scenic & good-road quality use step-name heuristics (no OSM tourism tags).
5. **Travel modes** — Drive, Two-wheeler, Transit, Walk, Bicycle, Ride. Transit is UI-only (unsupported by public OSRM). Two-wheeler and Ride use the driving profile.
6. **Reroute demo** — fires ~5–12s after Start with copy “Accident reported ahead…”. Timing and incident story are placeholders for usability testing.
7. **Road rules home** — Avoided roads live under Route preferences → Your road rules (not Saved). Saved is custom routes only.
8. **Trade-off copy** — “vs recommended: 3 min faster, but adds a highway” pattern; tone may need polish.
9. **Map tap adds mid-stop** when A/B are already set and the tap is away from the route; taps near the route / after a drag are ignored so reshape doesn’t insert stops.
10. **Directions / sheet exit** — back arrow on the left of section titles.
11. **Prefs sheet Y** — desktop top-aligned with the tune icon (~64px); X unchanged (beside the panel).

Ranking weights that actually change order live in `utils/routeRecommend.js` (`scoreRoute`) with inline comments.
