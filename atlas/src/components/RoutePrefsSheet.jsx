import {
  DRIVING_AVATARS,
  ENGINE_TYPES,
  ROUTE_OPTION_FIELDS,
} from "../utils/routePreferences";
import MdSwitch from "./MdSwitch";

/**
 * Route preferences sheet — Google Maps–style options with instant toggles.
 * Mobile: full-screen modal. Desktop: floating panel beside the map.
 */
export default function RoutePrefsSheet({
  open,
  prefs,
  onChange,
  onClose,
  onOpenRoadRules = null,
  roadRulesCount = 0,
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
            <div className="md-typescale-body-small route-sheet-sub">
              Changes apply as you toggle
            </div>
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
                <span className="md-typescale-body-small route-sheet-sub">
                  {f.hint}
                </span>
              </span>
              <MdSwitch
                selected={Boolean(prefs?.[f.id])}
                aria-label={f.label}
                onChange={(on) => setPref({ [f.id]: on })}
              />
            </label>
          ))}

          <div className="route-pref-section-label md-typescale-title-small">
            In your vehicle
          </div>

          <div className="route-pref-avatar-block">
            <div className="route-pref-row route-pref-row-static">
              <span className="route-pref-icon" aria-hidden>
                <md-icon>directions_car</md-icon>
              </span>
              <span className="route-pref-copy">
                <span className="md-typescale-body-large">Driving avatar</span>
                <span className="md-typescale-body-small route-sheet-sub">
                  Icon shown while you navigate
                </span>
              </span>
            </div>
            <div
              className="route-pref-avatar-row"
              role="radiogroup"
              aria-label="Driving avatar"
            >
              {DRIVING_AVATARS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={
                    prefs?.drivingAvatar === a.id ? "true" : "false"
                  }
                  className={`route-pref-avatar-btn ${prefs?.drivingAvatar === a.id ? "is-selected" : ""}`}
                  onClick={() => setPref({ drivingAvatar: a.id })}
                  title={a.label}
                >
                  <md-icon>{a.icon}</md-icon>
                </button>
              ))}
            </div>
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
      </div>
    </>
  );
}
