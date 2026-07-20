import SuggestInput from "./SuggestInput";

export default function ExplorePanel({
  query,
  onQueryChange,
  onSelectPlace,
  place,
  onClear,
  onDirectionsFrom,
  onDirectionsTo,
  onAddToRoute,
}) {
  return (
    <section className="mode-panel">
      <form
        className="search-form"
        onSubmit={(e) => e.preventDefault()}
        autoComplete="off"
      >
        <label className="sr-only" htmlFor="explore-query">
          Search places
        </label>
        <div className="search-field">
          <svg
            className="search-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <SuggestInput
            id="explore-query"
            value={query}
            onChange={onQueryChange}
            onSelect={onSelectPlace}
            placeholder="Search places"
          />
          {query && (
            <button
              className="search-clear"
              type="button"
              onClick={onClear}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </form>

      {place ? (
        <div className="place-card">
          <h2>{place.name}</h2>
          <p>{place.display_name}</p>
          <div className="place-actions">
            <button type="button" className="btn btn-primary" onClick={onDirectionsTo}>
              Directions
            </button>
            <button type="button" className="btn btn-ghost" onClick={onDirectionsFrom}>
              From here
            </button>
            <button type="button" className="btn btn-ghost" onClick={onAddToRoute}>
              Add to route
            </button>
          </div>
        </div>
      ) : (
        <p className="hint">
          Search for a city, street, or landmark. Click the map to drop a pin.
        </p>
      )}
    </section>
  );
}
