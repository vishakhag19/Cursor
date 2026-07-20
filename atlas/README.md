# Atlas

Google Maps–style web app with place search, turn-by-turn directions, and **custom route creation**.

## Features

- **Explore** — search places (OpenStreetMap / Nominatim), drop pins, open context actions
- **Directions** — A→B driving routes via OSRM
- **Create route** — click the map (or search) to add stops, drag pins, reorder, snap to roads (drive / walk / bike), save & reload routes from local storage
- Map / Satellite layers and geolocation

## Run

```bash
cd atlas
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Stack

React + Vite + Leaflet + react-leaflet. Routing: [OSRM](https://project-osrm.org/). Geocoding: [Nominatim](https://nominatim.openstreetmap.org/).
