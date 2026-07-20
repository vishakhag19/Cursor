import SuggestInput from "./SuggestInput";
import PlaceDetailsCard from "./PlaceDetailsCard";

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
        <PlaceDetailsCard
          place={place}
          onClose={onClear}
          onDirectionsTo={onDirectionsTo}
          onDirectionsFrom={onDirectionsFrom}
          onAddToRoute={onAddToRoute}
        />
      ) : (
        <p className="hint md-typescale-body-medium">
          Search for a place, allow location access to center on you, or click
          the map to see place details for that pin.
        </p>
      )}
    </section>
  );
}
