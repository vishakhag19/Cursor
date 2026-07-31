/**
 * Enrich OSRM routes with mock traffic, structural metrics, and ranked reasons
 * (Features 1, 2, 7).
 *
 * ASSUMPTION — traffic: no live traffic API in this stack. We synthesize a
 * light/moderate/heavy level from route shape + duration so cards look
 * differentiated. Document as mock in design rationale.
 *
 * ASSUMPTION — road type: inferred from OSRM step names / maneuver density,
 * not OSM highway tags (OSRM public JSON doesn't always expose class).
 */

import { DEFAULT_ROUTE_PREFS } from "./routePreferences";
import { roadNamesMatch } from "./routeAssist";

const TRAFFIC = {
  light: { id: "light", label: "Light traffic", color: "#34A853", icon: "speed" },
  moderate: {
    id: "moderate",
    label: "Moderate traffic",
    color: "#FBBC04",
    icon: "traffic",
  },
  heavy: { id: "heavy", label: "Heavy traffic", color: "#EA4335", icon: "warning" },
};

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) {
    h = (h * 31 + String(s).charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Count turn-like maneuvers (excludes depart/arrive/continue). */
export function countTurns(steps = []) {
  let n = 0;
  for (const s of steps) {
    const t = s.type || "";
    if (
      t === "turn" ||
      t === "fork" ||
      t === "end of road" ||
      t === "roundabout" ||
      t === "rotary" ||
      t === "off ramp" ||
      t === "on ramp"
    ) {
      n += 1;
    }
  }
  return n;
}

/**
 * Rough highway share: steps whose name looks like a freeway / numbered route
 * or whose instruction mentions ramp/merge.
 * ASSUMPTION: heuristic only — review copy if it misfires on local roads.
 */
export function estimateHighwayShare(steps = []) {
  if (!steps.length) return 0;
  let hwy = 0;
  let total = 0;
  for (const s of steps) {
    const d = s.distance || 0;
    total += d;
    const name = `${s.name || ""} ${s.instruction || ""}`.toLowerCase();
    const looksHwy =
      /\b(i-\d+|interstate|freeway|motorway|hwy|highway|us-\d+|route\s+\d+)\b/.test(
        name,
      ) ||
      s.type === "on ramp" ||
      s.type === "off ramp" ||
      s.type === "merge";
    if (looksHwy) hwy += d;
  }
  return total > 0 ? hwy / total : 0;
}

/** Share of distance on named (vs unnamed "-") roads — proxy for road quality. */
export function estimateNamedRoadShare(steps = []) {
  if (!steps.length) return 0.5;
  let named = 0;
  let total = 0;
  for (const s of steps) {
    const d = s.distance || 0;
    total += d;
    const n = (s.name || "").trim();
    if (n && n !== "-") named += d;
  }
  return total > 0 ? named / total : 0.5;
}

/**
 * Soft scenic score (0–1): keyword corridors + named surface roads.
 * ASSUMPTION: no scenic/OSM tourism tags from public OSRM — name heuristics only.
 */
export function estimateScenicShare(steps = []) {
  if (!steps.length) return 0;
  let scenicDist = 0;
  let total = 0;
  const scenicRe =
    /\b(scenic|parkway|coast|ocean|lake|river|mountain|canyon|vista|overlook|byway|park|forest|beach|shore|ridge|valley|falls|bluff|harbor|bay|cliff|waterfall|preserve|trail)\b/i;
  for (const s of steps) {
    const d = s.distance || 0;
    total += d;
    const blob = `${s.name || ""} ${s.instruction || ""}`;
    if (scenicRe.test(blob)) scenicDist += d;
  }
  const keywordShare = total > 0 ? scenicDist / total : 0;
  const hwy = estimateHighwayShare(steps);
  const named = estimateNamedRoadShare(steps);
  // Scenic picks usually leave freeways for named surface corridors.
  return Math.min(1, keywordShare * 0.75 + (1 - hwy) * named * 0.35);
}

function pickTraffic(route) {
  // Deterministic mock: longer + more turny corridors skew heavier.
  const turns = countTurns(route.steps);
  const score =
    (route.duration || 0) / 60 +
    turns * 0.4 +
    (hashStr(route.id) % 7) * 0.35;
  if (score < 18) return TRAFFIC.light;
  if (score < 32) return TRAFFIC.moderate;
  return TRAFFIC.heavy;
}

function routeUsesRoad(route, roadName) {
  if (!roadName) return false;
  for (const s of route.steps || []) {
    if (roadNamesMatch(s.name, roadName)) return true;
  }
  return roadNamesMatch(route.label || "", roadName);
}

/**
 * Preference + road-rule score. Lower is better (like a cost).
 * Wired so avoidHighways, fewestTurns, scenic, and good-road quality
 * actually change order — not cosmetic.
 */
export function scoreRoute(route, prefs = DEFAULT_ROUTE_PREFS, roadRules = []) {
  const turns = route.metrics?.turns ?? countTurns(route.steps);
  const hwy = route.metrics?.highwayShare ?? estimateHighwayShare(route.steps);
  const named =
    route.metrics?.namedShare ?? estimateNamedRoadShare(route.steps);
  const scenic =
    route.metrics?.scenicShare ?? estimateScenicShare(route.steps);
  const traffic = route.traffic?.id || "moderate";

  // Base: shortest distance wins by default; duration is only a light tie-break.
  // (Previously duration-led, so the selected card often wasn’t the smallest.)
  let cost = (route.distance || 0) + (route.duration || 0) / 20;

  // Soft avoid bias (public OSRM can't hard-exclude). Strong enough that a
  // longer surface / toll-free / land route still ranks above a shorter
  // highway/toll/ferry option when the toggle is on.
  if (prefs.avoidHighways) cost += hwy * 4200;
  if (prefs.avoidTolls && route.metrics?.mayHaveTolls) cost += 2800;
  if (prefs.avoidFerries && route.metrics?.mayHaveFerry) cost += 5000;

  // Soft prefer bias — toggles in Route options must change rank order.
  if (prefs.fewestTurns) cost += turns * 45;
  if (prefs.preferRoadQuality) cost += (1 - named) * 800;
  if (prefs.preferScenic) {
    cost += (1 - scenic) * 1100;
    cost += hwy * 400;
  }

  if (prefs.preferFuelEfficient) {
    // Soft eco bias: prefer less highway for hybrid/EV; diesel ok on hwy.
    const engine = prefs.engineType || "gas";
    if (engine === "electric" || engine === "hybrid") {
      cost += hwy * 350;
      cost += traffic === "heavy" ? 80 : 0;
    } else if (engine === "diesel") {
      cost += (1 - hwy) * 120;
    } else {
      cost += hwy * 180 + turns * 8;
    }
  }

  if (traffic === "heavy") cost += 180;
  if (traffic === "moderate") cost += 60;

  for (const rule of roadRules) {
    const uses = routeUsesRoad(route, rule.name);
    if (!uses) {
      // Prefer routes that actually use a preferred road when alternatives exist.
      if (rule.mode === "prefer") cost += 600;
      continue;
    }
    if (rule.mode === "prefer") cost -= 2800;
    if (rule.mode === "avoid") cost += 4200;
    // Soft hard-exclude: public OSRM can't drop named roads, so bury them.
    if (rule.mode === "never") cost += 60000;
  }

  return cost;
}

function buildReason(route, prefs, rank, fastestId, shortestId, fewestTurnsId) {
  const hwy = route.metrics?.highwayShare ?? 0;
  const turns = route.metrics?.turns ?? 0;
  const traffic = route.traffic;

  // Preference-aware reasons first so toggles feel real.
  if (prefs.avoidHighways && hwy < 0.08 && rank === 0) {
    return "Avoids highways · stays on surface streets";
  }
  if (prefs.fewestTurns && route.id === fewestTurnsId && rank === 0) {
    return "Fewest turns · simpler drive";
  }
  if (prefs.preferScenic && rank === 0) {
    return "More scenic corridors · matches your preference";
  }
  if (prefs.preferRoadQuality && rank === 0) {
    return "Good quality roads · better-maintained corridors";
  }
  if (prefs.preferFuelEfficient && rank === 0) {
    return "Fuel-efficient pick · similar ETA, lower estimated use";
  }
  if (prefs.avoidTolls && rank === 0) {
    return "Toll-free option · matches your preference";
  }
  if (prefs.avoidFerries && rank === 0) {
    return "Avoids ferries · stays on land routes";
  }
  if (rank === 0 && route.badge === "Prefers your road") {
    return "Uses a road you prefer";
  }
  if (rank === 0 && /avoids |skirting /i.test(route.label || "")) {
    return "Follows your road rules";
  }

  if (route.id === fastestId && route.id === shortestId) {
    return "Fastest & shortest right now";
  }
  if (route.id === fastestId) {
    return traffic?.id === "heavy"
      ? "Still the fastest despite heavier traffic"
      : "Fastest right now";
  }
  if (route.id === shortestId) {
    return "Shortest distance";
  }
  if (hwy > 0.45) {
    return "Uses the highway for most of the trip";
  }
  if (turns <= 3) {
    return "Fewer turns · simpler drive";
  }
  if (traffic?.id === "light") {
    return "Light traffic along this corridor";
  }
  if (traffic?.id === "heavy") {
    return "Heavier traffic · consider an alternate";
  }
  // DESIGN GUESS: generic fallback copy — review.
  return route.label?.startsWith("via ")
    ? `Goes ${route.label}`
    : "Balanced time and distance";
}

/**
 * Compare selected vs another option for Feature 7 trade-off line.
 */
export function tradeOffLine(a, b) {
  if (!a || !b || a.id === b.id) return null;
  const dMin = Math.round(((b.duration || 0) - (a.duration || 0)) / 60);
  const hwyA = a.metrics?.highwayShare ?? 0;
  const hwyB = b.metrics?.highwayShare ?? 0;
  const parts = [];
  if (dMin <= -2) parts.push(`${Math.abs(dMin)} min faster`);
  else if (dMin >= 2) parts.push(`${dMin} min slower`);
  else parts.push("Same ETA");

  if (hwyB > hwyA + 0.2) parts.push("but adds a highway");
  else if (hwyA > hwyB + 0.2) parts.push("and skips the highway");

  const turnsA = a.metrics?.turns ?? 0;
  const turnsB = b.metrics?.turns ?? 0;
  if (turnsB + 2 < turnsA) parts.push("with fewer turns");
  if (b.traffic?.id === "light" && a.traffic?.id !== "light") {
    parts.push("lighter traffic");
  }
  return parts.join(", ");
}

/**
 * Enrich + re-rank up to `limit` routes for the recommendations list.
 */
export function enrichAndRankRoutes(
  routes,
  prefs = DEFAULT_ROUTE_PREFS,
  roadRules = [],
  { limit = 5 } = {},
) {
  if (!routes?.length) return [];

  const enriched = routes.map((r) => {
    const turns = countTurns(r.steps);
    const highwayShare = estimateHighwayShare(r.steps);
    const namedShare = estimateNamedRoadShare(r.steps);
    const scenicShare = estimateScenicShare(r.steps);
    const traffic = pickTraffic(r);
    const stepBlob = (r.steps || [])
      .map((s) => `${s.name || ""} ${s.instruction || ""}`)
      .join(" ");
    // ASSUMPTION: tolls rarely named in OSRM steps — also treat heavy
    // highway share as a toll risk when Avoid tolls is on.
    const mayHaveTolls = Boolean(
      /toll/i.test(stepBlob) || (prefs.avoidTolls && highwayShare > 0.35),
    );
    const mayHaveFerry = /ferry|boat/i.test(stepBlob);
    return {
      ...r,
      metrics: {
        turns,
        highwayShare,
        namedShare,
        scenicShare,
        mayHaveTolls,
        mayHaveFerry,
      },
      traffic,
    };
  });

  const neverRules = (roadRules || []).filter((r) => r.mode === "never");
  const withoutNever =
    neverRules.length > 0
      ? enriched.filter(
          (r) => !neverRules.some((rule) => routeUsesRoad(r, rule.name)),
        )
      : enriched;
  // Prefer alternatives that obey Never rules; fall back if every option uses one.
  const pool = withoutNever.length > 0 ? withoutNever : enriched;

  const fastest = [...pool].sort(
    (a, b) => a.duration - b.duration || a.distance - b.distance,
  )[0];
  const shortest = [...pool].sort(
    (a, b) => a.distance - b.distance || a.duration - b.duration,
  )[0];
  const fewest = [...pool].sort(
    (a, b) =>
      (a.metrics.turns - b.metrics.turns) || a.duration - b.duration,
  )[0];

  // Soft “suggest” winners for map time-chip icons (relative to this set).
  const fuelCostOf = (r) =>
    (r.metrics?.highwayShare ?? 0) * 180 + (r.metrics?.turns ?? 0) * 8;
  const bestFuel = [...pool].sort(
    (a, b) => fuelCostOf(a) - fuelCostOf(b) || a.duration - b.duration,
  )[0];
  const bestQuality = [...pool].sort(
    (a, b) =>
      (b.metrics?.namedShare ?? 0) - (a.metrics?.namedShare ?? 0) ||
      a.duration - b.duration,
  )[0];
  const bestFuelCost = bestFuel ? fuelCostOf(bestFuel) : 0;
  const bestNamed = bestQuality?.metrics?.namedShare ?? 0;

  const ranked = [...pool].sort((a, b) => {
    const scoreDiff =
      scoreRoute(a, prefs, roadRules) - scoreRoute(b, prefs, roadRules);
    // Strong prefer/avoid / road-rule gaps still win. Otherwise default to the
    // smallest (shortest-distance) route so #1 matches user expectation.
    if (Math.abs(scoreDiff) >= 400) return scoreDiff;
    return (
      (a.distance || 0) - (b.distance || 0) ||
      (a.duration || 0) - (b.duration || 0) ||
      scoreDiff
    );
  });

  return ranked.slice(0, limit).map((r, i) => {
    const reason = buildReason(
      r,
      prefs,
      i,
      fastest?.id,
      shortest?.id,
      fewest?.id,
    );
    let badge = r.badge || null;
    if (i === 0) {
      badge =
        r.id === shortest?.id
          ? r.id === fastest?.id
            ? "Shortest & fastest"
            : "Shortest"
          : badge || "Recommended";
    } else if (r.id === fastest?.id) badge = "Fastest";
    else if (r.id === shortest?.id) badge = "Shortest";
    else if (prefs.fewestTurns && r.id === fewest?.id) badge = "Fewest turns";
    const suggestFuelEfficient =
      pool.length > 1 &&
      Math.abs(fuelCostOf(r) - bestFuelCost) < 0.5 &&
      fuelCostOf(r) <= bestFuelCost + 0.01;
    const suggestGoodQuality =
      pool.length > 1 &&
      (r.metrics?.namedShare ?? 0) >= bestNamed - 0.02 &&
      bestNamed >= 0.45;
    return {
      ...r,
      rank: i + 1,
      reason,
      badge,
      suggestFuelEfficient,
      suggestGoodQuality,
      // Trade-off vs the #1 recommendation (Feature 7).
      tradeOff:
        i === 0
          ? null
          : tradeOffLine(ranked[0], r),
    };
  });
}
