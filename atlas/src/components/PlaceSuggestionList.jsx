import { formatNearDistance } from "../api/geocode";

/** Bold the first case-insensitive match of `query` inside `text`. */
export function highlightMatch(text, query) {
  const source = text || "";
  const q = (query || "").trim();
  if (!q || !source) return source;
  const lower = source.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return source;
  return (
    <>
      {source.slice(0, idx)}
      <strong className="place-match">{source.slice(idx, idx + q.length)}</strong>
      {source.slice(idx + q.length)}
    </>
  );
}

function secondaryText(place) {
  if (place.isCurrentLocation) return place.display_name;
  const parts = [];
  if (place.distanceMeters != null) {
    parts.push(formatNearDistance(place.distanceMeters));
  }
  if (place.display_name && place.display_name !== place.name) {
    const addr = place.display_name.startsWith(place.name)
      ? place.display_name.slice(place.name.length).replace(/^,\s*/, "")
      : place.display_name;
    if (addr) parts.push(addr);
  }
  return parts.join(" · ") || "";
}

/**
 * Google Maps–style place rows: icon + bold match + grey subtitle on one line.
 */
export default function PlaceSuggestionList({
  items = [],
  query = "",
  onSelect,
  loading = false,
}) {
  if (!items.length && !loading) return null;

  return (
    <div className="place-suggest-panel" role="listbox" aria-label="Places">
      {loading && (
        <div className="place-suggest-loading md-typescale-body-small">
          Searching…
        </div>
      )}
      <ul className="place-suggest-list">
        {items.map((s) => {
          const key = s.isCurrentLocation
            ? "current-location"
            : String(s.id);
          const icon = s.isCurrentLocation
            ? "my_location"
            : s.isRecent
              ? "history"
              : "place";
          const subtitle = secondaryText(s);
          return (
            <li key={key}>
              <button
                type="button"
                className={`place-suggest-item ${s.isCurrentLocation ? "is-current" : ""}`}
                onClick={() => onSelect?.(s)}
              >
                <span className="place-suggest-icon" aria-hidden>
                  <md-icon>{icon}</md-icon>
                </span>
                <span className="place-suggest-text">
                  <span className="place-suggest-title">
                    {s.isCurrentLocation
                      ? s.name
                      : highlightMatch(s.name, query)}
                  </span>
                  {subtitle ? (
                    <span className="place-suggest-sub">{subtitle}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
