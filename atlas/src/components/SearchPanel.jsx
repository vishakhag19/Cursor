import SuggestInput from "./SuggestInput";
import PlaceDetailsCard from "./PlaceDetailsCard";

/** Search-only panel (no tabs). Landing dropdown = recent searches only. */
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
      <div className="search-block">
        <SuggestInput
          id="main-search"
          label="Search here"
          value={query}
          onChange={onQueryChange}
          onSelect={onSelectPlace}
          placeholder="Search places"
          allowCurrentLocation={false}
          recentPlaces={recentPlaces}
          near={near}
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
          {recentPlaces.length
            ? "Focus the search field to see recent places, or type to find somewhere new."
            : "Search for a place or click the map. Results are ordered nearest first."}
        </p>
      )}
    </section>
  );
}
