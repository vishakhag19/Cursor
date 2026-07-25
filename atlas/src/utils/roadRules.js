/**
 * Per-road rules: prefer / avoid / never (Feature 4).
 * Persisted separately from trip-level "Avoided" chips.
 */

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

export function upsertRoadRule(rules, { name, lat, lng, mode, id: idIn } = {}) {
  if (!name || !mode) return rules || [];
  const id =
    idIn ||
    rules?.find((r) => r.name.toLowerCase() === name.toLowerCase())?.id ||
    `road-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const next = (rules || []).filter(
    (r) => r.name.toLowerCase() !== name.toLowerCase(),
  );
  return [{ id, name, lat, lng, mode, updatedAt: Date.now() }, ...next];
}

export function removeRoadRule(rules, id) {
  return (rules || []).filter((r) => r.id !== id);
}

export function modeLabel(mode) {
  return ROAD_RULE_MODES.find((m) => m.id === mode)?.label || mode;
}
