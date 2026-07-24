/**
 * Session route preferences (Feature 2).
 *
 * ASSUMPTION: In-memory only for this prototype — no localStorage.
 * Ranking weights below are design-judgment guesses; flag for review.
 */

export const DEFAULT_ROUTE_PREFS = {
  scenic: false,
  fewestTurns: false,
  preferMajorRoads: false,
  avoidHighways: false,
  avoidTolls: false,
  betterRoadQuality: false,
};

/** Human labels for the prefs sheet (copy is a design guess — review). */
export const ROUTE_PREF_FIELDS = [
  {
    id: "scenic",
    label: "Scenic routes",
    hint: "Favor quieter corridors over freeways",
    icon: "park",
  },
  {
    id: "fewestTurns",
    label: "Fewest turns",
    hint: "Simpler paths with fewer maneuvers",
    icon: "straight",
  },
  {
    id: "preferMajorRoads",
    label: "Prefer major roads",
    hint: "Bias toward arterials and collectors",
    icon: "add_road",
  },
  {
    id: "avoidHighways",
    label: "Avoid highways",
    hint: "Skip motorways when a surface option exists",
    icon: "no_crash",
  },
  {
    id: "avoidTolls",
    label: "Avoid tolls",
    hint: "Prefer toll-free corridors",
    icon: "money_off",
  },
  {
    id: "betterRoadQuality",
    label: "Better road quality",
    hint: "Deprioritize narrow / unnamed shortcuts",
    icon: "road",
  },
];

/**
 * OSRM exclude flags derived from prefs.
 * ASSUMPTION: public OSRM only supports class excludes (motorway/toll/ferry),
 * not arbitrary OSM ways — per-road rules are handled separately in ranking.
 */
export function excludesFromPrefs(prefs = DEFAULT_ROUTE_PREFS) {
  const out = [];
  if (prefs.avoidHighways) out.push("motorway");
  if (prefs.avoidTolls) out.push("toll");
  return out;
}
