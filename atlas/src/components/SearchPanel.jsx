import { useEffect, useState } from "react";
import SuggestInput from "./SuggestInput";
import PlaceDetailsCard from "./PlaceDetailsCard";
import PlaceSuggestionList from "./PlaceSuggestionList";
import { formatDistance, formatDuration } from "../utils/format";

function useIsCompact(query = "(max-width: 800px)") {
  const [compact, setCompact] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return compact;
}

/**
 * Landing search — Saved routes under the input; suggestions below.
 * Mobile: search field only until the field is focused.
 * Avoided roads live under Route preferences → Your road rules.
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
  savedRoutes = [],
  onLoadSaved = null,
  onDeleteSaved = null,
}) {
  const isCompact = useIsCompact();
  const [mobileExpanded, setMobileExpanded] = useState(false);
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
  const showBody = !isCompact || mobileExpanded || Boolean(place) || listVisible;
  const showSaved = showBody && !place && !listVisible && savedRoutes.length > 0;

  return (
    <section
      className={`mode-panel search-panel ${listVisible ? "has-suggest" : ""} ${showBody ? "is-expanded" : "is-collapsed"}`}
    >
      <div className={`search-block ${listVisible ? "has-list" : ""}`}>
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
              onFocusField={() => {
                if (isCompact) setMobileExpanded(true);
              }}
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
      </div>

      {showSaved && (
        <div className="landing-saved">
          <div className="landing-saved-head">
            <md-icon class="landing-saved-icon">bookmark</md-icon>
            <h2 className="md-typescale-title-small">Saved</h2>
          </div>
          <md-list class="landing-saved-list">
            {savedRoutes.map((r) => (
              <md-list-item key={r.id}>
                <div slot="headline">{r.name}</div>
                <div slot="supporting-text">
                  {formatDistance(r.route?.distance || 0)} ·{" "}
                  {formatDuration(r.route?.duration || 0)}
                </div>
                <div slot="end" className="landing-saved-actions">
                  <md-text-button
                    type="button"
                    onClick={() => onLoadSaved?.(r)}
                  >
                    Open
                  </md-text-button>
                  <md-icon-button
                    type="button"
                    aria-label={`Delete ${r.name}`}
                    onClick={() => onDeleteSaved?.(r.id)}
                  >
                    <md-icon>delete</md-icon>
                  </md-icon-button>
                </div>
              </md-list-item>
            ))}
          </md-list>
        </div>
      )}

      {listVisible && (
        <div className="landing-suggest">
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
        </div>
      )}

      {place && !listVisible && showBody && (
        <PlaceDetailsCard
          place={place}
          onDirectionsTo={onDirectionsTo}
          onDirectionsFrom={onDirectionsFrom}
        />
      )}
    </section>
  );
}
