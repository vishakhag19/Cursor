import { useEffect, useState } from "react";
import SuggestInput from "./SuggestInput";
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
 * Mobile: search-only until focus, unless Saved routes exist (then show them).
 * Selecting a place drops a map pin only — no place details card.
 */
export default function SearchPanel({
  query,
  onQueryChange,
  onSelectPlace,
  place: _place,
  onClear,
  onDirectionsTo: _onDirectionsTo,
  onDirectionsFrom: _onDirectionsFrom,
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
  const hasSaved = savedRoutes.length > 0;
  // On mobile, expand when the user focuses search OR when Saved routes exist
  // so Saved is reachable without hunting for a hidden section.
  const showBody =
    !isCompact || mobileExpanded || listVisible || hasSaved;
  const showSaved = showBody && !listVisible && hasSaved;

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
                if (isCompact) setMobileExpanded(false);
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
              <md-list-item key={r.id} class="landing-saved-item">
                <button
                  type="button"
                  className="landing-saved-open"
                  onClick={() => onLoadSaved?.(r)}
                >
                  <span className="landing-saved-open-title">{r.name}</span>
                  <span className="landing-saved-open-meta">
                    {formatDistance(r.route?.distance || 0)} ·{" "}
                    {formatDuration(r.route?.duration || 0)}
                  </span>
                </button>
                <div slot="end" className="landing-saved-actions">
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
              if (isCompact) setMobileExpanded(false);
            }}
          />
        </div>
      )}
    </section>
  );
}
