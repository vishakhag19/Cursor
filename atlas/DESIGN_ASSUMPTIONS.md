# Design assumptions to review

Flagged guesses from the route-control suite implementation (not product-final):

1. **Brand label** — panel chrome shows “Maps” (Google Maps–style short name). Confirm vs keeping “Atlas”.
2. **Traffic** — mock light/moderate/heavy from duration + turn density + route id hash. No live traffic API.
3. **Highway / road-quality metrics** — inferred from OSRM step names & maneuver types (not OSM `highway=*` tags).
4. **Prefs icons** — Material icons `park`, `straight`, `add_road`, `no_crash`, `money_off`, `road`. Swap if desired.
5. **Reroute demo** — fires ~12s after Start with copy “Accident reported ahead…”. Timing and incident story are placeholders for usability testing.
6. **Road rules home** — Avoided roads live under Route preferences → Your road rules (not Saved). Saved is custom routes only. Legacy Avoided list migrates into road rules as “Avoid”.
7. **Trade-off copy** — “vs recommended: 3 min faster, but adds a highway” pattern; tone may need polish.
8. **Map tap adds mid-stop** when A/B are already set — may surprise users who meant to pan; long-press remains the road-rule gesture.
9. **Directions exit** — back arrow in the Directions header (not ×) so it doesn’t compete with the panel collapse chevron.

Ranking weights that actually change order live in `utils/routeRecommend.js` (`scoreRoute`) with inline comments.
