const OSRM = "https://router.project-osrm.org";

const PROFILE = {
  driving: "driving",
  walking: "foot",
  cycling: "bike",
};

/**
 * @param {{ lat: number, lng: number }[]} coords
 * @param {"driving"|"walking"|"cycling"} travelMode
 */
export async function fetchRoute(coords, travelMode = "driving") {
  if (!coords || coords.length < 2) {
    throw new Error("Need at least two stops");
  }
  const profile = PROFILE[travelMode] || "driving";
  const path = coords.map((c) => `${c.lng},${c.lat}`).join(";");
  const url = `${OSRM}/route/v1/${profile}/${path}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing service unavailable");
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.[0]) {
    throw new Error(data.message || "No route found between these stops");
  }
  const route = data.routes[0];
  return {
    distance: route.distance,
    duration: route.duration,
    geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  };
}

/** Straight-line fallback when road routing fails or user chooses freehand. */
export function straightLineRoute(coords) {
  let distance = 0;
  for (let i = 1; i < coords.length; i++) {
    distance += haversine(coords[i - 1], coords[i]);
  }
  // Rough walking pace ~5 km/h for duration estimate on straight lines
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
