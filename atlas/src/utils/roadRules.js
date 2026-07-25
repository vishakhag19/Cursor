/**
 * Per-road rules: prefer / avoid / never (Feature 4).
 * Persisted separately from trip-level "Avoided" chips.
 * Applied on every Directions fetch via scoreRoute — never as reshape vias.
 */

import { roadNamesMatch } from "./routeAssist";

export const ROAD_RULE_MODES = [
  {
    id: "prefer",
    label: "Prefer this road",
    hint: "Bias routing toward it when relevant",
    icon: "thumb_up",
  },
  {
    id: "avoid",
    label: "Avoid this road",
    hint: "Deprioritize, but allow if no alternative",
    icon: "do_not_disturb_on",
  },
  {
    id: "never",
    label: "Never use this road",
    hint: "Hard exclude from future routing",
    icon: "block",
  },
];

/** Find an existing rule for this road (fuzzy name match). */
export function findRoadRule(rules, name) {
  if (!name) return null;
  return (rules || []).find((r) => roadNamesMatch(r.name, name)) || null;
}

export function upsertRoadRule(rules, { name, lat, lng, mode, id: idIn } = {}) {
  if (!name || !mode) return rules || [];
  const existing = findRoadRule(rules, name);
  const id = idIn || existing?.id || `road-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const next = (rules || []).filter((r) => !roadNamesMatch(r.name, name));
  return [
    {
      id,
      // Keep the first-seen spelling as the canonical label.
      name: existing?.name || name,
      lat: lat ?? existing?.lat ?? null,
      lng: lng ?? existing?.lng ?? null,
      mode,
      updatedAt: Date.now(),
    },
    ...next,
  ];
}

export function removeRoadRule(rules, id) {
  return (rules || []).filter((r) => r.id !== id);
}

export function modeLabel(mode) {
  return ROAD_RULE_MODES.find((m) => m.id === mode)?.label || mode;
}

/**
 * Fill missing lat/lng on road rules from the active route's steps so Prefer /
 * Avoid / Never can seed detours without re-picking the road on the map.
 */
export function enrichRoadRulesFromRoute(rules, route) {
  if (!rules?.length) return rules || [];
  const steps = route?.steps || [];
  if (!steps.length) return rules;
  return rules.map((rule) => {
    if (rule.lat != null && rule.lng != null) return rule;
    const hit = steps.find(
      (s) =>
        s?.lat != null &&
        s?.lng != null &&
        roadNamesMatch(s.name || "", rule.name),
    );
    if (!hit) return rule;
    return { ...rule, lat: hit.lat, lng: hit.lng };
  });
}
