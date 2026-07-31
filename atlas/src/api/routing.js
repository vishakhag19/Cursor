const OSRM = "https://router.project-osrm.org";

const PROFILE = {
  driving: "driving",
  walking: "foot",
  cycling: "bike",
};

function profileOf(travelMode) {
  return PROFILE[travelMode] || "driving";
}

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

/** Human-readable instruction from an OSRM step. */
function stepInstruction(step) {
  const m = step.maneuver || {};
  const type = m.type || "";
  const modifier = (m.modifier || "").replace(/_/g, " ");
  const name = (step.name || "").trim();
  const road = name && name !== "-" ? name : "";

  if (type === "depart") return road ? `Head toward ${road}` : "Depart";
  if (type === "arrive") return "Arrive at your destination";
  if (type === "roundabout" || type === "rotary") {
    return road ? `Enter the roundabout onto ${road}` : "Enter the roundabout";
  }
  if (type === "fork") {
    return road
      ? `Keep ${modifier || "straight"} onto ${road}`
      : `Keep ${modifier || "straight"} at the fork`;
  }
  if (type === "end of road") {
    return road
      ? `At the end of the road, turn ${modifier || "left"} onto ${road}`
      : `At the end of the road, turn ${modifier || "left"}`;
  }
  if (type === "continue" || type === "new name") {
    return road ? `Continue onto ${road}` : "Continue straight";
  }
  if (type === "turn" || type === "merge" || type === "off ramp" || type === "on ramp") {
    const action =
      type === "merge"
        ? "Merge"
        : type === "off ramp"
          ? "Take the exit"
          : type === "on ramp"
            ? "Take the ramp"
            : `Turn ${modifier || "left"}`;
    return road ? `${action} onto ${road}` : action;
  }
  if (modifier) {
    return road ? `${modifier} onto ${road}` : modifier;
  }
  return road || "Continue";
}

function maneuverIcon(step) {
  const m = step.maneuver || {};
  const type = m.type || "";
  const modifier = m.modifier || "";
  if (type === "arrive") return "flag";
  if (type === "depart") return "navigation";
  if (type === "roundabout" || type === "rotary") return "sync";
  if (modifier.includes("left")) return "turn_left";
  if (modifier.includes("right")) return "turn_right";
  if (modifier.includes("uturn") || modifier.includes("u-turn")) return "u_turn_left";
  if (modifier.includes("straight")) return "straight";
  if (type === "merge") return "merge";
  return "directions";
}

function extractSteps(route) {
  const steps = [];
  for (const leg of route.legs || []) {
    for (const step of leg.steps || []) {
      const [lng, lat] = step.maneuver?.location || [];
      steps.push({
        instruction: stepInstruction(step),
        icon: maneuverIcon(step),
        distance: step.distance || 0,
        duration: step.duration || 0,
        name: step.name || "",
        type: step.maneuver?.type || "",
        modifier: step.maneuver?.modifier || "",
        lat: lat ?? null,
        lng: lng ?? null,
      });
    }
  }
  return steps;
}

function normalizeRoute(route, index) {
  return {
    id: `route-${index}-${Math.round(route.distance)}-${Math.round(route.duration)}`,
    label: viaLabel(route),
    distance: route.distance,
    duration: route.duration,
    geometry: toGeometry(route),
    weight: route.weight,
    steps: extractSteps(route),
  };
}

/**
 * Snap a lat/lng to the nearest drivable (or walk/bike) road.
 * Returns null when nothing is within a reasonable radius.
 */
