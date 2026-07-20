# AGENTS.md

## Cursor Cloud specific instructions

### What this codebase is
**Atlas** — a dependency-free Google Maps–style web app (plain HTML/CSS/JS +
Leaflet via CDN). There is **no build step and no npm install**. Files:
`index.html`, `styles.css`, `app.js`.

### Run it (development)
From the repo root:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Edits to HTML/CSS/JS apply on browser refresh.

### Modes to verify
1. **Explore** — search a place; click the map to drop a pin.
2. **Directions** — enter start/end (or right-click map → set start/end).
3. **Create route** (core feature) — switch to Create route, click 2+ points on
   the map, click **Build route**, then **Save route**. Saved routes persist in
   `localStorage` (`atlas.savedRoutes.v1`).

### External services (egress)
Search and routing need outbound HTTPS to:
- `nominatim.openstreetmap.org` (geocoding)
- `router.project-osrm.org` (driving routes)
- `*.tile.openstreetmap.org` (map tiles)
- `unpkg.com` (Leaflet CDN)
- `fonts.googleapis.com` / `fonts.gstatic.com`

If those are blocked, the map shell still loads but search/routing will fail.

### Lint / test / build
None. Verify by serving and exercising the three modes in a browser.
