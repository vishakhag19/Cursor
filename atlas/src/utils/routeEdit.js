/** Compare an edited (or preview) duration against the suggested baseline. */
export function comparisonVsSuggested(currentDuration, baselineDuration) {
  if (currentDuration == null || baselineDuration == null) return null;
  const diffMin = Math.round((currentDuration - baselineDuration) / 60);
  if (diffMin === 0) {
    return { label: "Same as suggested", tone: "neutral", diffMin: 0 };
  }
  if (diffMin > 0) {
    return {
      label: `+${diffMin} min`,
      tone: "worse",
      diffMin,
    };
  }
  return {
    label: `${diffMin} min`,
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