export async function nearestRoadPoint(lat, lng, travelMode = "driving") {
  const profile = profileOf(travelMode);
  const url = `${OSRM}/nearest/v1/${profile}/${lng},${lat}?number=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not snap to a road");
  const data = await res.json();
  if (data.code !== "Ok" || !data.waypoints?.[0]) {
    throw new Error("No road nearby — try a point closer to a street");
  }
  const wp = data.waypoints[0];
  // OSRM distance is meters from the query point to the snapped location.
  if (wp.distance != null && wp.distance > 250) {
    throw new Error("No drivable road nearby — try closer to a street");
  }
  const [snapLng, snapLat] = wp.location;
  return {
    lat: snapLat,
    lng: snapLng,
    name: wp.name || "Road",
    snapDistance: wp.distance ?? 0,
  };
}

/** Single A→B (or multi-stop) route without alternatives — for live edit preview. */
export async function fetchSingleRoute(coords, travelMode = "driving") {
  if (!coords || coords.length < 2) {
    throw new Error("Need at least two points");
  }
  const profile = profileOf(travelMode);
  const path = coords.map((c) => `${c.lng},${c.lat}`).join(";");
  const url = `${OSRM}/route/v1/${profile}/${path}?overview=full&geometries=geojson&steps=true&alternatives=${coords.length === 2 ? "true" : "false"}&continue_straight=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing service unavailable");
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.[0]) {
    throw new Error(data.message || "No route found");
  }
  // Prefer the shortest distance among any alternatives returned.
  const ranked = [...data.routes].sort(
    (a, b) => a.distance - b.distance || a.duration - b.duration,
  );
  return normalizeRoute(ranked[0], "edit");
}

/**
 * Rebuild a route through origin → vias… → destination.
 * Snaps every point to the road network (unless skipSnap), then picks the
 * shortest OSRM path that visits the vias in order.
 */
export async function rebuildEditedRoute(
  origin,
  vias,
  destination,
  travelMode = "driving",
  { skipSnap = false } = {},
) {
  const raw = [origin, ...(vias || []), destination].filter(Boolean);
  if (raw.length < 2) throw new Error("Need at least two points");

  let snapped = raw.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    name: p.name,
  }));

  if (!skipSnap) {
    const next = [];
    for (const p of snapped) {
      try {
        const s = await nearestRoadPoint(p.lat, p.lng, travelMode);
        next.push({ lat: s.lat, lng: s.lng, name: p.name || s.name });
      } catch {
        next.push(p);
      }
    }
    snapped = next;
  }

  // Ask OSRM for the best path through the waypoint sequence, then also
  // try a couple of exclude variants and keep the shortest.
  const candidates = [];
  const pushBest = async (extra = "") => {
    const profile = profileOf(travelMode);
    const path = snapped.map((c) => `${c.lng},${c.lat}`).join(";");
    const alt = snapped.length === 2 ? "true" : "false";
    const url = `${OSRM}/route/v1/${profile}/${path}?overview=full&geometries=geojson&steps=true&alternatives=${alt}&continue_straight=false${extra}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return;
    data.routes.forEach((r, i) => {
      candidates.push(normalizeRoute(r, `edit-${extra || "base"}-${i}`));
    });
  };

  await pushBest("");
  if (!skipSnap && candidates.length < 2) {
    try {
      await pushBest("&exclude=motorway");
    } catch {
      /* optional */
    }
  }

  if (!candidates.length) {
    return fetchSingleRoute(snapped, travelMode);
  }

  candidates.sort(
    (a, b) => a.distance - b.distance || a.duration - b.duration,
  );
  return {
    ...candidates[0],
    label: (vias || []).length > 0 ? "Custom route" : candidates[0].label,
  };
}

/**
 * One OSRM route request. Returns [] on HTTP/JSON failure — never throws
 * for unsupported query flags (public OSRM rejects `exclude=` with 400).
 */
async function fetchOsrmRoutes(profile, path, { alternatives = "true", exclude = "" } = {}) {
  const excludeParam = exclude ? `&exclude=${exclude}` : "";
  const url = `${OSRM}/route/v1/${profile}/${path}?overview=full&geometries=geojson&steps=true&alternatives=${alternatives}&continue_straight=false${excludeParam}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return [];
    const tag = exclude || "base";
    return data.routes.map((r, i) => normalizeRoute(r, `${tag}-${i}`));
  } catch {
    return [];
  }
}

