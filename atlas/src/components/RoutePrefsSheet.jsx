import { useEffect, useRef, useState } from "react";
import { searchRoads } from "../api/geocode";
import { ENGINE_TYPES, ROUTE_OPTION_FIELDS } from "../utils/routePreferences";
import { modeLabel, ROAD_RULE_MODES } from "../utils/roadRules";
import MdSwitch from "./MdSwitch";
import { highlightMatch } from "./PlaceSuggestionList";

const SUGGEST_LIMIT = 5;

function filterRouteRoads(hints, query, limit) {
  const q = query.trim().toLowerCase();
  if (!q || !hints?.length) return [];
  const seen = new Set();
  const out = [];
  for (const name of hints) {
    const trimmed = String(name || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    if (!key.includes(q) && !q.split(/\s+/).every((p) => key.includes(p))) {
      continue;
    }
    seen.add(key);
    out.push({
      id: `route-road-${key}`,
      name: trimmed,
      display_name: "On your route",
      isRouteRoad: true,
      lat: null,
      lng: null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

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
  onAddTypedRoadRule = null,
  onPickRoadOnMap = null,
  onRemoveRoadRule = null,
  onSetRoadRuleMode = null,
  near = null,
  routeRoadHints = [],
}) {
  const [addingRoad, setAddingRoad] = useState(false);
  const [roadName, setRoadName] = useState("");
  const [roadMode, setRoadMode] = useState("avoid");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const nameInputRef = useRef(null);
  const suggestWrapRef = useRef(null);
  const debounceRef = useRef(null);
  const requestSeq = useRef(0);
  const nearRef = useRef(near);
  const hintsRef = useRef(routeRoadHints);
  nearRef.current = near;
  hintsRef.current = routeRoadHints;

  useEffect(() => {
    if (!open) {
      setAddingRoad(false);
      setRoadName("");
      setRoadMode("avoid");
      setSuggestions([]);
      setSuggestOpen(false);
      setSuggestLoading(false);
      clearTimeout(debounceRef.current);
      requestSeq.current += 1;
    }
  }, [open]);

  useEffect(() => {
    if (!addingRoad) return;
    const id = requestAnimationFrame(() => nameInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [addingRoad]);

  useEffect(() => {
    if (!suggestOpen) return undefined;
    function onDocClick(e) {
      if (!suggestWrapRef.current?.contains(e.target)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [suggestOpen]);

  useEffect(
    () => () => {
      clearTimeout(debounceRef.current);
      requestSeq.current += 1;
    },
    [],
  );

  if (!open) return null;

  function setPref(patch) {
    onChange?.({ ...prefs, ...patch });
  }

  function beginAddRoad() {
    setAddingRoad(true);
    setRoadName("");
    setRoadMode("avoid");
    setSuggestions([]);
    setSuggestOpen(false);
  }

  function cancelAddRoad() {
    setAddingRoad(false);
    setRoadName("");
    setRoadMode("avoid");
    setSuggestions([]);
    setSuggestOpen(false);
    clearTimeout(debounceRef.current);
    requestSeq.current += 1;
  }

  async function runRoadSearch(raw) {
    const q = raw.trim();
    const seq = ++requestSeq.current;
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      setSuggestLoading(false);
      return;
    }

    const fromRoute = filterRouteRoads(hintsRef.current, q, SUGGEST_LIMIT);
    setSuggestions(fromRoute);
    setSuggestOpen(true);
    setSuggestLoading(true);

    try {
      const found = await searchRoads(q, {
        near: nearRef.current,
        limit: SUGGEST_LIMIT,
      });
      if (seq !== requestSeq.current) return;
      const seen = new Set(fromRoute.map((r) => r.name.toLowerCase()));
      const merged = [...fromRoute];
      for (const road of found) {
        const key = (road.name || "").toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(road);
        if (merged.length >= SUGGEST_LIMIT) break;
      }
      setSuggestions(merged.slice(0, SUGGEST_LIMIT));
      setSuggestOpen(merged.length > 0);
    } catch {
      if (seq !== requestSeq.current) return;
      setSuggestions(fromRoute);
      setSuggestOpen(fromRoute.length > 0);
    } finally {
      if (seq === requestSeq.current) setSuggestLoading(false);
    }
  }

  function scheduleRoadSearch(raw) {
    clearTimeout(debounceRef.current);
    const q = raw.trim();
    if (q.length < 2) {
      requestSeq.current += 1;
      setSuggestions([]);
      setSuggestOpen(false);
      setSuggestLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runRoadSearch(raw);
    }, 220);
  }

  function chooseRoad(road) {
    const name = (road?.name || "").trim();
    if (!name) return;
    clearTimeout(debounceRef.current);
    requestSeq.current += 1;
    setRoadName(name);
    setSuggestions([]);
    setSuggestOpen(false);
    setSuggestLoading(false);
    nameInputRef.current?.focus();
  }

  function submitTypedRoad(e) {
    e?.preventDefault?.();
    const name = roadName.trim();
    if (!name) {
      nameInputRef.current?.focus();
      return;
    }
    const match = suggestions.find(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    );
    onAddTypedRoadRule?.({
      name,
      mode: roadMode,
      lat: match?.lat ?? null,
      lng: match?.lng ?? null,
    });
    setAddingRoad(false);
    setRoadName("");
    setRoadMode("avoid");
    setSuggestions([]);
    setSuggestOpen(false);
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
              {onAddTypedRoadRule || onPickRoadOnMap ? (
                <md-icon-button
                  type="button"
                  class="route-pref-section-add"
                  aria-label={addingRoad ? "Cancel add road" : "Add road rule"}
                  onClick={() => (addingRoad ? cancelAddRoad() : beginAddRoad())}
                >
                  <md-icon>{addingRoad ? "close" : "add"}</md-icon>
                </md-icon-button>
              ) : null}
            </div>

            {addingRoad ? (
              <form
                className="road-rule-add-form"
                onSubmit={submitTypedRoad}
              >
                <label className="road-rule-add-field">
                  <span className="md-typescale-body-small road-rule-add-label">
                    Road name
                  </span>
                  <div className="road-rule-suggest-wrap" ref={suggestWrapRef}>
                    <input
                      ref={nameInputRef}
                      className="road-rule-add-input"
                      type="text"
                      value={roadName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRoadName(v);
                        scheduleRoadSearch(v);
                      }}
                      onFocus={() => {
                        if (suggestions.length > 0) setSuggestOpen(true);
                        else if (roadName.trim().length >= 2) {
                          scheduleRoadSearch(roadName);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setSuggestOpen(false);
                          return;
                        }
                        if (e.key === "ArrowDown" && suggestions[0]) {
                          e.preventDefault();
                          setSuggestOpen(true);
                        }
                        if (e.key === "Enter" && suggestOpen && suggestions[0]) {
                          e.preventDefault();
                          chooseRoad(suggestions[0]);
                        }
                      }}
                      placeholder="e.g. Michigan St"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Road name"
                      aria-autocomplete="list"
                      aria-expanded={suggestOpen ? "true" : "false"}
                      aria-controls="road-rule-suggest-list"
                    />
                    {suggestLoading ? (
                      <md-circular-progress
                        class="road-rule-suggest-spinner"
                        indeterminate
                        aria-label="Searching roads"
                      />
                    ) : null}
                    {suggestOpen && (suggestions.length > 0 || suggestLoading) ? (
                      <div
                        className="road-rule-suggest-panel"
                        id="road-rule-suggest-list"
                        role="listbox"
                        aria-label="Road suggestions"
                      >
                        {suggestLoading && suggestions.length === 0 ? (
                          <div className="road-rule-suggest-loading md-typescale-body-small">
                            Searching roads…
                          </div>
                        ) : null}
                        <ul className="road-rule-suggest-list">
                          {suggestions.map((s) => {
                            const subtitle = s.isRouteRoad
                              ? "On your route"
                              : s.display_name && s.display_name !== s.name
                                ? s.display_name
                                    .replace(s.name, "")
                                    .replace(/^,\s*/, "")
                                    .split(",")
                                    .slice(0, 2)
                                    .join(",")
                                    .trim()
                                : "";
                            return (
                              <li key={String(s.id)}>
                                <button
                                  type="button"
                                  className="road-rule-suggest-item"
                                  role="option"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => chooseRoad(s)}
                                >
                                  <span
                                    className="road-rule-suggest-icon"
                                    aria-hidden
                                  >
                                    <md-icon>
                                      {s.isRouteRoad ? "route" : "signpost"}
                                    </md-icon>
                                  </span>
                                  <span className="road-rule-suggest-text">
                                    <span className="road-rule-suggest-title">
                                      {highlightMatch(s.name, roadName)}
                                    </span>
                                    {subtitle ? (
                                      <span className="road-rule-suggest-sub">
                                        {subtitle}
                                      </span>
                                    ) : null}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </label>
                <label className="road-rule-add-field">
                  <span className="md-typescale-body-small road-rule-add-label">
                    Rule
                  </span>
                  <select
                    className="road-rules-select road-rule-add-mode"
                    aria-label="Road rule"
                    value={roadMode}
                    onChange={(e) => setRoadMode(e.target.value)}
                  >
                    {ROAD_RULE_MODES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="road-rule-add-actions">
                  <md-filled-button type="submit">Add road</md-filled-button>
                  {onPickRoadOnMap ? (
                    <md-text-button
                      type="button"
                      onClick={() => onPickRoadOnMap()}
                    >
                      Pick on map
                    </md-text-button>
                  ) : null}
                </div>
              </form>
            ) : null}

            {!addingRoad && roadRules.length === 0 ? (
              <p className="hint tight md-typescale-body-medium route-pref-section-empty">
                Tap + to type a road name, pick one on the map, or long-press a
                road and choose Prefer, Avoid, or Never use.
              </p>
            ) : null}

            {roadRules.length > 0 ? (
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
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
