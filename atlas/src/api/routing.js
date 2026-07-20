const OSRM = "https://router.project-osrm.org";

const PROFILE = {
  driving: "driving",
  walking: "foot",
  cycling: "bike",
};

function toGeometry(route) {
  return route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

/** Pick a readable "via …" label from OSRM step road names. */
function viaLabel(route) {
  const names = [];
  const legs = route.legs || [];
  for (const leg of legs) {
    for (const step of leg.steps || []) {
      const name = (step.name || "").trim();
      if (name && name !== "-" && !names.includes(name)) names.push(name);
    }
  }
  if (!names.length) return "Best available roads";
  if (names.length === 1) return `via ${names[0]}`;
  if (names.length === 2) return `via ${names[0]} and ${names[1]}`;
  return `via ${names[0]} and ${names[1]}`;
}

function normalizeRoute(route, index) {
  return {
    id: `route-${index}-${Math.round(route.distance)}-${Math.round(route.duration)}`,
    label: viaLabel(route),
    distance: route.distance,
    duration: route.duration,
    geometry: toGeometry(route),
    weight: route.weight,
  };
}

/**
 * Return up to `limit` shortest driving/walking/cycling options between stops.
 * Always ranked by distance (shortest first).
 */
export async function fetchShortestRoutes(
  coords,
  travelMode = "driving",
  { limit = 5 } = {},
) {
  if (!coords || coords.length < 2) {
    throw new Error("Need at least two stops");
  }
  const profile = PROFILE[travelMode] || "driving";
  const path = coords.map((c) => `${c.lng},${c.lat}`).join(";");

  // Ask OSRM for as many alternatives as it can offer (A→B only).
  const altCount = coords.length === 2 ? Math.max(limit - 1, 1) : false;
  const altParam =
    altCount === false ? "false" : String(Math.min(altCount, 4));

  const url = `${OSRM}/route/v1/${profile}/${path}?overview=full&geometries=geojson&steps=true&alternatives=${altParam}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing service unavailable");
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(data.message || "No route found between these stops");
  }

  let routes = data.routes.map((r, i) => normalizeRoute(r, i));

  // For multi-stop, also try leg-by-leg shortest and merge as an extra option.
  if (coords.length > 2) {
    try {
      const legs = await routeLegByLegShortest(coords, travelMode);
      routes.push({
        ...legs,
        id: `legs-${Math.round(legs.distance)}`,
        label: "Via your stops (shortest legs)",
      });
    } catch {
      /* ignore */
    }
  }

  return rankShortest(routes).slice(0, limit);
}

async function routeLegByLegShortest(coords, travelMode) {
  const legs = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const options = await fetchShortestRoutes([coords[i], coords[i + 1]], travelMode, {
      limit: 1,
    });
    legs.push(options[0]);
  }

  let distance = 0;
  let duration = 0;
  const geometry = [];
  const viaParts = [];
  legs.forEach((leg, idx) => {
    distance += leg.distance;
    duration += leg.duration;
    if (leg.label?.startsWith("via ")) viaParts.push(leg.label.slice(4));
    const pts = leg.geometry;
    if (idx === 0) geometry.push(...pts);
    else geometry.push(...pts.slice(1));
  });

  return {
    distance,
    duration,
    geometry,
    label: viaParts.length
      ? `via ${viaParts.slice(0, 2).join(" and ")}`
      : "Via your stops",
  };
}

function rankShortest(routes) {
  const sorted = [...routes].sort(
    (a, b) => a.distance - b.distance || a.duration - b.duration,
  );
  const seen = new Set();
  const unique = [];
  for (const r of sorted) {
    const key = `${Math.round(r.distance / 20)}:${Math.round(r.duration / 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }
  return unique.map((r, i) => ({
    ...r,
    rank: i + 1,
    badge: i === 0 ? "Shortest route" : null,
  }));
}

/** @deprecated use fetchShortestRoutes */
export async function fetchRouteOptions(coords, travelMode = "driving") {
  return fetchShortestRoutes(coords, travelMode, { limit: 5 });
}

export async function fetchRoute(coords, travelMode = "driving") {
  const options = await fetchShortestRoutes(coords, travelMode, { limit: 1 });
  return options[0];
}

export async function buildCustomRouteOptions(coords, travelMode = "driving") {
  return fetchShortestRoutes(coords, travelMode, { limit: 5 });
}

export function straightLineRoute(coords) {
  let distance = 0;
  for (let i = 1; i < coords.length; i++) {
    distance += haversine(coords[i - 1], coords[i]);
  }
  const duration = (distance / 5000) * 3600;
  return {
    distance,
    duration,
    geometry: coords.map((c) => [c.lat, c.lng]),
    label: "Straight lines",
    badge: null,
    rank: 1,
  };
}

function haversine(a, b) {
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