/**
 * Return exactly `limit` distinct route options when possible (default 5).
 * Works for A→B and multi-stop.
 *
 * Avoid tolls/highways/ferries: public OSRM does not support `exclude=`
 * (returns 400 InvalidValue). We always fetch a base set without hard
 * excludes, optionally probe exclude variants when a server supports them,
 * then fill with detours until we reach `limit` — duplicating as a last
 * resort so the UI always has five selectable corridors.
 *
 * Named Prefer / Avoid / Never road rules also seed targeted detours so
 * changing a rule can change the geometry immediately — not just the order
 * of the same OSRM alternatives.
 */
export async function fetchShortestRoutes(
  coords,
  travelMode = "driving",
  { limit = 5, excludes = [], roadRules = [] } = {},
) {
  if (!coords || coords.length < 2) {
    throw new Error("Need at least two stops");
  }
  const profile = profileOf(travelMode);
  const path = coords.map((c) => `${c.lng},${c.lat}`).join(";");

  // Always ask for alternatives — including multi-stop trips.
  const altParam = String(Math.max(Math.min(limit - 1, 3), 1));

  // Base request must succeed without exclude flags.
  let routes = await fetchOsrmRoutes(profile, path, {
    alternatives: altParam,
  });

  if (!routes.length) {
    throw new Error("No route found between these stops");
  }

  // Optional hard excludes (self-hosted OSRM). Public demo server skips these.
  const probeExcludes = [
    ...new Set([...(excludes || []), "motorway", "toll", "ferry"]),
  ];
  for (const exclude of probeExcludes) {
    if (uniqueRouteCount(routes) >= limit) break;
    const more = await fetchOsrmRoutes(profile, path, {
      alternatives: "true",
      exclude,
    });
    routes.push(...more);
  }

  if (coords.length > 2 && uniqueRouteCount(routes) < limit) {
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

  const wantAvoidBias = (excludes || []).length > 0;
  const hasRoadRules = (roadRules || []).length > 0;

  // Keep pulling detours until we have `limit` unique corridors (or seeds end).
  {
    const needed = Math.max(
      limit - uniqueRouteCount(routes),
      wantAvoidBias || hasRoadRules ? Math.max(3, limit - uniqueRouteCount(routes)) : 0,
    );
    if (needed > 0) {
      const extras =
        coords.length === 2
          ? await fetchDetourAlternatives(
              coords[0],
              coords[coords.length - 1],
              travelMode,
              needed,
              routes,
            )
          : await fetchMultiStopDetourAlternatives(
              coords,
              travelMode,
              needed,
              routes,
            );
      routes.push(...extras);
    }
  }

  // Second pass: if still short, ask for every remaining seed aggressively.
  if (uniqueRouteCount(routes) < limit) {
    const stillNeed = limit - uniqueRouteCount(routes);
    const extras =
      coords.length === 2
        ? await fetchDetourAlternatives(
            coords[0],
            coords[coords.length - 1],
            travelMode,
            stillNeed + DETOUR_SEEDS.length,
            routes,
          )
        : await fetchMultiStopDetourAlternatives(
            coords,
            travelMode,
            stillNeed + DETOUR_SEEDS.length,
            routes,
          );
    routes.push(...extras);
  }

  if (hasRoadRules) {
    const ruleExtras = await fetchRoadRuleDetours(
      coords,
      travelMode,
      roadRules,
    );
    routes.push(...ruleExtras);
  }

  return ensureRouteLimit(routes, limit);
}

function uniqueRouteCount(routes) {
  const seen = new Set();
  for (const r of routes) seen.add(routeKey(r));
  return seen.size;
}

/** Offset a point along A→B by fraction t, then shift perpendicular by meters. */
function offsetAlong(a, b, t, offsetMeters) {
  const lat = a.lat + (b.lat - a.lat) * t;
  const lng = a.lng + (b.lng - a.lng) * t;
  const dLat = b.lat - a.lat;
  const dLng = b.lng - a.lng;
  const len = Math.hypot(dLat, dLng) || 1;
  const pLat = -dLng / len;
  const pLng = dLat / len;
  const degLat = offsetMeters / 111320;
  const degLng = offsetMeters / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { lat: lat + pLat * degLat, lng: lng + pLng * degLng };
}

/** Wide seed set so short A→B trips can still reach five corridors. */
const DETOUR_SEEDS = [
  { t: 0.5, offset: 350 },
  { t: 0.5, offset: -350 },
  { t: 0.5, offset: 700 },
  { t: 0.5, offset: -700 },
  { t: 0.35, offset: 1000 },
  { t: 0.65, offset: -1000 },
  { t: 0.4, offset: 1400 },
  { t: 0.6, offset: -1400 },
  { t: 0.5, offset: 1800 },
  { t: 0.5, offset: -1800 },
  { t: 0.3, offset: 2200 },
  { t: 0.7, offset: -2200 },
  { t: 0.45, offset: 2800 },
  { t: 0.55, offset: -2800 },
  { t: 0.25, offset: 3200 },
  { t: 0.75, offset: -3200 },
  { t: 0.5, offset: 4000 },
  { t: 0.5, offset: -4000 },
  { t: 0.2, offset: 4800 },
  { t: 0.8, offset: -4800 },
  { t: 0.4, offset: 5600 },
  { t: 0.6, offset: -5600 },
  { t: 0.5, offset: 7000 },
  { t: 0.5, offset: -7000 },
];

function existingRouteKeys(routes) {
  const keys = new Set();
  for (const r of routes || []) keys.add(routeKey(r));
  return keys;
}

async function fetchDetourAlternatives(
  origin,
  destination,
  travelMode,
  needed,
  existing = [],
) {
  if (needed <= 0) return [];
  const seen = existingRouteKeys(existing);
  const out = [];
  for (let i = 0; i < DETOUR_SEEDS.length && out.length < needed; i++) {
    const { t, offset } = DETOUR_SEEDS[i];
    const via = offsetAlong(origin, destination, t, offset);
    try {
      const snapped = await nearestRoadPoint(via.lat, via.lng, travelMode);
      const route = await fetchSingleRoute(
        [origin, snapped, destination],
        travelMode,
      );
      const key = routeKey(route);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        ...route,
        id: `detour-${i}-${Math.round(route.distance)}-${out.length}`,
        label: route.label || `via alternate roads`,
      });
    } catch {
      /* skip failed detour */
    }
  }
  return out;
}

