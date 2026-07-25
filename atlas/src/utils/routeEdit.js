import { formatDuration } from "./format";

/**
 * Compare an edited (or preview) duration against the original suggested route.
 * Always surfaces the current travel time, plus how it relates to the original.
 */
export function comparisonVsSuggested(currentDuration, baselineDuration) {
  if (currentDuration == null || baselineDuration == null) return null;

  const diffMin = Math.round((currentDuration - baselineDuration) / 60);
  const currentLabel = formatDuration(currentDuration);
  const originalLabel = formatDuration(baselineDuration);

  if (diffMin === 0) {
    return {
      currentLabel,
      originalLabel,
      // Primary: the actual duration — "Same time" alone is meaningless.
      shortLabel: currentLabel,
      detailLabel: "same as original",
      label: `${currentLabel} · same as original`,
      mapLabel: `${currentLabel} · same as original`,
      tone: "neutral",
      diffMin: 0,
    };
  }

  if (diffMin > 0) {
    return {
      currentLabel,
      originalLabel,
      shortLabel: currentLabel,
      detailLabel: `${originalLabel} + ${diffMin} min`,
      label: `${currentLabel} (${originalLabel} + ${diffMin} min)`,
      mapLabel: `${currentLabel} · was ${originalLabel} (+${diffMin} min)`,
      tone: "worse",
      diffMin,
    };
  }

  const faster = Math.abs(diffMin);
  return {
    currentLabel,
    originalLabel,
    shortLabel: currentLabel,
    detailLabel: `${originalLabel} − ${faster} min`,
    label: `${currentLabel} (${originalLabel} − ${faster} min)`,
    mapLabel: `${currentLabel} · was ${originalLabel} (−${faster} min)`,
    tone: "better",
    diffMin,
  };
}

/** Mid filled stops become reshape vias so edits keep A→stops→B. */
export function seedViasFromStops(stops) {
  const filled = (stops || []).filter(Boolean);
  if (filled.length <= 2) return [];
  return filled.slice(1, -1).map((s, i) => ({
    id: s.id || `stop-via-${i}`,
    lat: s.lat,
    lng: s.lng,
    name: s.name || "Stop",
    fromStop: true,
  }));
}

/**
 * Soft midpoint markers along a polyline so the route looks draggable
 * before the user has created any reshape vias (Google Maps–style cue).
 */
export function sampleRouteMidpoints(geometry, count = 3) {
  if (!geometry?.length || geometry.length < 2 || count < 1) return [];

  const segLens = [];
  let total = 0;
  for (let i = 1; i < geometry.length; i += 1) {
    const a = geometry[i - 1];
    const b = geometry[i];
    const dLat = (b[0] - a[0]) * 111320;
    const dLng =
      (b[1] - a[1]) * 111320 * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
    const len = Math.hypot(dLat, dLng);
    segLens.push(len);
    total += len;
  }
  if (total <= 0) return [];

  const out = [];
  for (let k = 1; k <= count; k += 1) {
    const target = (total * k) / (count + 1);
    let walked = 0;
    for (let i = 0; i < segLens.length; i += 1) {
      const seg = segLens[i];
      if (walked + seg >= target) {
        const t = seg > 0 ? (target - walked) / seg : 0;
        const a = geometry[i];
        const b = geometry[i + 1];
        out.push({
          id: `ghost-mid-${k}`,
          lat: a[0] + (b[0] - a[0]) * t,
          lng: a[1] + (b[1] - a[1]) * t,
        });
        break;
      }
      walked += seg;
    }
  }
  return out;
}
