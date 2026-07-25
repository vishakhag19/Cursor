import { formatDistance, formatDuration } from "../utils/format";

/**
 * Lets the user pick among Fastest / Shortest / Alternative routes.
 * Routes are never auto-switched — selection is always explicit.
 *
 * Also reused for the landing Saved routes card (`embedded` hides the
 * “Route options” chrome and optional `onDelete` shows a trash control).
 */
export default function RouteOptionsList({
  options = [],
  selectedId,
  onSelect,
  locked = false,
  onToggleLock,
  onDelete = null,
  embedded = false,
  title = "Route options",
  hint = "Pick the route you want. Maps will not switch it mid-trip unless you choose another option.",
}) {
  if (!options.length) return null;

  return (
    <div className={`route-options${embedded ? " is-embedded" : ""}`}>
      {!embedded && (
        <>
          <div className="route-options-header">
            <h3 className="md-typescale-title-small">{title}</h3>
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
          {hint ? (
            <p className="hint tight md-typescale-body-small">{hint}</p>
          ) : null}
        </>
      )}
      <div className="route-option-cards">
        {options.map((opt) => {
          const active = selectedId != null && opt.id === selectedId;
          return (
            <div
              key={opt.id}
              className={`route-option-row${active ? " is-active" : ""}${
                onDelete ? " has-delete" : ""
              }`}
            >
              <button
                type="button"
                className={`route-option-card${active ? " is-active" : ""}`}
                onClick={() => onSelect(opt)}
              >
                <div className="route-option-top">
                  <strong className="md-typescale-title-small">
                    {opt.label}
                  </strong>
                  {active && !onDelete && (
                    <md-icon class="route-check">check_circle</md-icon>
                  )}
                </div>
                <div className="md-typescale-body-medium">
                  {formatDuration(opt.duration)} · {formatDistance(opt.distance)}
                </div>
              </button>
              {onDelete ? (
                <div className="route-option-actions">
                  <md-icon-button
                    type="button"
                    aria-label={`Delete ${opt.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(opt);
                    }}
                  >
                    <md-icon>delete</md-icon>
                  </md-icon-button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
