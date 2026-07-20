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
    id: item.place_id ?? `${fallbackLat},${fallbackLng}`,
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

export async function searchPlaces(query, { limit = 6 } = {}) {
  const q = query.trim();
  if (!q) return [];
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return data.map((item) => mapPlace(item));
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
