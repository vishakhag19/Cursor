import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "../api/geocode";
import MdTextField from "./MdTextField";
import PlaceSuggestionList from "./PlaceSuggestionList";

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
 * Text field that drives place suggestions.
 * - externalList: parent renders PlaceSuggestionList below the inputs (directions)
 * - otherwise: Google Maps–style list renders inline under this field (search)
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
  externalList = false,
  onListChange = null,
  onFocusField = null,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);
  const committedRef = useRef(null);
  const typingRef = useRef(false);
  const requestSeq = useRef(0);
  const selectRef = useRef(null);
  const nearRef = useRef(near);
  const currentLocationRef = useRef(currentLocation);
  const recentPlacesRef = useRef(recentPlaces);
  nearRef.current = near;
  currentLocationRef.current = currentLocation;
  recentPlacesRef.current = recentPlaces;

  function publish(partial) {
    if (!onListChange) return;
    onListChange({
      open: partial.open ?? open,
      items: partial.items ?? suggestions,
      query: partial.query ?? listQuery,
      loading: partial.loading ?? loading,
      select: selectRef.current,
    });
  }

  useEffect(() => {
    if (externalList) return undefined;
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [externalList]);

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
    setListQuery("");
    setSuggestions(items);
    setOpen(items.length > 0);
    setLoading(false);
    publish({
      open: items.length > 0,
      items,
      query: "",
      loading: false,
    });
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
    setListQuery("");
    publish({ open: false, items: [], query: "", loading: false });
    onSelect(place);
  }

  selectRef.current = choosePlace;

  useEffect(() => {
    if (!externalList) return;
    publish({
      open,
      items: suggestions,
      query: listQuery,
      loading,
      select: choosePlace,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalList, open, suggestions, listQuery, loading]);

  function scheduleSearch(raw) {
    clearTimeout(debounceRef.current);
    const q = raw.trim();
    setListQuery(q);

    if (committedRef.current != null) {
      if (q.toLowerCase() === committedRef.current.toLowerCase()) {
        setLoading(false);
        setOpen(false);
        publish({ open: false, loading: false });
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
    setLoading(true);
    publish({ loading: true, query: q });
    debounceRef.current = setTimeout(async () => {
      if (seq !== requestSeq.current) return;
      try {
        const loc = currentLocationRef.current;
        const results = await searchPlaces(q, {
          near: nearRef.current || loc,
          limit: 5,
        });
        if (seq !== requestSeq.current) return;
        if (committedRef.current) {
          setLoading(false);
          return;
        }
        const merged = [];
        if (allowCurrentLocation && LOCATION_QUERY.test(q)) {
          merged.push(currentPlace(loc));
        }
        merged.push(...results);
        const unique = dedupe(merged);
        setSuggestions(unique);
        setOpen(unique.length > 0);
        publish({
          open: unique.length > 0,
          items: unique,
          query: q,
          loading: false,
        });
      } catch {
        if (seq !== requestSeq.current) return;
        showDefaultList();
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          publish({ loading: false });
        }
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
    setListQuery("");
    publish({ open: false, items: [], query: "", loading: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      className={`suggest-wrap ${externalList ? "is-external-list" : "is-inline-list"} ${open && !externalList ? "is-open" : ""}`}
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
          onFocusField?.();
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
      {!externalList && open && (suggestions.length > 0 || loading) && (
        <PlaceSuggestionList
          items={suggestions}
          query={listQuery}
          loading={loading}
          onSelect={choosePlace}
        />
      )}
    </div>
  );
}
