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
    label:
      (vias || []).length > 0
        ? `Custom · ${(vias || []).length} via point${(vias || []).length === 1 ? "" : "s"}`
        : candidates[0].label,
  };
}

/**
 * Return up to `limit` shortest + fastest options between stops.
 */
export async function fetchShortestRoutes(
  coords,
  travelMode = "driving",
  { limit = 5 } = {},
) {
  if (!coords || coords.length < 2) {
    throw new Error("Need at least two stops");
  }
  const profile = profileOf(travelMode);
  const path = coords.map((c) => `${c.lng},${c.lat}`).join(";");

  const altCount = coords.length === 2 ? Math.min(limit - 1, 3) : false;
  const altParam = altCount === false ? "false" : String(Math.max(altCount, 1));

  const url = `${OSRM}/route/v1/${profile}/${path}?overview=full&geometries=geojson&steps=true&alternatives=${altParam}&continue_straight=false`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Routing service unavailable (${res.status}). Try again in a moment.`,
    );
  }
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(data.message || "No route found between these stops");
  }

  let routes = data.routes.map((r, i) => normalizeRoute(r, i));

  if (coords.length === 2 && routes.length < limit) {
    for (const exclude of ["motorway", "toll", "ferry"]) {
      if (routes.length >= limit) break;
      try {
        const localUrl = `${OSRM}/route/v1/${profile}/${path}?overview=full&geometries=geojson&steps=true&alternatives=true&continue_straight=false&exclude=${exclude}`;
        const localRes = await fetch(localUrl);
        if (!localRes.ok) continue;
        const localData = await localRes.json();
        if (localData.code === "Ok" && localData.routes?.length) {
          localData.routes.forEach((r, i) => {
            routes.push(normalizeRoute(r, `${exclude}-${i}`));
          });
        }
      } catch {
        /* optional enrichment */
      }
    }
  }

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

  return rankShortestAndFastest(routes, limit);
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
  return `${Math.round(r.distance / 25)}:${Math.round(r.duration / 15)}`;
}

/** Prefer a mix of shortest-distance and fastest-time options, up to `limit`. */
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

  return out.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
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
