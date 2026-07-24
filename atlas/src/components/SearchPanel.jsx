import { useEffect, useState } from "react";
import SuggestInput from "./SuggestInput";
import PlaceDetailsCard from "./PlaceDetailsCard";
import PlaceSuggestionList from "./PlaceSuggestionList";
import { formatDistance, formatDuration } from "../utils/format";

const EXPLORE_CHIPS = [
  { id: "restaurants", label: "Restaurants", icon: "restaurant", query: "restaurants" },
  { id: "coffee", label: "Coffee", icon: "local_cafe", query: "coffee" },
  { id: "petrol", label: "Petrol", icon: "local_gas_station", query: "petrol" },
  { id: "grocery", label: "Grocery", icon: "local_grocery_store", query: "grocery" },
];

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
 * Landing search — Google Maps mobile reference:
 * chips under search, Home/Work/More when focused, Recent list, Saved.
 */
export default function SearchPanel({
  query,
  onQueryChange,
  onSelectPlace,
  place,
  onClear,
  onDismissPlace = null,
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

  function handleQueryChange(next) {
    onQueryChange(next);
    // Typing away from a selected place dismisses the card until they pick again.
    if (place && next.trim() !== (place.name || "").trim()) {
      onDismissPlace?.();
    }
  }

  function pickPlace(selected) {
    onSelectPlace(selected);
    clearPlaceList();
    if (isCompact) setMobileExpanded(true);
  }

  function collapseSearch() {
    clearPlaceList();
    onClear();
    setMobileExpanded(false);
  }

  const listVisible =
    placeList.open && (placeList.items.length > 0 || placeList.loading);
  const hasSaved = savedRoutes.length > 0;
  const showBody =
    !isCompact ||
    mobileExpanded ||
    listVisible ||
    Boolean(place) ||
    hasSaved;
  const showSaved = showBody && !listVisible && !place && hasSaved;
  const showPlaceCard = Boolean(place) && !listVisible && showBody;
  const showShortcuts = listVisible || (isCompact && mobileExpanded && !place);
  const showChips = !listVisible && !place && !query.trim();
  const showingRecents =
    listVisible &&
    !(placeList.query || "").trim() &&
    placeList.items.some((p) => p?.isRecent || p?.fromRecent);

  return (
    <section
      className={`mode-panel search-panel ${listVisible ? "has-suggest" : ""} ${showBody ? "is-expanded" : "is-collapsed"} ${showPlaceCard ? "has-place" : ""} ${showShortcuts ? "is-searching" : ""}`}
    >
      <div className={`search-block ${listVisible ? "has-list" : ""}`}>
        <div className={`search-bar ${query ? "has-query" : ""}`}>
          {listVisible || (isCompact && mobileExpanded) ? (
            <md-icon-button
              type="button"
              class="search-back-btn"
              aria-label="Back"
              onClick={collapseSearch}
            >
              <md-icon>arrow_back</md-icon>
            </md-icon-button>
          ) : null}
          <div className="search-bar-field">
            <SuggestInput
              id="main-search"
              label=""
              value={query}
              onChange={handleQueryChange}
              onSelect={pickPlace}
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

      {showShortcuts ? (
        <div className="search-shortcuts" role="group" aria-label="Shortcuts">
          <button type="button" className="search-shortcut" disabled>
            <span className="search-shortcut-icon" aria-hidden>
              <md-icon>home</md-icon>
            </span>
            <span className="search-shortcut-text">
              <span className="search-shortcut-title">Home</span>
              <span className="search-shortcut-sub">Set location</span>
            </span>
          </button>
          <button type="button" className="search-shortcut" disabled>
            <span className="search-shortcut-icon" aria-hidden>
              <md-icon>work</md-icon>
            </span>
            <span className="search-shortcut-text">
              <span className="search-shortcut-title">Work</span>
              <span className="search-shortcut-sub">Set location</span>
            </span>
          </button>
          <button type="button" className="search-shortcut" disabled>
            <span className="search-shortcut-icon" aria-hidden>
              <md-icon>more_horiz</md-icon>
            </span>
            <span className="search-shortcut-text">
              <span className="search-shortcut-title">More</span>
              <span className="search-shortcut-sub">Labels</span>
            </span>
          </button>
        </div>
      ) : null}

      {showChips ? (
        <div className="explore-chips" role="list" aria-label="Explore nearby">
          {EXPLORE_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="explore-chip"
              role="listitem"
              onClick={() => {
                handleQueryChange(chip.query);
                if (isCompact) setMobileExpanded(true);
              }}
            >
              <md-icon>{chip.icon}</md-icon>
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {listVisible && (
        <div className="landing-suggest">
          {(showingRecents || !(placeList.query || "").trim()) && (
            <div className="landing-suggest-head">
              <h2 className="md-typescale-title-small">Recent</h2>
            </div>
          )}
          <PlaceSuggestionList
            items={placeList.items}
            query={placeList.query}
            loading={placeList.loading}
            onSelect={(selected) => {
              if (placeList.select) placeList.select(selected);
              else pickPlace(selected);
            }}
          />
        </div>
      )}

      {showPlaceCard ? (
        <PlaceDetailsCard
          place={place}
          onDirectionsTo={onDirectionsTo}
          onDirectionsFrom={onDirectionsFrom}
        />
      ) : null}

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
    </section>
  );
}
