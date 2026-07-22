/** Compare an edited (or preview) duration against the original suggested route. */
export function comparisonVsSuggested(currentDuration, baselineDuration) {
  if (currentDuration == null || baselineDuration == null) return null;
  const diffMin = Math.round((currentDuration - baselineDuration) / 60);
  if (diffMin === 0) {
    return {
      label: "Same travel time as original",
      shortLabel: "Same time",
      mapLabel: "Travel time: same as original",
      tone: "neutral",
      diffMin: 0,
    };
  }
  if (diffMin > 0) {
    return {
      label: `${diffMin} min longer than original`,
      shortLabel: `+${diffMin} min`,
      mapLabel: `Travel time: ${diffMin} min longer`,
      tone: "worse",
      diffMin,
    };
  }
  const faster = Math.abs(diffMin);
  return {
    label: `${faster} min shorter than original`,
    shortLabel: `−${faster} min`,
    mapLabel: `Travel time: ${faster} min shorter`,
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