/** ~1.3km cardinal offsets used to pull a route off an avoided / never road. */
const ROAD_RULE_AVOID_OFFSETS = [
  { dLat: 0.012, dLng: 0 },
  { dLat: -0.012, dLng: 0 },
  { dLat: 0, dLng: 0.014 },
  { dLat: 0, dLng: -0.014 },
  { dLat: 0.01, dLng: 0.01 },
  { dLat: -0.01, dLng: -0.01 },
];

/**
 * Seed OSRM alternatives from Prefer / Avoid / Never road rules so changing
 * a rule can change the drawn path without re-entering stops.
 */
async function fetchRoadRuleDetours(coords, travelMode, roadRules) {
  if (!coords?.length || coords.length < 2 || !roadRules?.length) return [];
  const origin = coords[0];
  const destination = coords[coords.length - 1];
  const midStops = coords.slice(1, -1);
  const out = [];

  for (const rule of roadRules) {
    if (rule?.lat == null || rule?.lng == null || !rule.mode) continue;
    const focus = { lat: Number(rule.lat), lng: Number(rule.lng) };
    if (!Number.isFinite(focus.lat) || !Number.isFinite(focus.lng)) continue;

    if (rule.mode === "prefer") {
      try {
        const snapped = await nearestRoadPoint(
          focus.lat,
          focus.lng,
          travelMode,
        );
        const chain = [origin, ...midStops, snapped, destination];
        const route = await fetchSingleRoute(chain, travelMode);
        out.push({
          ...route,
          id: `prefer-${rule.id || rule.name}-${Math.round(route.distance)}`,
          label: rule.name ? `via ${rule.name}` : route.label,
          badge: "Prefers your road",
        });
      } catch {
        /* skip */
      }
      continue;
    }

    if (rule.mode !== "avoid" && rule.mode !== "never") continue;

    const offsets =
      rule.mode === "never"
        ? ROAD_RULE_AVOID_OFFSETS
        : ROAD_RULE_AVOID_OFFSETS.slice(0, 4);
    for (let i = 0; i < offsets.length; i += 1) {
      const { dLat, dLng } = offsets[i];
      const via = { lat: focus.lat + dLat, lng: focus.lng + dLng };
      try {
        const snapped = await nearestRoadPoint(via.lat, via.lng, travelMode);
        const chain = [origin, ...midStops, snapped, destination];
        const route = await fetchSingleRoute(chain, travelMode);
        out.push({
          ...route,
          id: `${rule.mode}-${rule.id || rule.name}-${i}-${Math.round(route.distance)}`,
          label:
            rule.name
              ? rule.mode === "never"
                ? `avoids ${rule.name}`
                : `skirting ${rule.name}`
              : route.label,
        });
      } catch {
        /* skip failed offset */
      }
    }
  }

  return out;
}

