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
  onOpenDirections,
  recentPlaces = [],
  near = null,
}) {
  return (
    <section className="mode-panel search-panel">
      <div className="gmaps-search-card">
        <div className="gmaps-search-field-wrap">
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
          <div className="gmaps-search-actions">
            {query ? (
              <md-icon-button
                class="search-clear-btn"
                aria-label="Clear search"
                onClick={onClear}
              >
                <md-icon>close</md-icon>
              </md-icon-button>
            ) : (
              <span className="gmaps-search-glyph" aria-hidden>
                <md-icon>search</md-icon>
              </span>
            )}
            <button
              type="button"
              className="gmaps-directions-fab"
              aria-label="Directions"
              title="Directions"
              onClick={() => onOpenDirections?.()}
            >
              <md-icon>directions</md-icon>
            </button>
          </div>
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
