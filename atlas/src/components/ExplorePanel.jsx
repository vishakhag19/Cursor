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
  currentLocation,
}) {
  return (
    <section className="mode-panel">
      <div className="search-block">
        <SuggestInput
          id="explore-query"
          label="Search places"
          value={query}
          onChange={onQueryChange}
          onSelect={onSelectPlace}
          placeholder="City, street, or landmark"
          currentLocation={currentLocation}
        />
        {query && (
          <md-icon-button
            class="search-clear-btn"
            aria-label="Clear search"
            onClick={onClear}
          >
            <md-icon>close</md-icon>
          </md-icon-button>
        )}
      </div>

      {place ? (
        <div className="place-card m3-card">
          <md-elevation aria-hidden="true" />
          <h2 className="md-typescale-title-large">{place.name}</h2>
          <p className="md-typescale-body-medium place-meta">
            {place.display_name}
          </p>
          <div className="place-actions">
            <md-filled-button type="button" onClick={onDirectionsTo}>
              <md-icon slot="icon">directions</md-icon>
              Directions
            </md-filled-button>
            <md-outlined-button type="button" onClick={onDirectionsFrom}>
              From here
            </md-outlined-button>
            <md-text-button type="button" onClick={onAddToRoute}>
              Add to route
            </md-text-button>
          </div>
        </div>
      ) : (
        <p className="hint md-typescale-body-medium">
          Search for a place, allow location access to center on you, or click
          the map to drop a pin.
        </p>
      )}
    </section>
  );
}
