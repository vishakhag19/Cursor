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
 * Search-as-you-type field. Searching is driven by user typing only —
 * programmatic value updates (map pin, selected suggestion) must not
 * leave the spinner running.
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
  const committedRef = useRef(null);
  const typingRef = useRef(false);
  const requestSeq = useRef(0);
  const nearRef = useRef(near);
  const currentLocationRef = useRef(currentLocation);
  const recentPlacesRef = useRef(recentPlaces);
  nearRef.current = near;
  currentLocationRef.current = currentLocation;
  recentPlacesRef.current = recentPlaces;

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function emptySuggestions() {
    const items = [];
    const loc = currentLocationRef.current;
    if (allowCurrentLocation && loc) {
      items.push(currentPlace(loc));
    }
    const recent = recentPlacesRef.current;
    if (recent?.length) {
      recent.forEach((p) => {
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

  function stopSearch() {
    clearTimeout(debounceRef.current);
    requestSeq.current += 1;
    setLoading(false);
  }

  function choosePlace(place) {
    committedRef.current = labelForPlace(place);
    typingRef.current = false;
    stopSearch();
    setOpen(false);
    setSuggestions([]);
    onSelect(place);
  }

  function scheduleSearch(raw) {
    clearTimeout(debounceRef.current);
    const q = raw.trim();

    if (committedRef.current != null) {
      if (q.toLowerCase() === committedRef.current.toLowerCase()) {
        setLoading(false);
        setOpen(false);
        return;
      }
      committedRef.current = null;
    }

    if (allowCurrentLocation && q.toLowerCase() === "your location") {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    if (q.length < 2) {
      const items = emptySuggestions();
      setSuggestions(items);
      setLoading(false);
      return;
    }

    const seq = ++requestSeq.current;
    debounceRef.current = setTimeout(async () => {
      if (seq !== requestSeq.current) return;
      setLoading(true);
      try {
        const loc = currentLocationRef.current;
        const results = await searchPlaces(q, {
          near: nearRef.current || loc,
          limit: 8,
        });
        if (seq !== requestSeq.current) return;
        if (committedRef.current) {
          setLoading(false);
          return;
        }
        const merged = [];
        if (allowCurrentLocation && loc && LOCATION_QUERY.test(q)) {
          merged.push(currentPlace(loc));
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
  }

  // Programmatic value updates (map pin / parent setStopPlace): stop spinner.
  // Typed updates set typingRef so we don't cancel the search we just scheduled.
  useEffect(() => {
    if (typingRef.current) {
      typingRef.current = false;
      return;
    }
    const q = (value || "").trim();
    if (q.toLowerCase() === "your location") {
      committedRef.current = "Your location";
    } else if (q.length >= 2) {
      // Treat externally filled destinations as committed selections.
      committedRef.current = q;
    } else {
      committedRef.current = null;
    }
    stopSearch();
    setOpen(false);
    setSuggestions([]);
  }, [value]);

  useEffect(
    () => () => {
      clearTimeout(debounceRef.current);
      requestSeq.current += 1;
    },
    [],
  );

  return (
    <div className="suggest-wrap" ref={wrapRef}>
      <MdTextField
        id={id}
        label={label}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(v) => {
          typingRef.current = true;
          committedRef.current = null;
          onChange(v);
          scheduleSearch(v);
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
