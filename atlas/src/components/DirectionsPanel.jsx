import SuggestInput from "./SuggestInput";
import RouteOptionsList from "./RouteOptionsList";
import { formatDistance, formatDuration } from "../utils/format";

export default function DirectionsPanel({
  fromText,
  toText,
  onFromText,
  onToText,
  onFromSelect,
  onToSelect,
  onSwap,
  onSubmit,
  onClear,
  onUseCurrentFrom,
  onUseCurrentTo,
  currentLocation,
  geoStatus,
  prefer,
  onPrefer,
  routeOptions,
  selectedRouteId,
  onSelectRoute,
  routeLocked,
  onToggleLock,
  summary,
  loading,
  error,
}) {
  const hasLocation = Boolean(currentLocation);

  return (
    <section className="mode-panel">
      <form
        className="directions-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        autoComplete="off"
      >
        <div className="stop-row">
          <span className="stop-dot start" aria-hidden />
          <SuggestInput
            id="dir-from"
            label="Starting point"
            value={fromText}
            onChange={onFromText}
            onSelect={onFromSelect}
            placeholder="Address or Your location"
            currentLocation={currentLocation}
          />
        </div>
        <div className="stop-row">
          <span className="stop-dot end" aria-hidden />
          <SuggestInput
            id="dir-to"
            label="Destination"
            value={toText}
            onChange={onToText}
            onSelect={onToSelect}
            placeholder="Where to?"
            currentLocation={currentLocation}
          />
        </div>

        <md-chip-set class="loc-chips" role="group" aria-label="Optimize for">
          <md-filter-chip
            label="Prefer fastest"
            selected={prefer === "time" || undefined}
            onClick={() => onPrefer("time")}
          >
            <md-icon slot="icon">speed</md-icon>
          </md-filter-chip>
          <md-filter-chip
            label="Prefer shortest"
            selected={prefer === "distance" || undefined}
            onClick={() => onPrefer("distance")}
          >
            <md-icon slot="icon">straighten</md-icon>
          </md-filter-chip>
        </md-chip-set>

        <md-chip-set class="loc-chips">
          <md-assist-chip
            label="Start from my location"
            disabled={!hasLocation && geoStatus !== "locating"}
            onClick={onUseCurrentFrom}
          >
            <md-icon slot="icon">my_location</md-icon>
          </md-assist-chip>
          <md-assist-chip
            label="End at my location"
            disabled={!hasLocation}
            onClick={onUseCurrentTo}
          >
            <md-icon slot="icon">near_me</md-icon>
          </md-assist-chip>
        </md-chip-set>

        <div className="btn-row">
          <md-filled-button type="submit" disabled={loading || undefined}>
            {loading ? "Routing…" : "Get directions"}
          </md-filled-button>
          <md-icon-button
            type="button"
            onClick={onSwap}
            aria-label="Swap start and destination"
            title="Swap"
          >
            <md-icon>swap_vert</md-icon>
          </md-icon-button>
          <md-text-button type="button" onClick={onClear}>
            Clear
          </md-text-button>
        </div>
      </form>

      {geoStatus === "denied" && (
        <p className="hint md-typescale-body-small">
          Location access is blocked. Allow it in your browser to use “Your
          location”.
        </p>
      )}

      {error && (
        <p className="error-msg md-typescale-body-medium" role="alert">
          {error}
        </p>
      )}

      <RouteOptionsList
        options={routeOptions}
        selectedId={selectedRouteId}
        onSelect={onSelectRoute}
        locked={routeLocked}
        onToggleLock={onToggleLock}
      />

      {summary && !routeOptions.length && (
        <div className="route-summary m3-card tonal">
          <strong className="md-typescale-title-medium">
            {formatDuration(summary.duration)} ·{" "}
            {formatDistance(summary.distance)}
          </strong>
          <span className="md-typescale-body-small">
            Driving route via OpenStreetMap roads
          </span>
        </div>
      )}

      {!summary && !error && !routeOptions.length && (
        <p className="hint md-typescale-body-medium">
          Enter a start and destination. You’ll get Fastest / Shortest options
          and can lock the one you choose.
        </p>
      )}
    </section>
  );
}
