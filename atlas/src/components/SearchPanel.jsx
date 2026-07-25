import { useEffect, useImperativeHandle, useRef, useState } from "react";
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
 * Landing search — floating Search here pill; suggestions and Saved routes
 * are separate surfaces. Selected place details sit in a bottom sheet on mobile.
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
  backRef = null,
  onBackableChange = null,
}) {
  const isCompact = useIsCompact();
  const panelRef = useRef(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [listDismissNonce, setListDismissNonce] = useState(0);
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

  function dismissSearchList() {
    clearPlaceList();
    setListDismissNonce((n) => n + 1);
    setMobileExpanded(false);
    const active = document.activeElement;
    if (active && panelRef.current?.contains(active)) {
      active.blur?.();
    }
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
    setMobileExpanded(false);
  }

  function collapseSearch() {
    clearPlaceList();
    onClear();
    setMobileExpanded(false);
  }

  const listVisible =
    placeList.open && (placeList.items.length > 0 || placeList.loading);

  function handleSystemBack() {
    if (listVisible) {
      dismissSearchList();
      return Boolean(place);
    }
    if (place) {
      onDismissPlace?.();
      setMobileExpanded(false);
      return false;
    }
    if (isCompact && mobileExpanded) {
      setMobileExpanded(false);
      const active = document.activeElement;
      if (active && panelRef.current?.contains(active)) {
        active.blur?.();
      }
      return false;
    }
    return false;
  }

  const searchBackable =
    listVisible || Boolean(place) || (isCompact && mobileExpanded);

  useImperativeHandle(
    backRef,
    () => ({
      handleBack: handleSystemBack,
      isBackable: () => searchBackable,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchBackable, listVisible, place, isCompact, mobileExpanded],
  );

  useEffect(() => {
    onBackableChange?.(searchBackable);
    return () => onBackableChange?.(false);
  }, [searchBackable, onBackableChange]);

  useEffect(() => {
    if (!listVisible && !(isCompact && mobileExpanded && !place)) {
      return undefined;
    }
    function onPointerDown(e) {
      const root = panelRef.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      /* Place card is outside the top panel on mobile — don't dismiss for it. */
      if (e.target?.closest?.(".place-bottom-sheet")) return;
      dismissSearchList();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [listVisible, isCompact, mobileExpanded, place]);

  const hasSaved = savedRoutes.length > 0;
  const showSaved = !listVisible && !place && hasSaved;
  const showPlaceCard = Boolean(place) && !listVisible;
  const isSearching = listVisible || (isCompact && mobileExpanded && !place);
  const showingRecents =
    listVisible &&
    !(placeList.query || "").trim() &&
    placeList.items.some((p) => p?.isRecent || p?.fromRecent);
  const placeCard = showPlaceCard ? (
    <PlaceDetailsCard
      place={place}
      onDirectionsTo={onDirectionsTo}
      onDirectionsFrom={onDirectionsFrom}
    />
  ) : null;

  return (
    <>
      <section
        ref={panelRef}
        className={`mode-panel search-panel is-bare ${listVisible ? "has-suggest" : ""} ${isSearching ? "is-searching" : ""} ${showSaved ? "has-saved" : ""} ${showPlaceCard && !isCompact ? "has-place" : ""}`}
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
                  dismissNonce={listDismissNonce}
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

        {/* Desktop: place details stay in the side panel */}
        {!isCompact && placeCard}

        {showSaved && (
          <div className="landing-saved">
            <div className="landing-saved-head">
              <h2 className="md-typescale-title-small">Saved routes</h2>
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

      {/* Mobile: selected place as a bottom card (map stays visible above) */}
      {isCompact && placeCard ? (
        <div className="place-bottom-sheet" role="region" aria-label="Place details">
          {placeCard}
        </div>
      ) : null}
    </>
  );
}
