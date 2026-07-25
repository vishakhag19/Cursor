import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "../api/geocode";
import { agentLog } from "../debugAgentLog";
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
  /** Native <input> — pixel-exact padding (landing search). */
  bare = false,
  /**
   * Enter key: pick the top suggestion (directions) or run search and
   * keep the matching places listed as rows (landing search).
   */
  enterSelectsFirst = true,
  /** Parent increments to force-close the list (e.g. outside click). */
  dismissNonce = 0,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);
  const committedRef = useRef(null);
  const lastTypedValueRef = useRef(null);
  const requestSeq = useRef(0);
  const selectRef = useRef(null);
  const nearRef = useRef(near);
  const currentLocationRef = useRef(currentLocation);
  const recentPlacesRef = useRef(recentPlaces);
  nearRef.current = near;
  currentLocationRef.current = currentLocation;
  recentPlacesRef.current = recentPlaces;

  // Keep publish() from clobbering fresher list fields with stale closures
  // (common after await + React 18 batching).
  const openRef = useRef(open);
  const suggestionsRef = useRef(suggestions);
  const listQueryRef = useRef(listQuery);
  const loadingRef = useRef(loading);
  openRef.current = open;
  suggestionsRef.current = suggestions;
  listQueryRef.current = listQuery;
  loadingRef.current = loading;

  function publish(partial) {
    if (!onListChange) return;
    const payload = {
      open: "open" in partial ? partial.open : openRef.current,
      items: "items" in partial ? partial.items : suggestionsRef.current,
      query: "query" in partial ? partial.query : listQueryRef.current,
      loading: "loading" in partial ? partial.loading : loadingRef.current,
      select: selectRef.current,
    };
    // #region agent log
    agentLog({location:'SuggestInput.jsx:publish',message:'publish list state',data:{open:payload.open,loading:payload.loading,itemCount:payload.items?.length??0,query:payload.query,partialKeys:Object.keys(partial),externalList,bare,id},hypothesisId:'D'});
    // #endregion
    onListChange(payload);
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
    if (!dismissNonce) return;
    clearTimeout(debounceRef.current);
    requestSeq.current += 1;
    setLoading(false);
    setOpen(false);
    setSuggestions([]);
    setListQuery("");
    publish({ open: false, items: [], query: "", loading: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissNonce]);

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
    // Always lead with current location when the field allows it.
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
    lastTypedValueRef.current = labelForPlace(place);
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

  function matchingRecents(q) {
    const qLower = q.toLowerCase();
    return (recentPlacesRef.current || [])
      .filter((p) => !p?.isCurrentLocation)
      .filter((p) => {
        const hay = `${p.name || ""} ${p.display_name || ""}`.toLowerCase();
        return hay.includes(qLower);
      })
      .slice(0, 3)
      .map((p) => ({ ...p, id: String(p.id), isRecent: true }));
  }

  async function runSearch(q, { forceOpen = false } = {}) {
    const seq = ++requestSeq.current;
    setLoading(true);
    setOpen(true);
    setListQuery(q);
    publish({ open: true, loading: true, query: q });
    // #region agent log
    agentLog({location:'SuggestInput.jsx:runSearch:start',message:'runSearch started',data:{q,forceOpen,seq,near:nearRef.current||currentLocationRef.current,committed:committedRef.current},hypothesisId:'A'});
    // #endregion
    try {
      const loc = currentLocationRef.current;
      const results = await searchPlaces(q, {
        near: nearRef.current || loc,
        limit: 8,
      });
      // #region agent log
      agentLog({location:'SuggestInput.jsx:runSearch:results',message:'searchPlaces returned',data:{q,seq,requestSeq:requestSeq.current,resultCount:results?.length??0,names:(results||[]).slice(0,3).map(r=>r.name),committed:committedRef.current,forceOpen,stale:seq!==requestSeq.current},hypothesisId:'A'});
      // #endregion
      if (seq !== requestSeq.current) return;
      if (committedRef.current && !forceOpen) {
        // #region agent log
        agentLog({location:'SuggestInput.jsx:runSearch:committedBail',message:'bailing due to committedRef',data:{q,committed:committedRef.current,resultCount:results?.length??0},hypothesisId:'B'});
        // #endregion
        setLoading(false);
        return;
      }
      const merged = [];
      if (allowCurrentLocation && LOCATION_QUERY.test(q)) {
        merged.push(currentPlace(loc));
      }
      // Keep nearby recents that still match the typed query near the top.
      merged.push(...matchingRecents(q), ...results);
      const unique = dedupe(merged).slice(0, 8);
      setSuggestions(unique);
      suggestionsRef.current = unique;
      // Keep the list open for a typed query even when Nominatim returns
      // nothing — otherwise the panel vanishes and search looks broken.
      const nextOpen = unique.length > 0 || forceOpen || q.length >= 1;
      setOpen(nextOpen);
      openRef.current = nextOpen;
      setLoading(false);
      loadingRef.current = false;
      publish({
        open: nextOpen,
        items: unique,
        query: q,
        loading: false,
      });
    } catch (err) {
      // #region agent log
      agentLog({location:'SuggestInput.jsx:runSearch:catch',message:'searchPlaces threw',data:{q,seq,err:String(err?.message||err),forceOpen},hypothesisId:'A'});
      // #endregion
      if (seq !== requestSeq.current) return;
      setLoading(false);
      loadingRef.current = false;
      // Never collapse a typed query back to the empty default list (landing
      // search passes recentPlaces=[]), or the suggest panel disappears.
      if (forceOpen || q.length >= 1) {
        setSuggestions([]);
        suggestionsRef.current = [];
        setOpen(true);
        openRef.current = true;
        setListQuery(q);
        listQueryRef.current = q;
        publish({ open: true, items: [], query: q, loading: false });
      } else {
        showDefaultList();
      }
    }
  }

  function scheduleSearch(raw) {
    clearTimeout(debounceRef.current);
    const q = raw.trim();
    setListQuery(q);
    listQueryRef.current = q;

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

    if (q.length < 1) {
      showDefaultList();
      return;
    }

    // Immediate feedback while typing: filter recents + show Searching…
    // before the debounced geocode round-trip returns. Bump requestSeq so
    // a slower response for an older prefix cannot overwrite this query.
    requestSeq.current += 1;
    const preview = matchingRecents(q);
    setSuggestions(preview);
    suggestionsRef.current = preview;
    setOpen(true);
    openRef.current = true;
    setLoading(true);
    loadingRef.current = true;
    publish({
      open: true,
      items: preview,
      query: q,
      loading: true,
    });

    debounceRef.current = setTimeout(() => {
      void runSearch(q);
    }, 120);
  }

  /** Immediate search — used when Enter should show the match list. */
  function submitSearchList(raw) {
    clearTimeout(debounceRef.current);
    const q = (raw || "").trim();
    committedRef.current = null;
    setListQuery(q);

    if (allowCurrentLocation && q.toLowerCase() === "your location") {
      showDefaultList();
      return;
    }

    if (q.length < 1) {
      showDefaultList();
      return;
    }

    // Already showing matches for this query — keep the list open.
    if (
      open &&
      suggestions.length > 0 &&
      listQuery.trim().toLowerCase() === q.toLowerCase() &&
      !loading
    ) {
      publish({ open: true, items: suggestions, query: q, loading: false });
      return;
    }

    void runSearch(q, { forceOpen: true });
  }

  useEffect(() => {
    // Ignore value updates that came from our own keystrokes (also survives
    // React Strict Mode double-invoking this effect).
    if (lastTypedValueRef.current === value) {
      return;
    }
    const q = (value || "").trim();
    // #region agent log
    agentLog({location:'SuggestInput.jsx:valueEffect',message:'external value sync closing list',data:{value,lastTyped:lastTypedValueRef.current,q,id,externalList},hypothesisId:'C'});
    // #endregion
    if (q.toLowerCase() === "your location") {
      committedRef.current = "Your location";
    } else if (q.length >= 1) {
      committedRef.current = q;
    } else {
      committedRef.current = null;
    }
    stopSearch();

    // Cleared while focused (e.g. start-field X): keep the list open with
    // Current location at the top.
    const focused = Boolean(wrapRef.current?.contains(document.activeElement));
    if (!q && allowCurrentLocation && focused) {
      showDefaultList();
      return;
    }

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

  function handleValueChange(v) {
    lastTypedValueRef.current = v;
    committedRef.current = null;
    // #region agent log
    agentLog({location:'SuggestInput.jsx:handleValueChange',message:'typed value',data:{v,propValue:value,id,externalList},hypothesisId:'C'});
    // #endregion
    onChange(v);
    scheduleSearch(v);
  }

  function handleFocus() {
    onFocusField?.();
    const q = (value || "").trim();
    // Already showing matches for this value — don't restart search (avoids
    // re-render storms that fight the Material text field while typing).
    if (
      open &&
      !loading &&
      listQuery.trim().toLowerCase() === q.toLowerCase() &&
      suggestions.length > 0
    ) {
      publish({ open: true, items: suggestions, query: q, loading: false });
      return;
    }
    // Filled stop fields: search so the place list opens on click.
    if (q && q.toLowerCase() !== "your location") {
      committedRef.current = null;
      void runSearch(q, { forceOpen: true });
      return;
    }
    showDefaultList();
  }

  function handleKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (enterSelectsFirst) {
      if (suggestions[0]) choosePlace(suggestions[0]);
      return;
    }
    submitSearchList(value);
  }

  return (
    <div
      className={`suggest-wrap ${externalList ? "is-external-list" : "is-inline-list"} ${bare ? "is-bare" : ""} ${open && !externalList ? "is-open" : ""}`}
      ref={wrapRef}
    >
      {bare ? (
        <input
          id={id}
          className="suggest-bare-input"
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-label={label || placeholder || "Search"}
          onChange={(e) => handleValueChange(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <MdTextField
          id={id}
          label={label}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={handleValueChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
        />
      )}
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
