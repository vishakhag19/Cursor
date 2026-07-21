import { useEffect, useId, useRef, useState } from "react";
import { searchPlaces, formatNearDistance } from "../api/geocode";
import MdTextField from "./MdTextField";

const LOCATION_QUERY = /^(your|my|current)\s+loc/i;

function currentPlace(loc) {
  if (loc?.lat != null && loc?.lng != null) {
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
  return {
    id: "current-location",
    name: "Your location",
    display_name: "Locating… tap to retry",
    lat: null,
    lng: null,
    isCurrentLocation: true,
    pending: true,
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
 * Place picker: text field + inline list below (not a floating dropdown).
 * When allowCurrentLocation is on, "Your location" appears at the top on focus.
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
  onRequestLocation = null,
  inlineList = true,
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

  // Keep "Your location" coords fresh if GPS arrives while the list is open.
  useEffect(() => {
    if (!open || !allowCurrentLocation) return;
    setSuggestions((prev) => {
      if (!prev.some((s) => s.isCurrentLocation)) return prev;
      const rest = prev.filter((s) => !s.isCurrentLocation);
      return dedupe([currentPlace(currentLocation), ...rest]);
    });
  }, [currentLocation, open, allowCurrentLocation]);

  function emptySuggestions() {
    const items = [];
    if (allowCurrentLocation) {
      items.push(currentPlace(currentLocationRef.current));
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

  function showDefaultList() {
    const items = emptySuggestions();
    setSuggestions(items);
    setOpen(items.length > 0);
    setLoading(false);
  }

  function stopSearch() {
    clearTimeout(debounceRef.current);
    requestSeq.current += 1;
    setLoading(false);
  }

  async function choosePlace(place) {
    if (place?.isCurrentLocation && (place.pending || place.lat == null)) {
      try {
        const loc = onRequestLocation
          ? await onRequestLocation()
          : currentLocationRef.current;
        if (!loc?.lat) return;
        place = currentPlace(loc);
      } catch {
        return;
      }
    }
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
      showDefaultList();
      return;
    }

    if (q.length < 2) {
      showDefaultList();
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
        if (allowCurrentLocation) {
          merged.push(currentPlace(loc));
        } else if (loc && LOCATION_QUERY.test(q)) {
          merged.push(currentPlace(loc));
        }
        merged.push(...results);
        const unique = dedupe(merged);
        setSuggestions(unique);
        setOpen(unique.length > 0);
      } catch {
        if (seq !== requestSeq.current) return;
        // Fall back to Your location / recent so the list never goes blank.
        showDefaultList();
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 280);
  }

  useEffect(() => {
    if (typingRef.current) {
      typingRef.current = false;
      return;
    }
    const q = (value || "").trim();
    if (q.toLowerCase() === "your location") {
      committedRef.current = "Your location";
    } else if (q.length >= 2) {
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
    <div
      className={`suggest-wrap ${inlineList ? "is-inline-list" : ""} ${open ? "is-open" : ""}`}
      ref={wrapRef}
    >
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
          // Always show defaults (Your location + recent) when focusing the field.
          showDefaultList();
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
        <md-list
          class={`suggestions place-list ${inlineList ? "is-inline" : ""}`}
          id={listId}
          role="listbox"
        >
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
