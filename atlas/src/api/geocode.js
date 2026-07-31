const NOMINATIM = "https://nominatim.openstreetmap.org";

/** Public Nominatim allows ~1 req/s. Parallel typeahead bursts get 403. */
const NOMINATIM_MIN_INTERVAL_MS = 1100;

let nominatimChain = Promise.resolve();
let nominatimNextAt = 0;

/**
 * Serialize every Nominatim call and space them ≥1.1s apart.
 * Callers still get a normal Promise; aborts reject when the wait/fetch is cancelled.
 */
function enqueueNominatim(run, signal) {
  const job = nominatimChain.then(async () => {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const wait = Math.max(0, nominatimNextAt - Date.now());
    if (wait > 0) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, wait);
        const onAbort = () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        };
        if (signal) {
          if (signal.aborted) {
            onAbort();
            return;
          }
          signal.addEventListener("abort", onAbort, { once: true });
        }
      });
    }
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    nominatimNextAt = Date.now() + NOMINATIM_MIN_INTERVAL_MS;
    return run();
  });
  // Keep the queue alive after failures.
  nominatimChain = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

async function nominatimFetch(url, { signal, errorMessage = "Search failed" } = {}) {
  const timeout = AbortSignal.timeout(8000);
  const combined =
    typeof AbortSignal.any === "function" && signal
      ? AbortSignal.any([timeout, signal])
      : timeout;

  return enqueueNominatim(async () => {
    // Do not set User-Agent — browsers forbid it and a custom value can force a
    // CORS preflight that Nominatim rejects (fetch then fails with a blank UI).
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
      signal: combined,
    });
    if (!res.ok) throw new Error(errorMessage);
    return res.json();
  }, combined);
}

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

function nameMatchRank(place, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return 3;
  const name = (place?.name || "").toLowerCase();
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 2;
  const display = (place?.display_name || "").toLowerCase();
  if (display.startsWith(q) || display.includes(`, ${q},`)) return 2;
  return 3;
}

function rankSearchResults(places, query, near, limit) {
  const withMeta = places.map((p) => ({
    ...p,
    distanceMeters:
      near?.lat != null && near?.lng != null
        ? haversineMeters(near, p)
        : null,
    _match: nameMatchRank(p, query),
  }));

  withMeta.sort((a, b) => {
    // Exact / prefix name matches beat "nearby road that contains the letters".
    if (a._match !== b._match) return a._match - b._match;
    if (near?.lat != null && near?.lng != null) {
      const NEARBY_M = 80000;
      const aNear = a.distanceMeters <= NEARBY_M ? 0 : 1;
      const bNear = b.distanceMeters <= NEARBY_M ? 0 : 1;
      if (aNear !== bNear) return aNear - bNear;
      return a.distanceMeters - b.distanceMeters;
    }
    return 0;
  });

  return withMeta.slice(0, limit).map(({ _match, ...rest }) => rest);
}

async function nominatimSearch(
  query,
  { near = null, bounded = false, viewboxDelta = 0.35, limit = 12, signal } = {},
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
  const data = await nominatimFetch(url, { signal, errorMessage: "Search failed" });
  if (!Array.isArray(data)) throw new Error("Search failed");
  return data.map((item) => mapPlace(item));
}

/**
 * Search places. Uses serialized Nominatim requests (usage-policy friendly).
 * When `near` is set, bias with an unbounded viewbox, then fall back to a
 * global query if that returns nothing — never swallow both into [].
 */
