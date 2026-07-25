import { formatDistance, formatDuration } from "../utils/format";

/**
 * Lets the user pick among Fastest / Shortest / Alternative routes.
 * Routes are never auto-switched — selection is always explicit.
 */
export default function RouteOptionsList({
  options = [],
  selectedId,
  onSelect,
  locked = false,
  onToggleLock,
}) {
  if (!options.length) return null;

  return (
    <div className="route-options">
      <div className="route-options-header">
        <h3 className="md-typescale-title-small">Route options</h3>
        {onToggleLock && (
          <md-assist-chip
            label={locked ? "Route locked" : "Lock route"}
            selected={locked || undefined}
            onClick={onToggleLock}
            title="Prevent automatic changes to this route"
          >
            <md-icon slot="icon">{locked ? "lock" : "lock_open"}</md-icon>
          </md-assist-chip>
        )}
      </div>
      <p className="hint tight md-typescale-body-small">
        Pick the route you want. Maps will not switch it mid-trip unless you
        choose another option.
      </p>
      <div className="route-option-cards">
        {options.map((opt) => {
          const active = opt.id === selectedId;
          return (
            <button
              key={opt.id}
              type="button"
              className={`route-option-card ${active ? "is-active" : ""}`}
              onClick={() => onSelect(opt)}
            >
              <div className="route-option-top">
                <strong className="md-typescale-title-small">{opt.label}</strong>
                {active && (
                  <md-icon class="route-check">check_circle</md-icon>
                )}
              </div>
              <div className="md-typescale-body-medium">
                {formatDuration(opt.duration)} · {formatDistance(opt.distance)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