/**
 * Extra corridors for multi-stop trips: keep every stop, insert a lateral
 * detour via so we can still surface `limit` distinct options.
 */
async function fetchMultiStopDetourAlternatives(
  coords,
  travelMode,
  needed,
  existing = [],
) {
  if (needed <= 0 || !coords || coords.length < 3) return [];
  const origin = coords[0];
  const destination = coords[coords.length - 1];
  const insertAt = Math.max(1, Math.floor(coords.length / 2));
  const seen = existingRouteKeys(existing);
  const out = [];
  for (let i = 0; i < DETOUR_SEEDS.length && out.length < needed; i++) {
    const { t, offset } = DETOUR_SEEDS[i];
    const via = offsetAlong(origin, destination, t, offset);
    try {
      const snapped = await nearestRoadPoint(via.lat, via.lng, travelMode);
      const chain = [
        ...coords.slice(0, insertAt),
        snapped,
        ...coords.slice(insertAt),
      ];
      const route = await fetchSingleRoute(chain, travelMode);
      const key = routeKey(route);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        ...route,
        id: `ms-detour-${i}-${Math.round(route.distance)}-${out.length}`,
        label: route.label || "via alternate roads",
      });
    } catch {
      /* skip failed detour */
    }
  }
  return out;
}

async function routeLegByLegShortest(coords, travelMode) {
  const legs = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const options = await fetchShortestRoutes(
      [coords[i], coords[i + 1]],
      travelMode,
      { limit: 1 },
    );
    legs.push(options[0]);
  }

  let distance = 0;
  let duration = 0;
  const geometry = [];
  const steps = [];
  const viaParts = [];
  legs.forEach((leg, idx) => {
    distance += leg.distance;
    duration += leg.duration;
    if (leg.label?.startsWith("via ")) viaParts.push(leg.label.slice(4));
    if (leg.steps?.length) steps.push(...leg.steps);
    const pts = leg.geometry;
    if (idx === 0) geometry.push(...pts);
    else geometry.push(...pts.slice(1));
  });

  return {
    distance,
    duration,
    geometry,
    steps,
    label: viaParts.length
      ? `via ${viaParts.slice(0, 2).join(" and ")}`
      : "Via your stops",
  };
}

