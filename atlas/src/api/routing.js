const OSRM = "https://router.project-osrm.org";

const PROFILE = {
  driving: "driving",
  walking: "foot",
  cycling: "bike",
};

function toGeometry(route) {
  return route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

function normalizeRoute(route, label, index) {
  return {
    id: `route-${index}-${Math.round(route.distance)}-${Math.round(route.duration)}`,
    label,
    distance: route.distance,
    duration: route.duration,
    geometry: toGeometry(route),
    weight: route.weight,
  };
}

/**
 * Fetch one or more road routes between ordered stops.
 * @param {{ lat: number, lng: number }[]} coords
 * @param {"driving"|"walking"|"cycling"} travelMode
 * @param {{ alternatives?: boolean, prefer?: "time"|"distance" }} options
 */
export async function fetchRouteOptions(
  coords,
  travelMode = "driving",
  { alternatives = true, prefer = "time" } = {},
) {
  if (!coords || coords.length < 2) {
    throw new Error("Need at least two stops");
  }
  const profile = PROFILE[travelMode] || "driving";
  const path = coords.map((c) => `${c.lng},${c.lat}`).join(";");
  const alt = alternatives && coords.length === 2 ? "true" : "false";
  const url = `${OSRM}/route/v1/${profile}/${path}?overview=full&geometries=geojson&steps=false&alternatives=${alt}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing service unavailable");
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(data.message || "No route found between these stops");
  }

  const routes = data.routes.map((r, i) => normalizeRoute(r, `Option ${i + 1}`, i));
  return rankRoutes(routes, prefer);
}

/** Back-compat single-route helper. */
export async function fetchRoute(coords, travelMode = "driving", prefer = "time") {
  const options = await fetchRouteOptions(coords, travelMode, {
    alternatives: true,
    prefer,
  });
  return options[0];
}

/**
 * Build a custom multi-stop route leg-by-leg so each segment prefers
 * shorter/faster per the user's choice, then concatenate geometries.
 * This gives stronger stop-order control than one mega-request.
 */
export async function buildCustomRouteOptions(
  coords,
  travelMode = "driving",
  { prefer = "distance", snapToRoads = true } = {},
) {
  if (!coords || coords.length < 2) {
    throw new Error("Need at least two stops");
  }

  if (!snapToRoads) {
    const straight = straightLineRoute(coords);
    return [
      {
        ...straight,
        id: "custom-straight",
        label: "Your path (straight lines)",
      },
    ];
  }

  // A→B only: ask OSRM for alternatives and rank them.
  if (coords.length === 2) {
    return fetchRouteOptions(coords, travelMode, {
      alternatives: true,
      prefer,
    });
  }

  // Multi-stop: build three candidates —
  // 1) leg-by-leg with prefer
  // 2) single OSRM request through all stops
  // 3) leg-by-leg with the opposite prefer (so user can compare)
  const [legPreferred, throughAll, legAlt] = await Promise.all([
    routeLegByLeg(coords, travelMode, prefer).catch(() => null),
    fetchRouteOptions(coords, travelMode, {
      alternatives: false,
      prefer,
    })
      .then((opts) => opts[0])
      .catch(() => null),
    routeLegByLeg(
      coords,
      travelMode,
      prefer === "distance" ? "time" : "distance",
    ).catch(() => null),
  ]);

  const candidates = [];
  if (legPreferred) {
    candidates.push({
      ...legPreferred,
      id: "legs-preferred",
      label: prefer === "distance" ? "Shortest (via your stops)" : "Fastest (via your stops)",
    });
  }
  if (throughAll) {
    candidates.push({
      ...throughAll,
      id: "through-all",
      label: "Recommended via roads",
    });
  }
  if (legAlt) {
    candidates.push({
      ...legAlt,
      id: "legs-alt",
      label:
        prefer === "distance"
          ? "Fastest (via your stops)"
          : "Shortest (via your stops)",
    });
  }

  if (!candidates.length) {
    const fallback = straightLineRoute(coords);
    return [
      {
        ...fallback,
        id: "fallback-straight",
        label: "Straight lines (routing unavailable)",
      },
    ];
  }

  return dedupeRoutes(rankRoutes(candidates, prefer));
}

async function routeLegByLeg(coords, travelMode, prefer) {
  const legs = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const options = await fetchRouteOptions(
      [coords[i], coords[i + 1]],
      travelMode,
      { alternatives: true, prefer },
    );
    legs.push(options[0]);
  }

  let distance = 0;
  let duration = 0;
  const geometry = [];
  legs.forEach((leg, idx) => {
    distance += leg.distance;
    duration += leg.duration;
    const pts = leg.geometry;
    if (idx === 0) geometry.push(...pts);
    else geometry.push(...pts.slice(1));
  });

  return { distance, duration, geometry };
}

function rankRoutes(routes, prefer = "time") {
  const sorted = [...routes].sort((a, b) => {
    if (prefer === "distance") {
      return a.distance - b.distance || a.duration - b.duration;
    }
    return a.duration - b.duration || a.distance - b.distance;
  });

  return sorted.map((r, i) => {
    let label = r.label;
    if (i === 0) {
      label = prefer === "distance" ? "Shortest" : "Fastest";
    } else if (sorted.length > 1 && i === 1) {
      const other = prefer === "distance" ? "Fastest" : "Shortest";
      const isOther =
        prefer === "distance"
          ? r.duration <= sorted[0].duration
          : r.distance <= sorted[0].distance;
      label = isOther ? other : `Alternative ${i}`;
    } else {
      label = `Alternative ${i}`;
    }
    return { ...r, label };
  });
}

function dedupeRoutes(routes) {
  const seen = new Set();
  return routes.filter((r) => {
    const key = `${Math.round(r.distance / 25)}:${Math.round(r.duration / 15)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Straight-line fallback when road routing fails or user chooses freehand. */
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
