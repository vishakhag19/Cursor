export function formatDistance(meters) {
  if (meters == null || Number.isNaN(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
  if (m < 1) return "< 1 min";
  return `${m} min`;
}

export function placeLabel(place) {
  if (!place) return "Unknown";
  if (place.display_name) {
    const parts = place.display_name.split(",").map((p) => p.trim());
    return parts.slice(0, 2).join(", ");
  }
  if (place.name) return place.name;
  if (place.lat != null && place.lng != null) {
    return `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`;
  }
  return "Unknown";
}
