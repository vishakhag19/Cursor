import { useState } from "react";
import SuggestInput from "./SuggestInput";
import MdTextField from "./MdTextField";
import MdCheckbox from "./MdCheckbox";
import { formatDistance, formatDuration, placeLabel } from "../utils/format";

const MODES = [
  { id: "driving", label: "Drive", icon: "directions_car" },
  { id: "walking", label: "Walk", icon: "directions_walk" },
  { id: "cycling", label: "Bike", icon: "directions_bike" },
];

export default function CreateRoutePanel({
  routeName,
  onRouteName,
  waypoints,
  travelMode,
  onTravelMode,
  snapToRoads,
  onSnapToRoads,
  summary,
  loading,
  error,
  savedRoutes,
  currentLocation,
  onAddPlace,
  onAddCurrentLocation,
  onRemoveWaypoint,
  onMoveWaypoint,
  onUndo,
  onClear,
  onBuild,
  onSave,
  onLoadSaved,
  onDeleteSaved,
}) {
  const [addQuery, setAddQuery] = useState("");

  return (
    <section className="mode-panel create-panel">
      <p className="hint tight md-typescale-body-medium">
        Click the map to add stops, or start from your current location.
      </p>

      <MdTextField
        id="route-name"
        label="Route name"
        value={routeName}
        onChange={onRouteName}
        placeholder="My custom route"
        maxLength={80}
      />

      <md-chip-set
        class="travel-chips"
        role="group"
        aria-label="Travel mode"
      >
        {MODES.map((m) => (
          <md-filter-chip
            key={m.id}
            label={m.label}
            selected={travelMode === m.id || undefined}
            onClick={() => onTravelMode(m.id)}
          >
            <md-icon slot="icon">{m.icon}</md-icon>
          </md-filter-chip>
        ))}
      </md-chip-set>

      <label className="toggle-row md-typescale-body-medium">
        <MdCheckbox
          checked={snapToRoads}
          onChange={onSnapToRoads}
          aria-label="Snap to roads"
        />
        <span>Snap to roads</span>
      </label>

      <SuggestInput
        id="add-stop"
        label="Add a stop"
        value={addQuery}
        onChange={setAddQuery}
        onSelect={(place) => {
          onAddPlace(place);
          setAddQuery("");
        }}
        placeholder="Search or Your location"
        currentLocation={currentLocation}
      />

      <md-filled-tonal-button
        type="button"
        onClick={onAddCurrentLocation}
        disabled={!currentLocation || undefined}
      >
        <md-icon slot="icon">my_location</md-icon>
        Add my current location
      </md-filled-tonal-button>

      <div className="waypoint-header md-typescale-label-large">
        {waypoints.length} stop{waypoints.length === 1 ? "" : "s"}
      </div>

      <md-list class="waypoint-list">
        {waypoints.map((wp, i) => (
          <md-list-item key={wp.id}>
            <div slot="start" className={`wp-badge ${i === 0 ? "start" : i === waypoints.length - 1 ? "end" : ""}`}>
              {i + 1}
            </div>
            <div slot="headline">{placeLabel(wp)}</div>
            <div slot="supporting-text">
              {wp.isCurrentLocation ? "Live GPS" : wp.display_name || ""}
            </div>
            <div slot="end" className="wp-actions">
              <md-icon-button
                type="button"
                disabled={i === 0 || undefined}
                onClick={() => onMoveWaypoint(i, i - 1)}
                aria-label="Move up"
              >
                <md-icon>arrow_upward</md-icon>
              </md-icon-button>
              <md-icon-button
                type="button"
                disabled={i === waypoints.length - 1 || undefined}
                onClick={() => onMoveWaypoint(i, i + 1)}
                aria-label="Move down"
              >
                <md-icon>arrow_downward</md-icon>
              </md-icon-button>
              <md-icon-button
                type="button"
                onClick={() => onRemoveWaypoint(i)}
                aria-label="Remove stop"
              >
                <md-icon>close</md-icon>
              </md-icon-button>
            </div>
          </md-list-item>
        ))}
      </md-list>

      <div className="btn-row wrap">
        <md-filled-button
          type="button"
          onClick={onBuild}
          disabled={waypoints.length < 2 || loading || undefined}
        >
          {loading ? "Building…" : "Build route"}
        </md-filled-button>
        <md-filled-tonal-button
          type="button"
          onClick={onSave}
          disabled={!summary || undefined}
        >
          Save route
        </md-filled-tonal-button>
        <md-text-button
          type="button"
          onClick={onUndo}
          disabled={!waypoints.length || undefined}
        >
          Undo
        </md-text-button>
        <md-text-button
          type="button"
          onClick={onClear}
          disabled={!waypoints.length || undefined}
        >
          Clear
        </md-text-button>
      </div>

      {error && (
        <p className="error-msg md-typescale-body-medium" role="alert">
          {error}
        </p>
      )}

      {summary && (
        <div className="route-summary m3-card tonal">
          <strong className="md-typescale-title-medium">
            {formatDuration(summary.duration)} ·{" "}
            {formatDistance(summary.distance)}
          </strong>
          <span className="md-typescale-body-small">
            {snapToRoads ? "Snapped to roads" : "Straight-line path"} ·{" "}
            {travelMode}
          </span>
        </div>
      )}

      <div className="saved-section">
        <md-divider />
        <h3 className="md-typescale-title-medium">Saved routes</h3>
        {savedRoutes.length === 0 ? (
          <p className="hint tight md-typescale-body-medium">
            No saved routes yet. Build one and hit Save.
          </p>
        ) : (
          <md-list class="saved-list">
            {savedRoutes.map((r) => (
              <md-list-item key={r.id} type="button" onClick={() => onLoadSaved(r)}>
                <md-icon slot="start">route</md-icon>
                <div slot="headline">{r.name}</div>
                <div slot="supporting-text">
                  {r.waypoints?.length || 0} stops
                  {r.stats ? ` · ${formatDistance(r.stats.distance)}` : ""}
                </div>
                <md-icon-button
                  slot="end"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSaved(r.id);
                  }}
                  aria-label={`Delete ${r.name}`}
                >
                  <md-icon>delete</md-icon>
                </md-icon-button>
              </md-list-item>
            ))}
          </md-list>
        )}
      </div>
    </section>
  );
}
