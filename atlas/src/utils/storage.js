const STORAGE_KEY = "atlas.savedRoutes.v1";

export function loadSavedRoutes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistSavedRoutes(routes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
}
