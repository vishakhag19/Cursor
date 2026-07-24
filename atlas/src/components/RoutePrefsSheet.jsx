import { ENGINE_TYPES, ROUTE_OPTION_FIELDS } from "../utils/routePreferences";
import { modeLabel, ROAD_RULE_MODES } from "../utils/roadRules";
import MdSwitch from "./MdSwitch";

/**
 * Route preferences sheet — toggles apply instantly.
 * Road rules live inline here (no separate panel).
 */
export default function RoutePrefsSheet({
  open,
  prefs,
  onChange,
  onClose,
  roadRules = [],
  onAddRoadRule = null,
  onRemoveRoadRule = null,
  onSetRoadRuleMode = null,
}) {
  if (!open) return null;

  function setPref(patch) {
    onChange?.({ ...prefs, ...patch });
  }

  return (
    <>
      <button
        type="button"
        className="route-sheet-backdrop"
        aria-label="Dismiss route options"
        onClick={onClose}
      />
      <div
        className="route-sheet route-prefs-sheet"
        role="dialog"
        aria-label="Route options"
      >
        <div className="route-sheet-header">
          <div className="route-sheet-heading">
            <div className="md-typescale-title-small">Route options</div>
          </div>
          <md-icon-button type="button" aria-label="Close" onClick={onClose}>
            <md-icon>close</md-icon>
          </md-icon-button>
        </div>

        <div className="route-sheet-body">
          {ROUTE_OPTION_FIELDS.map((f) => (
            <label key={f.id} className="route-pref-row">
              <span className="route-pref-icon" aria-hidden>
                <md-icon>{f.icon}</md-icon>
              </span>
              <span className="route-pref-copy">
                <span className="md-typescale-body-large">{f.label}</span>
                {f.id === "preferFuelEfficient" ? (
                  <span className="md-typescale-body-small route-sheet-sub">
                    {f.hint}
                  </span>
                ) : null}
              </span>
              <MdSwitch
                selected={Boolean(prefs?.[f.id])}
                aria-label={f.label}
                onChange={(on) => setPref({ [f.id]: on })}
              />
            </label>
          ))}

          <div className="route-pref-row route-pref-row-static">
            <span className="route-pref-icon" aria-hidden>
              <md-icon>local_gas_station</md-icon>
            </span>
            <span className="route-pref-copy">
              <span className="md-typescale-body-large">Engine type</span>
              <span className="md-typescale-body-small route-sheet-sub">
                Used for fuel-efficient routing
              </span>
            </span>
            <select
              className="route-pref-select"
              aria-label="Engine type"
              value={prefs?.engineType || "gas"}
              onChange={(e) => setPref({ engineType: e.target.value })}
            >
              {ENGINE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="route-pref-section-label md-typescale-title-small">
            In your vehicle
          </div>

          <label className="route-pref-row">
            <span className="route-pref-icon" aria-hidden>
              <md-icon>sell</md-icon>
            </span>
            <span className="route-pref-copy">
              <span className="md-typescale-body-large">
                See toll pass prices
              </span>
              <span className="md-typescale-body-small route-sheet-sub">
                Show estimated pass cost on route cards
              </span>
            </span>
            <MdSwitch
              selected={Boolean(prefs?.showTollPassPrices)}
              aria-label="See toll pass prices"
              onChange={(on) => setPref({ showTollPassPrices: on })}
            />
          </label>

          <section className="route-pref-section" aria-label="Your road rules">
            <div className="route-pref-section-head">
              <div className="route-pref-section-copy">
                <h3 className="route-pref-section-label md-typescale-title-small">
                  Your road rules
                </h3>
                <p className="md-typescale-body-small route-sheet-sub">
                  Prefer, avoid, or never use named roads when routing
                </p>
              </div>
              {onAddRoadRule ? (
                <md-icon-button
                  type="button"
                  class="route-pref-section-add"
                  aria-label="Add road rule"
                  onClick={onAddRoadRule}
                >
                  <md-icon>add</md-icon>
                </md-icon-button>
              ) : null}
            </div>

            {roadRules.length === 0 ? (
              <p className="hint tight md-typescale-body-medium route-pref-section-empty">
                Tap + then tap a road on the map, or long-press a road and choose
                Prefer, Avoid, or Never use.
              </p>
            ) : (
              <md-list class="road-rules-list">
                {roadRules.map((r) => (
                  <md-list-item key={r.id}>
                    <div slot="headline">{r.name}</div>
                    <div slot="supporting-text">{modeLabel(r.mode)}</div>
                    <div slot="end" className="road-rules-actions">
                      <select
                        className="road-rules-select"
                        aria-label={`Rule for ${r.name}`}
                        value={r.mode}
                        onChange={(e) =>
                          onSetRoadRuleMode?.(r.id, e.target.value)
                        }
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
                        onClick={() => onRemoveRoadRule?.(r.id)}
                      >
                        <md-icon>delete</md-icon>
                      </md-icon-button>
                    </div>
                  </md-list-item>
                ))}
              </md-list>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
