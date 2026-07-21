import { useState } from "react";
import SuggestInput from "./SuggestInput";
import PlaceSuggestionList from "./PlaceSuggestionList";
import { formatDistance, formatDuration } from "../utils/format";

/**
 * Directions panel — Google Maps–style inputs with a shared place list below.
 */
export default function DirectionsPanel({
  stops,
  stopTexts,
  onStopText,
  onStopSelect,
  onAddStop,
  onRemoveStop,
  onSwap,
  onClose,
  routeOptions,
  selectedRouteId,
  onSelectRoute,
  loading,
  error,
  currentLocation,
  near = null,
  recentPlaces = [],
  onRequestLocation = null,
  editMode = false,
  onToggleEdit,
  canUndo = false,
  onUndo,
  canReset = false,
  onResetSuggested,
  comparison = null,
  editBusy = false,
  onShowSteps = null,
}) {
  const [activeStop, setActiveStop] = useState(null);
  const [placeList, setPlaceList] = useState({
    open: false,
    items: [],
    query: "",
    loading: false,
    select: null,
  });

  function handleListChange(index, payload) {
    if (activeStop !== index && !payload.open) return;
    if (payload.open || activeStop === index) {
      setPlaceList(payload);
    }
  }

  function clearPlaceList() {
    setPlaceList({
      open: false,
      items: [],
      query: "",
      loading: false,
      select: null,
    });
    setActiveStop(null);
  }

  const orderedRoutes = [
    ...routeOptions.filter((o) => o.id === selectedRouteId),
    ...routeOptions.filter((o) => o.id !== selectedRouteId),
  ].filter((opt) => !editMode || opt.id === selectedRouteId);

  const bothEndsSet = stops.filter(Boolean).length >= 2;
  const hasRouteResults = bothEndsSet && routeOptions.length > 0;
  const [forceShowStops, setForceShowStops] = useState(false);

  return (
    <section
      className={`mode-panel directions-panel ${editMode ? "is-editing" : ""} ${hasRouteResults ? "has-route-results" : ""} ${forceShowStops ? "show-stops" : ""}`}
    >
      <div className="dir-top-bar">
        <span className="md-typescale-title-medium dir-title">
          {editMode ? "Edit route" : "Directions"}
        </span>
        <md-icon-button type="button" aria-label="Close directions" onClick={onClose}>
          <md-icon>close</md-icon>
        </md-icon-button>
      </div>

      {!editMode && (
        <>
          {hasRouteResults && !forceShowStops && (
            <button
              type="button"
              className="dir-change-stops"
              onClick={() => setForceShowStops(true)}
            >
              <md-icon>edit_location_alt</md-icon>
              <span className="md-typescale-body-medium">Change locations</span>
            </button>
          )}
          <div className="dir-stops-block">
          <div className="dir-stops">
            <div className="dir-stops-rail" aria-hidden>
              {stops.map((_, i) => (
                <span
                  key={`dot-${i}`}
                  className={`dir-rail-dot ${i === 0 ? "start" : i === stops.length - 1 ? "end" : "mid"}`}
                />
              ))}
            </div>

            <div className="dir-stops-fields">
              {stops.map((stop, i) => (
                <div className="dir-stop-row" key={`stop-${i}`}>
                  <SuggestInput
                    id={`dir-stop-${i}`}
                    label={
                      i === 0
                        ? "Starting point"
                        : i === stops.length - 1
                          ? "Destination"
                          : `Stop ${i}`
                    }
                    value={stopTexts[i] || ""}
                    onChange={(v) => onStopText(i, v)}
                    onSelect={(place) => {
                      onStopSelect(i, place);
                      clearPlaceList();
                    }}
                    placeholder={
                      i === 0
                        ? "Choose starting point"
                        : i === stops.length - 1
                          ? "Choose destination"
                          : "Add stop"
                    }
                    currentLocation={currentLocation}
                    allowCurrentLocation={i === 0 || i === stops.length - 1}
                    recentPlaces={recentPlaces}
                    near={near}
                    onRequestLocation={onRequestLocation}
                    externalList
                    onFocusField={() => setActiveStop(i)}
                    onListChange={(payload) => handleListChange(i, payload)}
                  />
                  {stops.length > 2 && (
                    <md-icon-button
                      type="button"
                      aria-label="Remove stop"
                      onClick={() => onRemoveStop(i)}
                    >
                      <md-icon>close</md-icon>
                    </md-icon-button>
                  )}
                </div>
              ))}
            </div>

            <md-icon-button
              class="dir-swap"
              type="button"
              aria-label="Swap start and destination"
              onClick={onSwap}
            >
              <md-icon>swap_vert</md-icon>
            </md-icon-button>
          </div>

          {placeList.open && (placeList.items.length > 0 || placeList.loading) && (
            <PlaceSuggestionList
              items={placeList.items}
              query={placeList.query}
              loading={placeList.loading}
              onSelect={(place) => {
                if (placeList.select) placeList.select(place);
                else if (activeStop != null) {
                  onStopSelect(activeStop, place);
                  clearPlaceList();
                }
              }}
            />
          )}

          <button type="button" className="dir-add-stop" onClick={onAddStop}>
            <md-icon>add</md-icon>
            <span className="md-typescale-body-medium">Add Stops</span>
          </button>
          </div>
        </>
      )}

      {loading && (
        <p className="hint tight md-typescale-body-medium" role="status">
          Finding routes…
        </p>
      )}

      {editMode && (
        <div className="edit-toolbar">
          <p className="hint md-typescale-body-small edit-hint">
            Drag the blue line to reshape the route. Drag a point to move it.
            Tap a point, then use the × on the map to remove it.
          </p>
          {comparison && (
            <div
              className={`comparison-chip tone-${comparison.tone}`}
              role="status"
            >
              <md-icon>
                {comparison.tone === "better"
                  ? "trending_down"
                  : comparison.tone === "worse"
                    ? "trending_up"
                    : "schedule"}
              </md-icon>
              <span className="md-typescale-label-large">{comparison.label}</span>
              {editBusy && (
                <span className="comparison-busy md-typescale-label-small">
                  Updating…
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="error-msg md-typescale-body-medium" role="alert">
          {error}
        </p>
      )}

      {orderedRoutes.length > 0 && (
        <div className="dir-route-list">
          {orderedRoutes.map((opt, index) => {
            const active = opt.id === selectedRouteId;
            return (
              <div
                key={opt.id}
                className={`dir-route-card ${active ? "is-active" : ""} ${editMode && active ? "is-editing" : ""}`}
              >
                {active && <span className="dir-route-bar" aria-hidden />}
                <button
                  type="button"
                  className="dir-route-select"
                  onClick={() => onSelectRoute(opt)}
                  disabled={editMode && !active ? true : undefined}
                >
                  <div className="dir-route-body">
                    <div className="dir-route-title-row">
                      <md-icon class="dir-route-mode">directions_car</md-icon>
                      <div>
                        <div className="md-typescale-title-small">{opt.label}</div>
                        {opt.badge && (
                          <div className="md-typescale-body-small dir-route-badge">
                            {opt.badge}
                          </div>
                        )}
                        {!opt.badge && index > 0 && (
                          <div className="md-typescale-body-small dir-route-badge muted">
                            Option {index + 1}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="dir-route-stats">
                      <span className="dir-route-time md-typescale-title-medium">
                        {formatDuration(opt.duration)}
                      </span>
                      <span className="md-typescale-body-medium dir-route-dist">
                        {formatDistance(opt.distance)}
                      </span>
                    </div>
                  </div>
                </button>
                {active && !editMode && onShowSteps && (
                  <md-icon-button
                    type="button"
                    class="dir-route-steps-btn has-tip"
                    aria-label="View turn-by-turn steps"
                    title="View turn-by-turn steps"
                    data-tip="Steps"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowSteps();
                    }}
                  >
                    <md-icon>list</md-icon>
                  </md-icon-button>
                )}
                {active && editMode && (
                  <>
                    <md-icon-button
                      type="button"
                      class="dir-route-undo-btn has-tip"
                      aria-label="Undo last edit"
                      title="Undo last edit"
                      data-tip="Undo last edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUndo?.();
                      }}
                      disabled={!canUndo || undefined}
                    >
                      <md-icon>undo</md-icon>
                    </md-icon-button>
                    <md-icon-button
                      type="button"
                      class="dir-route-reset-btn has-tip"
                      aria-label="Reset to suggested route"
                      title="Reset to suggested route"
                      data-tip="Reset to suggested route"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResetSuggested?.();
                      }}
                      disabled={!canReset || undefined}
                    >
                      <md-icon>restart_alt</md-icon>
                    </md-icon-button>
                  </>
                )}
                {active && (
                  <md-icon-button
                    type="button"
                    class={`dir-route-edit-btn has-tip ${editMode ? "is-edit-active" : ""}`}
                    aria-label={editMode ? "Finish editing" : "Edit route"}
                    title={editMode ? "Finish editing" : "Edit route"}
                    data-tip={editMode ? "Finish editing" : "Edit route"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleEdit();
                    }}
                  >
                    <md-icon>{editMode ? "check" : "edit"}</md-icon>
                  </md-icon-button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
