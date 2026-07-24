import { modeLabel, ROAD_RULE_MODES } from "../utils/roadRules";

/**
 * "Your Road Rules" list (Feature 4).
 * DESIGN GUESS: title wording — review vs "Saved roads" / "Road preferences".
 */
export default function RoadRulesSheet({
  open,
  rules = [],
  onClose,
  onRemove,
  onSetMode,
}) {
  if (!open) return null;

  return (
    <div className="route-sheet" role="dialog" aria-label="Your road rules">
      <div className="route-sheet-header">
        <div>
          <div className="md-typescale-title-small">Your road rules</div>
          <div className="md-typescale-body-small route-sheet-sub">
            Prefer, avoid, or never use a named road
          </div>
        </div>
        <md-icon-button type="button" aria-label="Close" onClick={onClose}>
          <md-icon>close</md-icon>
        </md-icon-button>
      </div>

      <div className="route-sheet-body">
        {rules.length === 0 ? (
          <p className="hint tight md-typescale-body-medium">
            Long-press a road on the map, then choose Prefer, Avoid, or Never
            use.
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
  );
}
