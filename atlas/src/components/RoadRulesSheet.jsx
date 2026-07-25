import { modeLabel, ROAD_RULE_MODES } from "../utils/roadRules";

/**
 * "Your Road Rules" list (Feature 4).
 * Mobile: full-screen modal. Desktop: floating panel.
 */
export default function RoadRulesSheet({
  open,
  rules = [],
  onClose,
  onRemove,
  onSetMode,
  onAdd = null,
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="route-sheet-backdrop"
        aria-label="Dismiss road rules"
        onClick={onClose}
      />
      <div className="route-sheet" role="dialog" aria-label="Your road rules">
        <div className="route-sheet-header">
          <div className="route-sheet-heading">
            <div className="md-typescale-title-small">Your road rules</div>
            <div className="md-typescale-body-small route-sheet-sub">
              Prefer, avoid, or never use a named road when routing
            </div>
          </div>
          <div className="route-sheet-header-actions">
            {onAdd ? (
              <md-icon-button
                type="button"
                aria-label="Add road rule"
                onClick={onAdd}
              >
                <md-icon>add</md-icon>
              </md-icon-button>
            ) : null}
            <md-icon-button type="button" aria-label="Close" onClick={onClose}>
              <md-icon>close</md-icon>
            </md-icon-button>
          </div>
        </div>

        <div className="route-sheet-body">
          {rules.length === 0 ? (
            <p className="hint tight md-typescale-body-medium">
              Tap + then tap a road on the map, and choose Prefer, Avoid, or
              Never use.
            </p>
          ) : (
            <md-list class="road-rules-list">
              {rules.map((r) => (
                <md-list-item key={r.id}>
                  <div slot="headline">{r.name}</div>
                  <div slot="supporting-text">{modeLabel(r.mode)}</div>
                  <div slot="end" className="road-rules-actions">
                    <select
                      className="road-rules-select"
                      aria-label={`Rule for ${r.name}`}
                      value={r.mode}
                      onChange={(e) => onSetMode?.(r.id, e.target.value)}
                    >
                      {ROAD_RULE_MODES.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <md-icon-button
                      type="button"
                      aria-label={`Remove ${r.name}`}
                      onClick={() => onRemove?.(r.id)}
                    >
                      <md-icon>delete</md-icon>
                    </md-icon-button>
                  </div>
                </md-list-item>
              ))}
            </md-list>
          )}
        </div>
      </div>
    </>
  );
}
