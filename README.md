# Atlas — Google Maps–style clone

A browser-based maps experience inspired by Google Maps, built with Leaflet,
OpenStreetMap tiles, Nominatim search, and OSRM road routing. No API keys and
no build step.

## Features

- **Explore** — search places, drop pins, reverse-geocode map clicks
- **Directions** — A → B driving directions with distance/time
- **Create route** — click the map to add stops, drag markers to adjust, snap
  to roads, then **save** custom routes in the browser (`localStorage`)

## Run locally

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

## Stack

| Piece | Source |
| --- | --- |
| Map UI | [Leaflet](https://leafletjs.com/) (CDN) |
| Map tiles | OpenStreetMap |
| Geocoding | Nominatim |
| Routing | OSRM public demo server |

Network access to those public services is required for search and routing.
