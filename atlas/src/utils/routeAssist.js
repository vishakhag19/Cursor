import { haversineMeters } from "../api/geocode";
import { closestPointOnPolyline } from "../api/routing";

/** Offset a point perpendicular to the route corridor by `meters`. */
export function offsetPerpendicular(point, geometry, meters = 700) {
  if (!point || !geometry?.length) {
    return { lat: point.lat, lng: point.lng };
  }
  const closest = closestPointOnPolyline(point, geometry) || point;
  const seg = closest.segmentIndex ?? 0;
  const a = geometry[Math.max(0, seg)];
  const b = geometry[Math.min(geometry.length - 1, seg + 1)] || a;
  const dLat = b[0] - a[0];
  const dLng = b[1] - a[1];
  const len = Math.hypot(dLat, dLng) || 1;
  // Pick a stable side so repeated avoids don't flip randomly.
  const side = meters >= 0 ? 1 : -1;
  const dist = Math.abs(meters);
  const pLat = (-dLng / len) * side;
  const pLng = (dLat / len) * side;
  const degLat = dist / 111320;
  const degLng =
    dist / (111320 * Math.max(0.2, Math.cos((closest.lat * Math.PI) / 180)));
  return {
    lat: closest.lat + pLat * degLat,
    lng: closest.lng + pLng * degLng,
  };
}

/** Midpoint of a polyline (by vertex index). */
export function geometryMidpoint(geometry) {
  if (!geometry?.length) return null;
  const mid = geometry[Math.floor(geometry.length / 2)];
  return { lat: mid[0], lng: mid[1] };
}

/** Case-insensitive road-name match used by steps / Nominatim. */
export function roadNamesMatch(a, b) {
  if (!a || !b) return false;
  const normalize = (s) =>
    String(s)
      .toLowerCase()
      .replace(/\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|hwy|highway)\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Find step indices whose road name matches `roadName`. */
export function findStepsForRoad(steps, roadName) {
  if (!steps?.length || !roadName) return [];
  return steps
    .map((s, i) => ({ step: s, index: i }))
    .filter(({ step }) => roadNamesMatch(step.name || "", roadName));
}

/**
 * Build a via that pulls the route off a blocked corridor near `focus`.
 * Tries both perpendicular sides and returns the farther offset candidate.
 */
export function buildAvoidVia(focus, geometry, roadName = "road") {
  const base = closestPointOnPolyline(focus, geometry) || focus;
  const left = offsetPerpendicular(base, geometry, 900);
  const right = offsetPerpendicular(base, geometry, -900);
  // Prefer the side farther from the blocked focus (stronger detour).
  const pick =
    haversineMeters(focus, left) >= haversineMeters(focus, right)
      ? left
      : right;
  return {
    lat: pick.lat,
    lng: pick.lng,
    name: roadName ? `Avoid ${roadName}` : "Avoid street",
  };
}

/** Parse a free-text routing request into a structured intent. */
export function parseRouteAssistantIntent(raw) {
  const text = String(raw || "").trim();
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  if (!text) return { type: "empty" };

  if (
    /^(help|what can you do|\?)$/i.test(lower) ||
    lower.includes("what can you")
  ) {
    return { type: "help" };
  }

  if (/\b(undo|go back|revert)\b/.test(lower)) {
    return { type: "undo" };
  }

  if (/\b(save( this)? route|save (my )?route)\b/.test(lower)) {
    return { type: "save" };
  }

  if (
    /\b(traffic|jam|congest|reroute|re-route|another way|alternate|alternative)\b/.test(
      lower,
    )
  ) {
    return { type: "reroute" };
  }

  // "take X instead of Y" / "use X not Y" / "go via X instead of Y"
  const instead = text.match(
    /(?:take|use|go(?:\s+via)?|prefer)\s+(.+?)\s+(?:instead of|rather than|not|not via)\s+(.+?)(?:[.?!]|$)/i,
  );
  if (instead) {
    return {
      type: "prefer_instead",
      prefer: cleanStreetPhrase(instead[1]),
      avoid: cleanStreetPhrase(instead[2]),
    };
  }

  // "take / use / go via X Street"
  const take = text.match(
    /(?:take|use|go via|go on|prefer|route via)\s+(.+?)(?:[.?!]|$)/i,
  );
  if (take && !/\binstead\b/i.test(take[1])) {
    return { type: "prefer", street: cleanStreetPhrase(take[1]) };
  }

  // "avoid / block / don't use X"
  const avoid = text.match(
    /(?:avoid|block|skip|stay off|don'?t use|do not use|never use)\s+(.+?)(?:[.?!]|$)/i,
  );
  if (avoid) {
    return { type: "avoid", street: cleanStreetPhrase(avoid[1]) };
  }

  return { type: "unknown", text };
}

function cleanStreetPhrase(s) {
  return String(s || "")
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/\b(please|thanks|thank you)\b/gi, "")
    .replace(/[?.!,]+$/g, "")
    .trim();
}

/** Future voice layer can speak `spoken`; UI shows `text`. */
export function assistantReply(text, { spoken = null, confirm = false } = {}) {
  return {
    text,
    spoken: spoken || text,
    confirm,
  };
}
