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

function dedupePlaces(places) {
  const seen = new Set();
  return places.filter((p) => {
    const key = String(p.id ?? `${p.lat},${p.lng}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rankByDistance(places, near, limit) {
  if (!near?.lat || !near?.lng) return places.slice(0, limit);
  const NEARBY_M = 80000;
  return places
    .map((p) => ({
      ...p,
      distanceMeters: haversineMeters(near, p),
    }))
    .sort((a, b) => {
      const aNear = a.distanceMeters <= NEARBY_M ? 0 : 1;
      const bNear = b.distanceMeters <= NEARBY_M ? 0 : 1;
      if (aNear !== bNear) return aNear - bNear;
      return a.distanceMeters - b.distanceMeters;
    })
    .slice(0, limit);
}

async function nominatimSearch(
  query,
  { near = null, bounded = false, viewboxDelta = 0.35, limit = 12 } = {},
) {
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("dedupe", "1");
  url.searchParams.set("limit", String(limit));
  if (near?.lat != null && near?.lng != null) {
    const d = viewboxDelta;
    url.searchParams.set(
      "viewbox",
      `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`,
    );
    url.searchParams.set("bounded", bounded ? "1" : "0");
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
  return data.map((item) => mapPlace(item));
}

/**
 * Search places, preferring nearby matches when `near` is available.
 * Local (bounded) results first, then a wider fallback so rare names still work.
 */
export async function searchPlaces(query, { limit = 8, near = null } = {}) {
  const q = query.trim();
  if (!q) return [];

  const fetchLimit = Math.max(limit * 2, 16);

  if (near?.lat != null && near?.lng != null) {
    // ~25km box — force nearby matches so partial queries surface local places.
    const local = await nominatimSearch(q, {
      near,
      bounded: true,
      viewboxDelta: 0.22,
      limit: fetchLimit,
    });

    let merged = local;
    if (local.length < limit) {
      // Widen without requiring the box, then re-rank by distance.
      const wider = await nominatimSearch(q, {
        near,
        bounded: false,
        viewboxDelta: 0.55,
        limit: fetchLimit,
      });
      merged = dedupePlaces([...local, ...wider]);
    }

    return rankByDistance(merged, near, limit);
  }

  const places = await nominatimSearch(q, { limit: fetchLimit });
  return places.slice(0, limit);
}

const ROAD_HIGHWAY_TYPES = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  "living_street",
  "service",
  "road",
  "motorway_link",
  "trunk_link",
  "primary_link",
  "secondary_link",
  "tertiary_link",
]);

function isRoadResult(place, raw = null) {
  if (!place) return false;
  const cls = raw?.class || place.category || place.type;
  const typ = raw?.type || place.type;
  if (cls === "highway" && ROAD_HIGHWAY_TYPES.has(typ)) return true;
  if (raw?.addresstype === "road") return true;
  if (place.address?.road) return true;
  return false;
}

function roadLabel(place, raw = null) {
  return (
    place.address?.road ||
    raw?.address?.road ||
    place.name ||
    (place.display_name || "").split(",")[0].trim() ||
    ""
  );
}

function roadNameKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function nominatimStreetSearch(
  query,
  { near = null, bounded = false, viewboxDelta = 0.35, limit = 12 } = {},
) {
  const url = new URL(`${NOMINATIM}/search`);
  // Structured street query biases Nominatim toward highway ways.
  url.searchParams.set("street", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("dedupe", "1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("layer", "address");
  if (near?.lat != null && near?.lng != null) {
    const d = viewboxDelta;
    url.searchParams.set(
      "viewbox",
      `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`,
    );
    url.searchParams.set("bounded", bounded ? "1" : "0");
  }
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "AtlasMaps/1.0 (route editor)",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Road search failed");
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Road search failed");
  return data
    .filter((item) => isRoadResult(mapPlace(item), item))
    .map((item) => {
      const place = mapPlace(item);
      const name = roadLabel(place, item);
      return {
        ...place,
        name: name || place.name,
        isRoad: true,
      };
    });
}

const ROAD_SUFFIXES = ["Street", "Road", "Avenue", "Drive", "Boulevard", "Lane"];

function roadQueryVariants(query) {
  const q = query.trim();
  const variants = [q];
  const lower = q.toLowerCase();
  const hasSuffix = ROAD_SUFFIXES.some(
    (s) =>
      lower.endsWith(` ${s.toLowerCase()}`) ||
      lower.endsWith(` ${s.slice(0, 2).toLowerCase()}`) ||
      lower.endsWith(" st") ||
      lower.endsWith(" rd") ||
      lower.endsWith(" ave") ||
      lower.endsWith(" dr") ||
      lower.endsWith(" blvd") ||
      lower.endsWith(" ln"),
  );
  if (!hasSuffix && q.length >= 2) {
    // Nominatim often needs a street-type word for short stems like "Main".
    for (const suffix of ROAD_SUFFIXES.slice(0, 3)) {
      variants.push(`${q} ${suffix}`);
    }
  }
  return variants;
}

async function collectStreetCandidates(query, near, fetchLimit) {
  if (near?.lat != null && near?.lng != null) {
    // Prefer nearby, but don't hard-bound — short stems often miss otherwise.
    return nominatimStreetSearch(query, {
      near,
      bounded: false,
      viewboxDelta: 0.45,
      limit: fetchLimit,
    });
  }
  return nominatimStreetSearch(query, { limit: fetchLimit });
}

/**
 * Search named roads near `near`, returning distinct road names (3–5 typical).
 * Prefer structured Nominatim `street=` results; fall back to free-form filter.
 */
export async function searchRoads(query, { limit = 5, near = null } = {}) {
  const q = query.trim();
  if (!q || q.length < 2) return [];

  const fetchLimit = Math.max(limit * 4, 16);
  const variants = roadQueryVariants(q);

  const streetBatches = await Promise.all(
    variants.map((variant) =>
      collectStreetCandidates(variant, near, fetchLimit).catch(() => []),
    ),
  );
  let candidates = dedupePlaces(streetBatches.flat());

  // Free-form fallback when structured street search is thin.
  if (candidates.length < limit) {
    const placeBatches = await Promise.all(
      variants.map((variant) =>
        searchPlaces(variant, { near, limit: fetchLimit }).catch(() => []),
      ),
    );
    const roads = placeBatches
      .flat()
      .filter((p) => isRoadResult(p) || p.address?.road)
      .map((p) => ({
        ...p,
        name: roadLabel(p) || p.name,
        isRoad: true,
      }));
    candidates = dedupePlaces([...candidates, ...roads]);
  }

  const qLower = q.toLowerCase();
  const matched = candidates.filter((place) => {
    const name = (place.name || "").toLowerCase();
    if (!name) return false;
    if (name.includes(qLower)) return true;
    // Allow "N Michigan St" style hits for query "michigan".
    return name.split(/[\s/]+/).some((tok) => tok.startsWith(qLower));
  });
  const pool = matched.length ? matched : candidates;

  const ranked = rankByDistance(pool, near, fetchLimit);
  const seen = new Set();
  const out = [];
  for (const place of ranked) {
    const name = (place.name || "").trim();
    const key = roadNameKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...place,
      name,
      isRoad: true,
    });
    if (out.length >= limit) break;
  }
  return out;
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
