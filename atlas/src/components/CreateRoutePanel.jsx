import { useState } from "react";
import SuggestInput from "./SuggestInput";
import { formatDistance, formatDuration, placeLabel } from "../utils/format";

const MODES = [
  { id: "driving", label: "Drive" },
  { id: "walking", label: "Walk" },
  { id: "cycling", label: "Bike" },
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
  onAddPlace,
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
      <div className="create-intro">
        <p className="hint tight">
          Click the map to add stops, or search below. Drag pins to fine-tune.
        </p>
      </div>

      <label className="field-label" htmlFor="route-name">
        Route name
      </label>
      <input
        id="route-name"
        className="text-input"
        type="text"
        value={routeName}
        onChange={(e) => onRouteName(e.target.value)}
        placeholder="My custom route"
        maxLength={80}
      />

      <div className="travel-modes" role="group" aria-label="Travel mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`chip ${travelMode === m.id ? "is-active" : ""}`}
            onClick={() => onTravelMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={snapToRoads}
          onChange={(e) => onSnapToRoads(e.target.checked)}
        />
        <span>Snap to roads</span>
      </label>

      <label className="field-label" htmlFor="add-stop">
        Add a stop
      </label>
      <div className="search-field compact">
        <SuggestInput
          id="add-stop"
          value={addQuery}
          onChange={setAddQuery}
          onSelect={(place) => {
            onAddPlace(place);
            setAddQuery("");
          }}
          placeholder="Search to add a stop"
        />
      </div>

      <div className="waypoint-header">
        <span>
          {waypoints.length} stop{waypoints.length === 1 ? "" : "s"}
        </span>
      </div>

      <ul className="waypoint-list">
        {waypoints.map((wp, i) => (
          <li key={wp.id}>
            <span className={`wp-badge ${i === 0 ? "start" : i === waypoints.length - 1 ? "end" : ""}`}>
              {i + 1}
            </span>
            <span className="wp-label" title={wp.display_name || placeLabel(wp)}>
              {placeLabel(wp)}
            </span>
            <div className="wp-actions">
              <button
                type="button"
                className="icon-btn sm"
                disabled={i === 0}
                onClick={() => onMoveWaypoint(i, i - 1)}
                aria-label="Move up"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-btn sm"
                disabled={i === waypoints.length - 1}
                onClick={() => onMoveWaypoint(i, i + 1)}
                aria-label="Move down"
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-btn sm danger"
                onClick={() => onRemoveWaypoint(i)}
                aria-label="Remove stop"
                title="Remove"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="btn-row wrap">
        <button
          className="btn btn-primary"
          type="button"
          onClick={onBuild}
          disabled={waypoints.length < 2 || loading}
        >
          {loading ? "Building…" : "Build route"}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={onSave}
          disabled={!summary}
        >
          Save route
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={onUndo}
          disabled={!waypoints.length}
        >
          Undo
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={onClear}
          disabled={!waypoints.length}
        >
          Clear
        </button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {summary && (
        <div className="route-summary">
          <strong>
            {formatDuration(summary.duration)} · {formatDistance(summary.distance)}
          </strong>
          <span>
            {snapToRoads ? "Snapped to roads" : "Straight-line path"} ·{" "}
            {travelMode}
          </span>
        </div>
      )}

      <div className="saved-section">
        <h3>Saved routes</h3>
        {savedRoutes.length === 0 ? (
          <p className="hint tight">No saved routes yet. Build one and hit Save.</p>
        ) : (
          <ul className="saved-list">
            {savedRoutes.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="saved-item"
                  onClick={() => onLoadSaved(r)}
                >
                  <span className="saved-name">{r.name}</span>
                  <span className="saved-meta">
                    {r.waypoints?.length || 0} stops
                    {r.stats
                      ? ` · ${formatDistance(r.stats.distance)}`
                      : ""}
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn sm danger"
                  onClick={() => onDeleteSaved(r.id)}
                  aria-label={`Delete ${r.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
