import { useEffect, useId, useRef, useState } from "react";
import { searchPlaces, formatNearDistance } from "../api/geocode";
import MdTextField from "./MdTextField";

const LOCATION_QUERY = /^(your|my|current)\s+loc/i;

function currentPlace(loc) {
  return {
    id: "current-location",
    name: "Your location",
    display_name: "Use your current GPS position",
    lat: loc.lat,
    lng: loc.lng,
    isCurrentLocation: true,
    type: "current",
  };
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((item) => {
    const key = item.isCurrentLocation
      ? "current-location"
      : String(item.id ?? `${item.lat},${item.lng}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function labelForPlace(place) {
  if (!place) return "";
  return place.isCurrentLocation ? "Your location" : place.name || "";
}

/**
 * @param {object} props
 * @param {boolean} [props.allowCurrentLocation] Only for directions start — never on landing search.
 * @param {array} [props.recentPlaces] Shown when the field is focused/empty (landing search).
 * @param {{lat:number,lng:number}|null} [props.near] Sort remote results nearest-first.
 */
export default function SuggestInput({
  value,
  onChange,
  onSelect,
  placeholder,
  label = "Search",
  id,
  disabled = false,
  currentLocation = null,
  allowCurrentLocation = false,
  recentPlaces = [],
  near = null,
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);
  /** When set, value matches a chosen place — do not keep searching. */
  const committedRef = useRef(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function emptySuggestions() {
    const items = [];
    if (allowCurrentLocation && currentLocation) {
      items.push(currentPlace(currentLocation));
    }
    if (recentPlaces?.length) {
      recentPlaces.forEach((p) => {
        if (p?.isCurrentLocation) return;
        items.push({
          ...p,
          id: String(p.id),
          isRecent: true,
        });
      });
    }
    return dedupe(items);
  }

  function choosePlace(place) {
    committedRef.current = labelForPlace(place);
    requestSeq.current += 1;
    clearTimeout(debounceRef.current);
    setLoading(false);
    setOpen(false);
    setSuggestions([]);
    onSelect(place);
  }

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = value.trim();

    // Value still matches the place the user picked — stop spinner / search.
    if (
      committedRef.current != null &&
      q.toLowerCase() === committedRef.current.toLowerCase()
    ) {
      setLoading(false);
      setSuggestions([]);
      setOpen(false);
      return undefined;
    }

    // User edited the field after a selection — allow search again.
    if (committedRef.current != null) {
      committedRef.current = null;
    }

    // Don't re-query when the field already shows the selected "Your location".
    if (allowCurrentLocation && q.toLowerCase() === "your location") {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return undefined;
    }

    if (q.length < 2) {
      const items = emptySuggestions();
      setSuggestions(items);
      setLoading(false);
      return undefined;
    }

    const seq = ++requestSeq.current;
    debounceRef.current = setTimeout(async () => {
      if (seq !== requestSeq.current) return;
      setLoading(true);
      try {
        const results = await searchPlaces(q, {
          near: near || currentLocation,
          limit: 8,
        });
        if (seq !== requestSeq.current) return;
        const merged = [];
        if (
          allowCurrentLocation &&
          currentLocation &&
          LOCATION_QUERY.test(q)
        ) {
          merged.push(currentPlace(currentLocation));
        }
        merged.push(...results);
        const unique = dedupe(merged);
        setSuggestions(unique);
        setOpen(unique.length > 0);
      } catch {
        if (seq !== requestSeq.current) return;
        setSuggestions([]);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 280);

    return () => {
      clearTimeout(debounceRef.current);
      // Drop stale in-flight work and clear spinner until the next search starts.
      requestSeq.current += 1;
      setLoading(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currentLocation, allowCurrentLocation, recentPlaces, near]);

  return (
    <div className="suggest-wrap" ref={wrapRef}>
      <MdTextField
        id={id}
        label={label}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(v) => {
          if (
            committedRef.current != null &&
            v.trim().toLowerCase() !== committedRef.current.toLowerCase()
          ) {
            committedRef.current = null;
          }
          onChange(v);
        }}
        onFocus={() => {
          const q = value.trim();
          if (
            committedRef.current != null &&
            q.toLowerCase() === committedRef.current.toLowerCase()
          ) {
            setOpen(false);
            return;
          }
          if (q.toLowerCase() === "your location") {
            setOpen(false);
            return;
          }
          if (q.length < 2) {
            const items = emptySuggestions();
            setSuggestions(items);
            setOpen(items.length > 0);
          } else if (suggestions.length > 0) {
            setOpen(true);
          }
        }}
      />
      {loading && (
        <md-circular-progress
          class="suggest-spinner"
          indeterminate
          aria-label="Searching"
        />
      )}
      {open && suggestions.length > 0 && (
        <md-list class="suggestions" id={listId} role="listbox">
          {suggestions.map((s) => (
            <md-list-item
              key={s.isCurrentLocation ? "current-location" : String(s.id)}
              type="button"
              role="option"
              class={s.isCurrentLocation ? "is-current" : ""}
              onClick={() => choosePlace(s)}
            >
              {s.isCurrentLocation ? (
                <md-icon slot="start">my_location</md-icon>
              ) : s.isRecent ? (
                <md-icon slot="start">history</md-icon>
              ) : (
                <md-icon slot="start">place</md-icon>
              )}
              <div slot="headline">{s.name}</div>
              <div slot="supporting-text">
                {s.isCurrentLocation
                  ? s.display_name
                  : [
                      s.distanceMeters != null
                        ? formatNearDistance(s.distanceMeters)
                        : null,
                      s.display_name,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </div>
            </md-list-item>
          ))}
        </md-list>
      )}
    </div>
  );
}
