import { useState } from "react";
import SuggestInput from "./SuggestInput";
import PlaceDetailsCard from "./PlaceDetailsCard";
import PlaceSuggestionList from "./PlaceSuggestionList";

/**
 * Landing search — same suggestion pattern as Directions:
 * shared PlaceSuggestionList rendered in the panel below the input.
 */
export default function SearchPanel({
  query,
  onQueryChange,
  onSelectPlace,
  place,
  onClear,
  onDirectionsTo,
  onDirectionsFrom,
  recentPlaces = [],
  near = null,
}) {
  const [placeList, setPlaceList] = useState({
    open: false,
    items: [],
    query: "",
    loading: false,
    select: null,
  });

  function clearPlaceList() {
    setPlaceList({
      open: false,
      items: [],
      query: "",
      loading: false,
      select: null,
    });
  }

  const listVisible =
    placeList.open && (placeList.items.length > 0 || placeList.loading);

  return (
    <section className="mode-panel search-panel">
      <div className="search-block">
        <div className={`search-bar ${query ? "has-query" : ""}`}>
          <div className="search-bar-field">
            <SuggestInput
              id="main-search"
              label=""
              value={query}
              onChange={onQueryChange}
              onSelect={(selected) => {
                onSelectPlace(selected);
                clearPlaceList();
              }}
              placeholder="Search here"
              allowCurrentLocation={false}
              recentPlaces={recentPlaces}
              near={near}
              bare
              externalList
              onListChange={setPlaceList}
            />
          </div>
          <div className="search-bar-actions">
            {query ? (
              <md-icon-button
                class="search-clear-btn"
                aria-label="Clear search"
                onClick={() => {
                  onClear();
                  clearPlaceList();
                }}
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

        {listVisible && (
          <PlaceSuggestionList
            items={placeList.items}
            query={placeList.query}
            loading={placeList.loading}
            onSelect={(selected) => {
              if (placeList.select) placeList.select(selected);
              else {
                onSelectPlace(selected);
                clearPlaceList();
              }
            }}
          />
        )}
      </div>

      {place && !listVisible && (
        <PlaceDetailsCard
          place={place}
          onDirectionsTo={onDirectionsTo}
          onDirectionsFrom={onDirectionsFrom}
        />
      )}
    </section>
  );
}