export async function searchPlaces(query, { limit = 8, near = null, signal } = {}) {
  const q = query.trim();
  if (!q) return [];

  const fetchLimit = Math.max(limit * 2, 16);

  if (near?.lat != null && near?.lng != null) {
    // One biased request first (not 2–3 in parallel — Nominatim rate-limits).
    let biased = await nominatimSearch(q, {
      near,
      bounded: false,
      viewboxDelta: 0.55,
      limit: fetchLimit,
      signal,
    }).catch((err) => {
      if (err?.name === "AbortError") throw err;
      return [];
    });

    if (!biased.length) {
      biased = await nominatimSearch(q, { limit: fetchLimit, signal }).catch(
        (err) => {
          if (err?.name === "AbortError") throw err;
          return [];
        },
      );
    } else if (biased.length < limit) {
      const global = await nominatimSearch(q, {
        limit: fetchLimit,
        signal,
      }).catch((err) => {
        if (err?.name === "AbortError") throw err;
        return [];
      });
      biased = dedupePlaces([...biased, ...global]);
    }

    return rankSearchResults(biased, q, near, limit);
  }

  const places = await nominatimSearch(q, { limit: fetchLimit, signal }).catch(
    (err) => {
      if (err?.name === "AbortError") throw err;
      return [];
    },
  );
  return rankSearchResults(places, q, null, limit);
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
  { near = null, bounded = false, viewboxDelta = 0.35, limit = 12, signal } = {},
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
  const data = await nominatimFetch(url, {
    signal,
    errorMessage: "Road search failed",
  });
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

function hasRoadSuffix(query) {
  const lower = query.toLowerCase();
  return ROAD_SUFFIXES.some(
    (s) =>
      lower.endsWith(` ${s.toLowerCase()}`) ||
      lower.endsWith(` ${s.slice(0, 2).toLowerCase()}`),
  ) ||
    lower.endsWith(" st") ||
    lower.endsWith(" rd") ||
    lower.endsWith(" ave") ||
    lower.endsWith(" dr") ||
    lower.endsWith(" blvd") ||
    lower.endsWith(" ln");
}

async function collectStreetCandidates(query, near, fetchLimit, signal) {
  if (near?.lat != null && near?.lng != null) {
    // Prefer nearby, but don't hard-bound — short stems often miss otherwise.
    return nominatimStreetSearch(query, {
      near,
      bounded: false,
      viewboxDelta: 0.45,
      limit: fetchLimit,
      signal,
    });
  }
  return nominatimStreetSearch(query, { limit: fetchLimit, signal });
}

function finalizeRoadResults(candidates, q, near, limit) {
  const qLower = q.toLowerCase();
  const matched = candidates.filter((place) => {
    const name = (place.name || "").toLowerCase();
    if (!name) return false;
    if (name.includes(qLower)) return true;
    // Allow "N Michigan St" style hits for query "michigan".
    return name.split(/[\s/]+/).some((tok) => tok.startsWith(qLower));
  });
  const pool = matched.length ? matched : candidates;

  const ranked = rankSearchResults(pool, q, near, Math.max(limit * 4, 16));
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

/**
 * Search named roads near `near`, returning distinct road names (3–5 typical).
 * One structured `street=` query first; only then a single suffix / free-form
 * fallback — never parallel Nominatim fan-out.
 */
export async function searchRoads(query, { limit = 5, near = null, signal } = {}) {
  const q = query.trim();
  if (!q || q.length < 2) return [];

  const fetchLimit = Math.max(limit * 4, 16);

  let candidates = await collectStreetCandidates(
    q,
    near,
    fetchLimit,
    signal,
  ).catch((err) => {
    if (err?.name === "AbortError") throw err;
    return [];
  });

  // One suffix retry for short stems like "Main" — sequential, not parallel.
  if (candidates.length < limit && !hasRoadSuffix(q)) {
    const withStreet = await collectStreetCandidates(
      `${q} Street`,
      near,
      fetchLimit,
      signal,
    ).catch((err) => {
      if (err?.name === "AbortError") throw err;
      return [];
    });
    candidates = dedupePlaces([...candidates, ...withStreet]);
  }

  // Free-form fallback when structured street search is still thin.
  if (candidates.length < Math.min(2, limit)) {
    const places = await searchPlaces(q, {
      near,
      limit: fetchLimit,
      signal,
    }).catch((err) => {
      if (err?.name === "AbortError") throw err;
      return [];
    });
    const roads = places
      .filter((p) => isRoadResult(p) || p.address?.road)
      .map((p) => ({
        ...p,
        name: roadLabel(p) || p.name,
        isRoad: true,
      }));
    candidates = dedupePlaces([...candidates, ...roads]);
  }

  return finalizeRoadResults(candidates, q, near, limit);
}

export async function reverseGeocode(lat, lng, { signal } = {}) {
  const url = new URL(`${NOMINATIM}/reverse`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("zoom", "18");
  const item = await nominatimFetch(url, {
    signal,
    errorMessage: "Reverse geocode failed",
  });
  return mapPlace(item, lat, lng);
}

/** Label for saved-route titles — never “Your location”. */
export async function resolveSaveEndpointName(place, fallback = "Start") {
  if (!place) return fallback;
  const raw = String(place.name || "").trim();
  const isGeneric =
    place.isCurrentLocation ||
    /^your location$/i.test(raw) ||
    /^current location$/i.test(raw);
  if (!isGeneric && raw) return raw;

  if (place.lat == null || place.lng == null) return fallback;
  try {
    const geo = await reverseGeocode(place.lat, place.lng);
    const a = geo.address || {};
    const line = [a.house_number, a.road].filter(Boolean).join(" ");
    const name =
      line ||
      a.neighbourhood ||
      a.city ||
      String(geo.name || "").trim() ||
      String(geo.display_name || "")
        .split(",")[0]
        .trim();
    if (name && !/^your location$/i.test(name) && !/^current location$/i.test(name)) {
      return name;
    }
  } catch {
    /* fall through */
  }
  return fallback;
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
