import { useEffect, useId, useRef, useState } from "react";
import { searchPlaces } from "../api/geocode";
import MdTextField from "./MdTextField";

const LOCATION_QUERY = /^(your|my|current)?\s*loc/i;

export default function SuggestInput({
  value,
  onChange,
  onSelect,
  placeholder,
  label = "Search",
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
      (q.length === 0 ||
        LOCATION_QUERY.test(q) ||
        "your location".startsWith(q.toLowerCase()));

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
          (LOCATION_QUERY.test(q) ||
            "your location".includes(q.toLowerCase()))
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
      <MdTextField
        id={id}
        label={label}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={onChange}
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
              key={s.id}
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
              ) : (
                <md-icon slot="start">place</md-icon>
              )}
              <div slot="headline">{s.name}</div>
              <div slot="supporting-text">{s.display_name}</div>
            </md-list-item>
          ))}
        </md-list>
      )}
    </div>
  );
}
