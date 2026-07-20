import { useEffect, useId, useRef, useState } from "react";
import { searchPlaces } from "../api/geocode";

const LOCATION_QUERY = /^(your|my|current)?\s*loc/i;

export default function SuggestInput({
  value,
  onChange,
  onSelect,
  placeholder,
  id,
  disabled = false,
  currentLocation = null,
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

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = value.trim();

    const showCurrent =
      currentLocation &&
      (q.length === 0 || LOCATION_QUERY.test(q) || "your location".startsWith(q.toLowerCase()));

    if (q.length < 2) {
      if (showCurrent) {
        setSuggestions([
          {
            id: "current-location",
            name: "Your location",
            display_name: "Use your current GPS position",
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            isCurrentLocation: true,
            type: "current",
          },
        ]);
        setOpen(true);
      } else {
        setSuggestions([]);
        setOpen(false);
      }
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchPlaces(q);
        const merged = [];
        if (
          currentLocation &&
          (LOCATION_QUERY.test(q) || "your location".includes(q.toLowerCase()))
        ) {
          merged.push({
            id: "current-location",
            name: "Your location",
            display_name: "Use your current GPS position",
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            isCurrentLocation: true,
            type: "current",
          });
        }
        merged.push(...results);
        setSuggestions(merged);
        setOpen(merged.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [value, currentLocation]);

  return (
    <div className="suggest-wrap" ref={wrapRef}>
      <input
        id={id}
        type="search"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
          else if (currentLocation && !value.trim()) {
            setSuggestions([
              {
                id: "current-location",
                name: "Your location",
                display_name: "Use your current GPS position",
                lat: currentLocation.lat,
                lng: currentLocation.lng,
                isCurrentLocation: true,
                type: "current",
              },
            ]);
            setOpen(true);
          }
        }}
      />
      {loading && <span className="suggest-spinner" aria-hidden />}
      {open && suggestions.length > 0 && (
        <ul className="suggestions" id={listId} role="listbox">
          {suggestions.map((s) => (
            <li key={s.id} role="option">
              <button
                type="button"
                className={s.isCurrentLocation ? "is-current" : ""}
                onClick={() => {
                  onSelect(s);
                  setOpen(false);
                  setSuggestions([]);
                }}
              >
                <span className="suggest-name">
                  {s.isCurrentLocation && (
                    <span className="suggest-loc-icon" aria-hidden />
                  )}
                  {s.name}
                </span>
                <span className="suggest-meta">{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
