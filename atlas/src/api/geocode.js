const NOMINATIM = "https://nominatim.openstreetmap.org";

function mapPlace(item, fallbackLat, fallbackLng) {
  const address = item.address || {};
  const name =
    item.name ||
    address.amenity ||
    address.tourism ||
    address.shop ||
    address.building ||
    address.road ||
    (item.display_name || "").split(",")[0].trim() ||
    "Dropped pin";

  return {
    id: String(item.place_id ?? `${fallbackLat},${fallbackLng}`),
    name,
    display_name:
      item.display_name ||
      `${(fallbackLat ?? Number(item.lat)).toFixed(5)}, ${(fallbackLng ?? Number(item.lon)).toFixed(5)}`,
    lat: fallbackLat ?? Number(item.lat),
    lng: fallbackLng ?? Number(item.lon),
    type: item.type || item.class || "pin",
    category: item.class || item.category || null,
    osm_type: item.osm_type || null,
    osm_id: item.osm_id || null,
    address: {
      road: address.road || address.pedestrian || null,
      house_number: address.house_number || null,
      neighbourhood: address.neighbourhood || address.suburb || null,
      city:
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        null,
      state: address.state || null,
      postcode: address.postcode || null,
      country: address.country || null,
    },
    extratags: item.extratags || {},
  };
}

export function haversineMeters(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatNearDistance(meters) {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m away`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km away` : `${Math.round(km)} km away`;
}

/**
 * Search places, optionally biased/sorted by nearest to `near`.
 */
export async function searchPlaces(query, { limit = 8, near = null } = {}) {
  const q = query.trim();
  if (!q) return [];
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("limit", String(Math.max(limit, 12)));
  if (near?.lat != null && near?.lng != null) {
    // Bias results around the user (~50km box), but still allow global matches.
    const d = 0.45;
    url.searchParams.set(
      "viewbox",
      `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`,
    );
    url.searchParams.set("bounded", "0");
  }
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "AtlasMaps/1.0 (route editor)",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Search failed");
  let places = data.map((item) => mapPlace(item));

  if (near?.lat != null && near?.lng != null) {
    places = places
      .map((p) => ({
        ...p,
        distanceMeters: haversineMeters(near, p),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);
  } else {
    places = places.slice(0, limit);
  }

  return places;
}

export async function reverseGeocode(lat, lng) {
  const url = new URL(`${NOMINATIM}/reverse`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("zoom", "18");
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Reverse geocode failed");
  const item = await res.json();
  return mapPlace(item, lat, lng);
}

export function formatAddressLines(place) {
  if (!place?.address) return [place?.display_name].filter(Boolean);
  const a = place.address;
  const line1 = [a.house_number, a.road].filter(Boolean).join(" ");
  const line2 = [a.neighbourhood, a.city].filter(Boolean).join(", ");
  const line3 = [a.state, a.postcode, a.country].filter(Boolean).join(", ");
  const lines = [line1, line2, line3].filter(Boolean);
  return lines.length ? lines : [place.display_name];
}
