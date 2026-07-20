import SuggestInput from "./SuggestInput";
import PlaceDetailsCard from "./PlaceDetailsCard";

/** Search-only panel (no tabs). */
export default function SearchPanel({
  query,
  onQueryChange,
  onSelectPlace,
  place,
  onClear,
  onDirectionsTo,
  onDirectionsFrom,
  onAddToRoute,
  currentLocation,
}) {
  return (
    <section className="mode-panel search-panel">
      <div className="search-block">
        <SuggestInput
          id="main-search"
          label="Search here"
          value={query}
          onChange={onQueryChange}
          onSelect={onSelectPlace}
          placeholder="Search places"
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
          Search for a place or click the map. Open Directions from a place
          card to see the shortest route options.
        </p>
      )}
    </section>
  );
}
