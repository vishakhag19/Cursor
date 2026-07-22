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

export function seedViasFromStops(stops) {
  if (!stops || stops.length <= 2) return [];
  return stops.slice(1, -1).filter(Boolean).map((s, i) => ({
    id: s.id || `stop-via-${i}`,
    lat: s.lat,
    lng: s.lng,
    name: s.name || "Stop",
  }));
}
