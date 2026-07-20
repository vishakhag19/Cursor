const NOMINATIM = "https://nominatim.openstreetmap.org";

export async function searchPlaces(query, { limit = 6 } = {}) {
  const q = query.trim();
  if (!q) return [];
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return data.map((item) => ({
    id: item.place_id,
    name: item.display_name.split(",")[0].trim(),
    display_name: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
    type: item.type,
  }));
}

export async function reverseGeocode(lat, lng) {
  const url = new URL(`${NOMINATIM}/reverse`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Reverse geocode failed");
  const item = await res.json();
  return {
    id: item.place_id ?? `${lat},${lng}`,
    name: (item.display_name || "").split(",")[0].trim() || "Dropped pin",
    display_name: item.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    lat,
    lng,
    type: item.type || "pin",
  };
}
