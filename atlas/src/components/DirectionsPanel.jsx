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
  const [forceShowStops, setForceShowStops] = useState(false);
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

  const orderedRoutes = routeOptions.filter(
    (opt) => !editMode || opt.id === selectedRouteId,
  );

  const bothEndsSet = stops.filter(Boolean).length >= 2;
  const hasRouteResults = bothEndsSet && routeOptions.length > 0;

  return (
    <section
      className={`mode-panel directions-panel ${editMode ? "is-editing" : ""} ${hasRouteResults ? "has-route-results" : ""} ${forceShowStops ? "show-stops" : ""}`}
    >
      <div className="dir-top-bar">
        <span className="md-typescale-title-medium dir-title">
          {editMode ? "Edit route" : "Directions"}
        </span>
        <div className="dir-top-actions">
          {!editMode && hasRouteResults && !forceShowStops && (
            <button
              type="button"
              className="dir-change-stops"
              onClick={() => setForceShowStops(true)}
            >
              <md-icon>edit_location_alt</md-icon>
              <span className="md-typescale-label-large">Change</span>
            </button>
          )}
          <md-icon-button type="button" aria-label="Close directions" onClick={onClose}>
            <md-icon>close</md-icon>
          </md-icon-button>
        </div>
      </div>

      {!editMode && (
        <>
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
                      {editMode && active && comparison?.label ? (
                        <span
                          className={`dir-route-delta tone-${comparison.tone} md-typescale-body-small`}
                          role="status"
                        >
                          {editBusy ? "Updating…" : comparison.label}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
                <div className="dir-route-actions">
                  {active && !editMode && onShowSteps ? (
                    <span className="has-tip" data-tip="Steps">
                      <md-icon-button
                        type="button"
                        class="dir-route-steps-btn"
                        aria-label="View turn-by-turn steps"
                        title="View turn-by-turn steps"
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowSteps();
                        }}
                      >
                        <md-icon>list</md-icon>
                      </md-icon-button>
                    </span>
                  ) : null}
                  {active && editMode ? (
                    <>
                      <span className="has-tip" data-tip="Undo last edit">
                        <md-icon-button
                          type="button"
                          class="dir-route-undo-btn"
                          aria-label="Undo last edit"
                          title="Undo last edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUndo?.();
                          }}
                          disabled={!canUndo || undefined}
                        >
                          <md-icon>undo</md-icon>
                        </md-icon-button>
                      </span>
                      <span className="has-tip" data-tip="Reset to suggested route">
                        <md-icon-button
                          type="button"
                          class="dir-route-reset-btn"
                          aria-label="Reset to suggested route"
                          title="Reset to suggested route"
                          onClick={(e) => {
                            e.stopPropagation();
                            onResetSuggested?.();
                          }}
                          disabled={!canReset || undefined}
                        >
                          <md-icon>restart_alt</md-icon>
                        </md-icon-button>
                      </span>
                    </>
                  ) : null}
                  {active ? (
                    <span
                      className="has-tip"
                      data-tip={editMode ? "Finish editing" : "Edit route"}
                    >
                      <md-icon-button
                        type="button"
                        class={`dir-route-edit-btn ${editMode ? "is-edit-active" : ""}`}
                        aria-label={editMode ? "Finish editing" : "Edit route"}
                        title={editMode ? "Finish editing" : "Edit route"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleEdit();
                        }}
                      >
                        <md-icon>{editMode ? "check" : "edit"}</md-icon>
                      </md-icon-button>
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
