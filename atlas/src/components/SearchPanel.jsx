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
 * Landing search — place card after a selection; Saved underneath when idle.
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
  onCollapsePanel = null,
  collapseIcon = "chevron_left",
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
  const isSearching = listVisible || (isCompact && mobileExpanded && !place);
  const showingRecents =
    listVisible &&
    !(placeList.query || "").trim() &&
    placeList.items.some((p) => p?.isRecent || p?.fromRecent);
  /* Search stays open — no collapse chevron on idle, Recent, or place card. */
  const showCollapse = false;
  /* Default landing: only the search pill floats (no padded card chrome). */
  const isBareSearch = !listVisible && !showPlaceCard;

  return (
    <section
      className={`mode-panel search-panel ${listVisible ? "has-suggest" : ""} ${showBody ? "is-expanded" : "is-collapsed"} ${showPlaceCard ? "has-place" : ""} ${isSearching ? "is-searching" : ""} ${isBareSearch ? "is-bare" : ""}`}
    >
      <div className={`search-block ${listVisible ? "has-list" : ""}`}>
        <div className="search-chrome">
          <div className={`search-bar ${query ? "has-query" : ""}`}>
            <img
              className="search-bar-leading-pin"
              src={`${import.meta.env.BASE_URL}favicon.svg`}
              alt=""
              width="28"
              height="28"
              aria-hidden
            />
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
                enterSelectsFirst={false}
                onListChange={setPlaceList}
                onFocusField={() => {
                  if (isCompact) setMobileExpanded(true);
                }}
              />
            </div>
            {query ? (
              <div className="search-bar-actions">
                <md-icon-button
                  class="search-clear-btn"
                  aria-label="Clear search"
                  onClick={collapseSearch}
                >
                  <md-icon>close</md-icon>
                </md-icon-button>
              </div>
            ) : null}
          </div>
          {showCollapse ? (
            <md-icon-button
              type="button"
              class="collapse-panel-btn search-chrome-collapse"
              aria-label="Collapse panel"
              onClick={onCollapsePanel}
            >
              <md-icon>{collapseIcon}</md-icon>
            </md-icon-button>
          ) : null}
        </div>
      </div>

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
