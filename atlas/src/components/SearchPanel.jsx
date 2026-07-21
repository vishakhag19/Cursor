import SuggestInput from "./SuggestInput";
import PlaceDetailsCard from "./PlaceDetailsCard";

/** Search-only panel. Landing dropdown = recent searches only. */
export default function SearchPanel({
  query,
  onQueryChange,
  onSelectPlace,
  place,
  onClear,
  onDirectionsTo,
  onDirectionsFrom,
  onAddToRoute,
  recentPlaces = [],
  near = null,
}) {
  return (
    <section className="mode-panel search-panel">
      <div className={`search-bar ${query ? "has-query" : ""}`}>
        <div className="search-bar-field">
          <SuggestInput
            id="main-search"
            label=""
            value={query}
            onChange={onQueryChange}
            onSelect={onSelectPlace}
            placeholder="Search here"
            allowCurrentLocation={false}
            recentPlaces={recentPlaces}
            near={near}
          />
        </div>
        <div className="search-bar-actions">
          {query ? (
            <md-icon-button
              class="search-clear-btn"
              aria-label="Clear search"
              onClick={onClear}
            >
              <md-icon>close</md-icon>
            </md-icon-button>
          ) : (
            <span className="search-bar-glyph" aria-hidden>
              <md-icon>search</md-icon>
            </span>
          )}
        </div>
      </div>

      {place && (
        <PlaceDetailsCard
          place={place}
          onClose={onClear}
          onDirectionsTo={onDirectionsTo}
          onDirectionsFrom={onDirectionsFrom}
          onAddToRoute={onAddToRoute}
        />
      )}
    </section>
  );
}
