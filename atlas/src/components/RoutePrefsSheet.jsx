import { ROUTE_PREF_FIELDS } from "../utils/routePreferences";

/**
 * Route preferences sheet (Feature 2).
 * Road avoid/prefer/never lives under "Your road rules" (not Saved).
 */
export default function RoutePrefsSheet({
  open,
  prefs,
  onChange,
  onClose,
  onApply,
  onOpenRoadRules = null,
  roadRulesCount = 0,
}) {
  if (!open) return null;

  return (
    <div className="route-sheet" role="dialog" aria-label="Route preferences">
      <div className="route-sheet-header">
        <div>
          <div className="md-typescale-title-small">Route preferences</div>
          <div className="md-typescale-body-small route-sheet-sub">
            Changes re-rank the recommended routes
          </div>
        </div>
        <md-icon-button type="button" aria-label="Close" onClick={onClose}>
          <md-icon>close</md-icon>
        </md-icon-button>
      </div>

      <div className="route-sheet-body">
        {ROUTE_PREF_FIELDS.map((f) => (
          <label key={f.id} className="route-pref-row">
            <span className="route-pref-icon" aria-hidden>
              <md-icon>{f.icon}</md-icon>
            </span>
            <span className="route-pref-copy">
              <span className="md-typescale-body-large">{f.label}</span>
              <span className="md-typescale-body-small route-sheet-sub">
                {f.hint}
              </span>
            </span>
            <input
              type="checkbox"
              className="route-pref-toggle"
              checked={Boolean(prefs?.[f.id])}
              onChange={(e) =>
                onChange?.({ ...prefs, [f.id]: e.target.checked })
              }
              aria-label={f.label}
            />
          </label>
        ))}

        {onOpenRoadRules ? (
          <button
            type="button"
            className="route-pref-row route-pref-link"
            onClick={() => {
              onClose?.();
              onOpenRoadRules();
            }}
          >
            <span className="route-pref-icon" aria-hidden>
              <md-icon>alt_route</md-icon>
            </span>
            <span className="route-pref-copy">
              <span className="md-typescale-body-large">Your road rules</span>
              <span className="md-typescale-body-small route-sheet-sub">
                {roadRulesCount > 0
                  ? `${roadRulesCount} prefer / avoid / never rule${roadRulesCount === 1 ? "" : "s"}`
                  : "Prefer, avoid, or never use named roads"}
              </span>
            </span>
            <md-icon class="route-pref-chevron">chevron_right</md-icon>
          </button>
        ) : null}
      </div>

      <div className="route-sheet-footer">
        <md-filled-button
          type="button"
          onClick={() => {
            onApply?.();
            onClose?.();
          }}
        >
          Apply to routes
        </md-filled-button>
      </div>
    </div>
  );
}
