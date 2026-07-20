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

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = value.trim();

    // Don't re-query when the field already shows the selected "Your location".
    if (allowCurrentLocation && q.toLowerCase() === "your location") {
      setSuggestions([]);
      setOpen(false);
      return undefined;
    }

    if (q.length < 2) {
      const items = emptySuggestions();
      setSuggestions(items);
      // Keep closed until focus — focus handler opens.
      return undefined;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchPlaces(q, {
          near: near || currentLocation,
          limit: 8,
        });
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
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(debounceRef.current);
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
        onChange={onChange}
        onFocus={() => {
          const q = value.trim();
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
              onClick={() => {
                onSelect(s);
                setOpen(false);
                setSuggestions([]);
              }}
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
