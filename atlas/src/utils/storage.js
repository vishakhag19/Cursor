const ROUTES_KEY = "atlas.savedRoutes.v1";
const RECENT_KEY = "atlas.recentSearches.v1";
const MAX_RECENT = 8;

export function loadSavedRoutes() {
  try {
    const raw = localStorage.getItem(ROUTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistSavedRoutes(routes) {
  localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
}

export function loadRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecentSearch(place, existing = null) {
  if (!place || place.isCurrentLocation) return existing || loadRecentSearches();
  const prev = existing || loadRecentSearches();
  const entry = {
    id: String(place.id ?? `${place.lat},${place.lng}`),
    name: place.name,
    display_name: place.display_name,
    lat: place.lat,
    lng: place.lng,
    type: place.type || "place",
    category: place.category || null,
    savedAt: Date.now(),
  };
  const next = [entry, ...prev.filter((p) => p.id !== entry.id)].slice(
    0,
    MAX_RECENT,
  );
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}