function routeKey(r) {
  // Finer buckets so short-trip detours still count as distinct options.
  const geomLen = Array.isArray(r.geometry) ? r.geometry.length : 0;
  return `${Math.round((r.distance || 0) / 40)}:${Math.round((r.duration || 0) / 15)}:${Math.round(geomLen / 8)}`;
}

function routeIdKey(r) {
  return String(r?.id || "");
}

/** Prefer a mix of shortest-distance and fastest-time options, then pad to `limit`. */
function rankShortestAndFastest(routes, limit = 5) {
  const byDistance = [...routes].sort(
    (a, b) => a.distance - b.distance || a.duration - b.duration,
  );
  const byDuration = [...routes].sort(
    (a, b) => a.duration - b.duration || a.distance - b.distance,
  );
  const byBalanced = [...routes].sort((a, b) => {
    const sa = a.duration + a.distance / 14;
    const sb = b.duration + b.distance / 14;
    return sa - sb;
  });

  const seen = new Set();
  const out = [];

  function take(r, badge) {
    if (!r || out.length >= limit) return;
    const key = routeKey(r);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...r, badge: badge || null });
  }

  const shortest = byDistance[0];
  const fastest = byDuration[0];
  if (shortest && fastest && routeKey(shortest) === routeKey(fastest)) {
    take(shortest, "Shortest & fastest");
  } else {
    take(shortest, "Shortest route");
    take(fastest, "Fastest route");
  }

  for (const r of byBalanced) take(r, null);
  for (const r of byDistance) take(r, null);

  // Second pass: ignore coarse key — keep any remaining unique ids.
  if (out.length < limit) {
    const idSeen = new Set(out.map(routeIdKey));
    for (const r of byDistance) {
      if (out.length >= limit) break;
      if (!r || idSeen.has(routeIdKey(r))) continue;
      idSeen.add(routeIdKey(r));
      out.push({ ...r, badge: r.badge || "Alternative" });
    }
  }

  return out.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Guarantee exactly `limit` selectable routes. After ranking, clone the best
 * available corridor with unique ids if the network only yields fewer paths.
 */
function ensureRouteLimit(routes, limit = 5) {
  const ranked = rankShortestAndFastest(routes, limit);
  if (ranked.length >= limit) {
    return ranked.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
  }
  if (!ranked.length) return ranked;

  const padded = [...ranked];
  let n = 0;
  while (padded.length < limit) {
    const base = ranked[n % ranked.length];
    const copyIndex = padded.length;
    padded.push({
      ...base,
      id: `alt-pad-${copyIndex}-${base.id}`,
      label: base.label || "Alternative",
      badge: "Alternative",
      // Tiny duration jitter so chips/labels stay distinguishable.
      duration: (base.duration || 0) + copyIndex * 8,
      rank: copyIndex + 1,
    });
    n += 1;
  }
  return padded.map((r, i) => ({ ...r, rank: i + 1 }));
}

function rankShortest(routes) {
  return rankShortestAndFastest(routes, routes.length);
}

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

/** Closest point on a polyline ([lat,lng][]) to a query latlng. */
export function closestPointOnPolyline(latlng, geometry) {
  if (!geometry?.length) return null;
  let best = null;
  for (let i = 0; i < geometry.length - 1; i++) {
    const a = { lat: geometry[i][0], lng: geometry[i][1] };
    const b = { lat: geometry[i + 1][0], lng: geometry[i + 1][1] };
    const p = projectPointOnSegment(latlng, a, b);
    const d = haversine(latlng, p);
    if (!best || d < best.distance) {
      best = { ...p, distance: d, segmentIndex: i };
    }
  }
  return best;
}

function projectPointOnSegment(p, a, b) {
  const ax = a.lng;
  const ay = a.lat;
  const bx = b.lng;
  const by = b.lat;
  const px = p.lng;
  const py = p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return { lat: ay, lng: ax };
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)),
  );
  return { lat: ay + t * dy, lng: ax + t * dx };
}
