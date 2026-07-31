const ROUTES_KEY = "atlas.savedRoutes.v1";
const RECENT_KEY = "atlas.recentSearches.v1";
const BLOCKED_KEY = "atlas.blockedStreets.v1";
const ROAD_RULES_KEY = "atlas.roadRules.v1";
const ONBOARDING_KEY = "atlas.onboarding.v3";
const MAX_RECENT = 8;
const MAX_BLOCKED = 40;
const MAX_ROAD_RULES = 60;

export function loadOnboardingSeen() {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.routeCardSeen);
  } catch {
    return false;
  }
}

export function persistOnboardingSeen() {
  localStorage.setItem(
    ONBOARDING_KEY,
    JSON.stringify({ routeCardSeen: true, seenAt: Date.now() }),
  );
}

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

export function loadBlockedStreets() {
  try {
    const raw = localStorage.getItem(BLOCKED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistBlockedStreets(streets) {
  localStorage.setItem(
    BLOCKED_KEY,
    JSON.stringify((streets || []).slice(0, MAX_BLOCKED)),
  );
}

export function loadRoadRules() {
  try {
    const raw = localStorage.getItem(ROAD_RULES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistRoadRules(rules) {
  localStorage.setItem(
    ROAD_RULES_KEY,
    JSON.stringify((rules || []).slice(0, MAX_ROAD_RULES)),
  );
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
