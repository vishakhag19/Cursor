/**
 * Session route preferences — Google Maps–style route options + vehicle.
 *
 * ASSUMPTION: In-memory only for this prototype — no localStorage.
 * Fuel-efficiency ranking is a soft heuristic (no real consumption model).
 */

export const DEFAULT_ROUTE_PREFS = {
  avoidTolls: false,
  avoidHighways: false,
  avoidFerries: false,
  preferScenic: false,
  fewestTurns: false,
  preferRoadQuality: false,
  preferFuelEfficient: false,
  /** Driving avatar for navigation chrome */
  drivingAvatar: "arrow",
  /** Show estimated toll / pass prices on route cards */
  showTollPassPrices: false,
  /** Engine type used when preferFuelEfficient is on */
  engineType: "gas",
};

export const DRIVING_AVATARS = [
  { id: "arrow", label: "Arrow", icon: "navigation" },
  { id: "car", label: "Car", icon: "directions_car" },
  { id: "suv", label: "SUV", icon: "airport_shuttle" },
  { id: "truck", label: "Truck", icon: "local_shipping" },
];

export const ENGINE_TYPES = [
  { id: "gas", label: "Gas" },
  { id: "diesel", label: "Diesel" },
  { id: "hybrid", label: "Hybrid" },
  { id: "electric", label: "Electric" },
];

/** Route option toggles shown in the preferences sheet. */
export const ROUTE_OPTION_FIELDS = [
  {
    id: "avoidTolls",
    label: "Avoid tolls",
    hint: "Prefer toll-free corridors",
    icon: "money_off",
  },
  {
    id: "avoidHighways",
    label: "Avoid highways",
    hint: "Skip motorways when a surface option exists",
    icon: "no_crash",
  },
  {
    id: "avoidFerries",
    label: "Avoid ferries",
    hint: "Stay on land routes when possible",
    icon: "directions_boat",
  },
  {
    id: "preferScenic",
    label: "Scenic roads",
    hint: "Favor parkways and scenic named corridors",
    icon: "landscape",
  },
  {
    id: "fewestTurns",
    label: "Fewest turns",
    hint: "Prefer simpler routes with fewer maneuvers",
    icon: "turn_right",
  },
  {
    id: "preferRoadQuality",
    label: "Good quality roads",
    hint: "Favor better-maintained corridors over rough or unnamed ones",
    icon: "verified",
  },
  {
    id: "preferFuelEfficient",
    label: "Prefer fuel-efficient routes",
    hint: "Favor greener options when arrival time is similar",
    icon: "eco",
  },
];

/**
 * Preferred OSRM exclude flags derived from prefs.
 * Public router.project-osrm.org rejects these with 400 — routing treats
 * them as soft ranking bias and only probes hard excludes when supported.
 */
export function excludesFromPrefs(prefs = DEFAULT_ROUTE_PREFS) {
  const out = [];
  if (prefs.avoidHighways) out.push("motorway");
  if (prefs.avoidTolls) out.push("toll");
  if (prefs.avoidFerries) out.push("ferry");
  return out;
}

/** Travel modes shown like Google Maps directions tabs. */
export const TRAVEL_MODES = [
  {
    id: "driving",
    label: "Drive",
    icon: "directions_car",
    /** OSRM / internal profile key passed to routing */
    profile: "driving",
  },
  {
    id: "two_wheeler",
    label: "Two-wheeler",
    icon: "two_wheeler",
    profile: "driving",
    unsupported: true,
  },
  {
    id: "transit",
    label: "Transit",
    icon: "directions_transit",
    profile: null,
    unsupported: true,
  },
  {
    id: "walking",
    label: "Walk",
    icon: "directions_walk",
    profile: "walking",
    unsupported: true,
  },
  {
    id: "cycling",
    label: "Bicycle",
    icon: "directions_bike",
    profile: "cycling",
    unsupported: true,
  },
  {
    id: "rides",
    label: "Ride",
    icon: "local_taxi",
    profile: "driving",
    unsupported: true,
  },
];

/** Shown once for every non-Drive tab (Drive is the only live mode). */
export const NON_DRIVE_MODE_HINT =
  "This travel mode isn’t available in this prototype yet. Try Drive.";

export function travelModeMeta(id) {
  return TRAVEL_MODES.find((m) => m.id === id) || TRAVEL_MODES[0];
}

/** Map UI mode → OSRM profile mode used by routing.js */
export function routingModeFor(travelMode) {
  const meta = travelModeMeta(travelMode);
  return meta.profile || "driving";
}
