import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import MapView from "./components/MapView";
import SearchPanel from "./components/SearchPanel";
import DirectionsPanel from "./components/DirectionsPanel";
import NavigationUI from "./components/NavigationUI";
import ContextMenu from "./components/ContextMenu";
import RouteAssistant from "./components/RouteAssistant";
import RoutePrefsSheet from "./components/RoutePrefsSheet";
import RoadRulesSheet from "./components/RoadRulesSheet";
import { reverseGeocode, haversineMeters, searchPlaces, resolveSaveEndpointName } from "./api/geocode";
import {
  closestPointOnPolyline,
  fetchShortestRoutes,
  nearestRoadPoint,
  rebuildEditedRoute,
} from "./api/routing";
import { placeLabel } from "./utils/format";
import {
  comparisonVsSuggested,
  seedViasFromStops,
} from "./utils/routeEdit";
import {
  assistantReply,
  buildAvoidVia,
  findStepsForRoad,
  geometryMidpoint,
  parseRouteAssistantIntent,
  roadNamesMatch,
} from "./utils/routeAssist";
import {
  DEFAULT_ROUTE_PREFS,
  excludesFromPrefs,
  routingModeFor,
  travelModeMeta,
} from "./utils/routePreferences";
import { enrichAndRankRoutes } from "./utils/routeRecommend";
import { removeRoadRule, upsertRoadRule, findRoadRule } from "./utils/roadRules";
import {
  loadBlockedStreets,
  loadRecentSearches,
  loadRoadRules,
  loadSavedRoutes,
  persistBlockedStreets,
  persistRoadRules,
  persistSavedRoutes,
  pushRecentSearch,
} from "./utils/storage";
import useGeolocation, { toCurrentLocationPlace } from "./hooks/useGeolocation";
import usePullToRefresh from "./hooks/usePullToRefresh";
import ActionTip from "./components/ActionTip";
import "./App.css";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyStops() {
  return [null, null];
}

function useIsCompact(query = "(max-width: 800px)") {
  const [compact, setCompact] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return compact;
}

const SYSTEM_BACK_MQ =
  "(max-width: 800px), ((hover: none) and (pointer: coarse))";

/** Phones/tablets — including landscape widths above 800px. */
function useSystemBackEnabled() {
  return useIsCompact(SYSTEM_BACK_MQ);
}

function makeMapsUiHistoryState() {
  return { mapsUi: true, t: Date.now() };
}

function historyHasMapsUiMarker() {
  return Boolean(window.history.state?.mapsUi);
}

/** Call from tap handlers so Chrome keeps the history entry for Android Back. */
function armMapsUiHistoryMarkerNow() {
  if (typeof window === "undefined") return;
  if (!window.matchMedia(SYSTEM_BACK_MQ).matches) return;
  if (historyHasMapsUiMarker()) return;
  window.history.pushState(makeMapsUiHistoryState(), "");
}

function cloneGeometry(geometry) {
  if (!geometry?.length) return geometry ?? null;
  return geometry.map((p) => (Array.isArray(p) ? [...p] : p));
}

function cloneRouteOptions(options) {
  if (!options?.length) return [];
  return options.map((r) => ({
    ...r,
    geometry: cloneGeometry(r.geometry),
    steps: r.steps ? r.steps.map((s) => ({ ...s })) : r.steps,
  }));
}

function cloneVias(vias) {
  if (!vias?.length) return [];
  return vias.map((v) => ({ ...v }));
}

function orderViasAlongGeometry(vias, geometry) {
  if (!vias.length) return [];
  return [...vias]
    .map((v) => {
      const c = closestPointOnPolyline({ lat: v.lat, lng: v.lng }, geometry);
      return { via: v, seg: c?.segmentIndex ?? 0 };
    })
    .sort((a, b) => a.seg - b.seg)
    .map((x) => x.via);
}

export default function App() {
  const [view, setView] = useState("search"); // search | directions
  const [panelOpen, setPanelOpen] = useState(true);
  const isCompact = useIsCompact();
  const systemBackEnabled = useSystemBackEnabled();
  const [layer, setLayer] = useState("map");
  const [status, setStatus] = useState(null);
  const statusTimer = useRef(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [recentPlaces, setRecentPlaces] = useState(() => loadRecentSearches());

  const [stops, setStops] = useState(emptyStops);
  const [stopTexts, setStopTexts] = useState(["", ""]);
  const [travelMode, setTravelMode] = useState("driving");
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [routeLocked, setRouteLocked] = useState(false);
  const [baselineRoute, setBaselineRoute] = useState(null);
  const [editVias, setEditVias] = useState([]);
  const [editHistory, setEditHistory] = useState([]);
  const [editPreview, setEditPreview] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [navStepIndex, setNavStepIndex] = useState(0);
  const [showSteps, setShowSteps] = useState(false);
  const [dirLoading, setDirLoading] = useState(false);
  const [dirError, setDirError] = useState(null);
  const [selectedViaId, setSelectedViaId] = useState(null);
  const [blockedStreets, setBlockedStreets] = useState(() => loadBlockedStreets());
  const [roadRules, setRoadRules] = useState(() => loadRoadRules());
  const [routePrefs, setRoutePrefs] = useState(() => ({ ...DEFAULT_ROUTE_PREFS }));
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [roadRulesOpen, setRoadRulesOpen] = useState(false);
  const [roadPickMode, setRoadPickMode] = useState(false);
  /** Where to restore after Pick-on-map: "prefs" | "roadRules" | null */
  const [roadPickReturnTo, setRoadPickReturnTo] = useState(null);
  /** Road rule id to emphasize when Route options opens after a map add. */
  const [highlightedRoadRuleId, setHighlightedRoadRuleId] = useState(null);
  const [rerouteSuggestion, setRerouteSuggestion] = useState(null);
  const [navOriginalRoute, setNavOriginalRoute] = useState(null);
  const [acceptedReroute, setAcceptedReroute] = useState(false);
  /** After Accept or Reject, do not auto-offer the demo prompt again. */
  const [reroutePromptSettled, setReroutePromptSettled] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState(() => loadSavedRoutes());
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState(() => [
    {
      id: "welcome",
      role: "agent",
      text: "I can reshape your route. Try “avoid Oak St”, “take Main instead of 5th”, or “reroute around traffic”. Voice confirmation can plug in later — for now, reply here.",
      spoken:
        "I can reshape your route. Say avoid a street, take one road instead of another, or ask to reroute.",
    },
  ]);

  const [flyTarget, setFlyTarget] = useState(null);
  const [fitKey, setFitKey] = useState(0);
  const [ctx, setCtx] = useState(null);
  /** Search panel list / place / focus — drives mobile history sync. */
  const [searchBackable, setSearchBackable] = useState(false);
  /** Mobile Drive sheet height as fraction of viewport (0.1–1.0). */
  const [sheetHeightFrac, setSheetHeightFrac] = useState(0.3);
  const [followingLocation, setFollowingLocation] = useState(false);
  const suppressMapClickUntil = useRef(0);
  const locateFn = useRef(null);
  const zoomFn = useRef(null);
  const locateFlightRef = useRef(false);
  const followHighlightTimer = useRef(null);
  const editViasRef = useRef([]);
  const routeGeometryRef = useRef(null);
  const selectedRouteIdRef = useRef(null);
  const routeOptionsRef = useRef([]);
  const editHistoryRef = useRef([]);
  const editEpochRef = useRef(0);
  const editCommitChain = useRef(Promise.resolve());
  const searchBackRef = useRef(null);
  const dirBackRef = useRef(null);
  const ignoreMobilePopRef = useRef(false);
  const mobileUiRef = useRef({});

  const {
    location: userLocation,
    error: geoError,
    refresh: refreshLocation,
    takeCenteredOnce,
  } = useGeolocation({ autoStart: true });

  const showStatus = useCallback((message, ms = 2800) => {
    // Material snackbars: brief process / error feedback only — not every tap.
    setStatus(message);
    clearTimeout(statusTimer.current);
    if (ms > 0) {
      statusTimer.current = setTimeout(() => setStatus(null), ms);
    }
  }, []);

  const clearStatus = useCallback(() => {
    clearTimeout(statusTimer.current);
    setStatus(null);
  }, []);

  const clearFollowHighlight = useCallback(() => {
    clearTimeout(followHighlightTimer.current);
    followHighlightTimer.current = null;
    setFollowingLocation(false);
  }, []);

  // Blue locate icon only while recentering — not a sticky idle state.
  const pulseFollowHighlight = useCallback(() => {
    clearTimeout(followHighlightTimer.current);
    setFollowingLocation(true);
    followHighlightTimer.current = setTimeout(() => {
      followHighlightTimer.current = null;
      setFollowingLocation(false);
    }, 1100);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(statusTimer.current);
      clearTimeout(followHighlightTimer.current);
    },
    [],
  );

  editViasRef.current = editVias;
  routeGeometryRef.current = routeGeometry;
  selectedRouteIdRef.current = selectedRouteId;
  routeOptionsRef.current = routeOptions;

  useEffect(() => {
    persistSavedRoutes(savedRoutes);
  }, [savedRoutes]);

  useEffect(() => {
    persistBlockedStreets(blockedStreets);
  }, [blockedStreets]);

  useEffect(() => {
    persistRoadRules(roadRules);
  }, [roadRules]);

  // One-time fold of legacy Avoided streets into Your road rules.
  useEffect(() => {
    setBlockedStreets((streets) => {
      if (!streets.length) return streets;
      setRoadRules((prev) => {
        let next = prev;
        let changed = false;
        for (const b of streets) {
          if (!b?.name) continue;
          if (next.some((r) => roadNamesMatch(r.name, b.name))) continue;
          next = upsertRoadRule(next, {
            name: b.name,
            lat: b.lat,
            lng: b.lng,
            mode: "avoid",
          });
          changed = true;
        }
        return changed ? next : prev;
      });
      return [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userLocation) return;
    if (!takeCenteredOnce()) return;
    locateFlightRef.current = true;
    pulseFollowHighlight();
    setFlyTarget({
      lat: userLocation.lat,
      lng: userLocation.lng,
      zoom: 15,
    });
  }, [userLocation, takeCenteredOnce, pulseFollowHighlight]);

  // Leaving the user via search / route fly clears the blue “following” state.
  useEffect(() => {
    if (!flyTarget) return;
    if (locateFlightRef.current) {
      locateFlightRef.current = false;
      return;
    }
    clearFollowHighlight();
  }, [flyTarget, clearFollowHighlight]);

  // Route fitBounds moves the camera away from a pure follow lock.
  useEffect(() => {
    if (!fitKey) return;
    clearFollowHighlight();
  }, [fitKey, clearFollowHighlight]);

  // Sync "Your location" stop pins only when route is unlocked.
  useEffect(() => {
    if (!userLocation || routeLocked) return;
    const place = toCurrentLocationPlace(userLocation);
    setStops((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        if (!s?.isCurrentLocation) return s;
        changed = true;
        return { ...place };
      });
      return changed ? next : prev;
    });
  }, [userLocation, routeLocked]);

  const clearEditHistory = useCallback(() => {
    editHistoryRef.current = [];
    setEditHistory([]);
  }, []);

  const pushEditHistory = useCallback(() => {
    const entry = {
      vias: cloneVias(editViasRef.current),
      routeId: selectedRouteIdRef.current,
      geometry: cloneGeometry(routeGeometryRef.current),
      options: cloneRouteOptions(routeOptionsRef.current),
    };
    const next = [...editHistoryRef.current, entry];
    editHistoryRef.current = next;
    setEditHistory(next);
  }, []);

  const clearEditState = useCallback(() => {
    setBaselineRoute(null);
    editViasRef.current = [];
    setEditVias([]);
    clearEditHistory();
    setEditPreview(null);
    setEditBusy(false);
    setNavigating(false);
    setNavStepIndex(0);
    setShowSteps(false);
    setSelectedViaId(null);
    editEpochRef.current += 1;
    editCommitChain.current = Promise.resolve();
  }, [clearEditHistory]);

  const clearRoutes = useCallback(() => {
    setRouteOptions([]);
    setSelectedRouteId(null);
    setRouteGeometry(null);
    setRouteLocked(false);
    clearEditState();
    setDirError(null);
  }, [clearEditState]);

  const rememberPlace = useCallback((place) => {
    if (!place || place.isCurrentLocation) return;
    setRecentPlaces((prev) => pushRecentSearch(place, prev));
  }, []);

  const applyEditedRoute = useCallback((route, vias, { pushHistory = true, epoch = null } = {}) => {
    if (epoch != null && epoch !== editEpochRef.current) return false;

    const edited = {
      ...route,
      id: `edited-${Math.round(route.distance)}-${Math.round(route.duration)}-${vias.length}-${Date.now()}`,
      label: "Custom route",
      badge: "Edited route",
      rank: 0,
      edited: true,
    };

    if (pushHistory) pushEditHistory();

    editViasRef.current = vias;
    setEditVias(vias);
    setRouteOptions((prev) => {
      const withoutEdited = prev.filter((r) => !r.edited);
      const next = [edited, ...withoutEdited];
      routeOptionsRef.current = next;
      return next;
    });
    selectedRouteIdRef.current = edited.id;
    setSelectedRouteId(edited.id);
    routeGeometryRef.current = edited.geometry;
    setRouteGeometry(edited.geometry);
    setRouteLocked(true);
    return true;
  }, [pushEditHistory]);

  const selectRoute = useCallback((opt, { keepNavigating = false } = {}) => {
    if (!opt) return;
    selectedRouteIdRef.current = opt.id;
    setSelectedRouteId(opt.id);
    routeGeometryRef.current = opt.geometry;
    setRouteGeometry(opt.geometry);
    setRouteLocked(true);
    if (!keepNavigating) {
      setNavigating(false);
      setNavStepIndex(0);
      setShowSteps(false);
    }
    if (!opt.edited) {
      setBaselineRoute(opt);
      editViasRef.current = [];
      setEditVias([]);
      clearEditHistory();
      setEditPreview(null);
    }
  }, [clearEditHistory]);

  const runDirections = useCallback(
    async (
      nextStops = stops,
      mode = travelMode,
      prefs = routePrefs,
      rules = roadRules,
    ) => {
      const resolved = nextStops.map((s, i) => {
        if (s) return s;
        const text = (stopTexts[i] || "").trim().toLowerCase();
        if (
          userLocation &&
          (text === "your location" || text === "my location")
        ) {
          return toCurrentLocationPlace(userLocation);
        }
        return s;
      });

      const filled = resolved.filter(Boolean);
      if (filled.length < 2) {
        setDirError("Choose a starting point and destination");
        return;
      }

      const meta = travelModeMeta(mode);
      if (meta.unsupported) {
        clearRoutes();
        /* Panel shows NON_DRIVE_MODE_HINT once — don’t also set dirError. */
        setDirError(null);
        setDirLoading(false);
        return;
      }

      const routeMode = routingModeFor(mode);
      setDirLoading(true);
      setDirError(null);
      clearEditState();
      clearStatus();
      try {
        const excludes = excludesFromPrefs(prefs);
        let options;
        try {
          options = await fetchShortestRoutes(filled, routeMode, {
            limit: 5,
            excludes,
          });
        } catch {
          // Brief retry without hard excludes if the first attempt failed.
          await new Promise((r) => setTimeout(r, 600));
          options = await fetchShortestRoutes(filled, routeMode, {
            limit: 5,
            excludes: [],
          });
        }
        // Feature 1/2/7: enrich with traffic + reasons, re-rank by prefs / road rules.
        const ranked = enrichAndRankRoutes(options, prefs, rules, {
          limit: 5,
        });
        setRouteOptions(ranked);
        setBaselineRoute(ranked[0]);
        selectRoute(ranked[0]);
        setFitKey((k) => k + 1);
        clearStatus();
      } catch (err) {
        clearRoutes();
        setDirError(err.message || "Could not find a route");
        showStatus(err.message || "Could not find a route");
      } finally {
        setDirLoading(false);
      }
    },
    [
      stops,
      stopTexts,
      travelMode,
      routePrefs,
      roadRules,
      userLocation,
      showStatus,
      clearStatus,
      selectRoute,
      clearRoutes,
      clearEditState,
    ],
  );

  const applyPrefsToRoutes = useCallback(
    (prefs = routePrefs) => {
      if (stops.filter(Boolean).length >= 2) {
        runDirections(stops, travelMode, prefs);
      }
    },
    [runDirections, stops, travelMode, routePrefs],
  );

  /** Re-rank open cards immediately, then refetch so Prefer/Avoid/Never feel instant. */
  const applyRoadRulesNow = useCallback(
    (nextRules) => {
      setRoadRules(nextRules);
      setRouteOptions((prev) => {
        if (!prev.length) return prev;
        const ranked = enrichAndRankRoutes(prev, routePrefs, nextRules);
        routeOptionsRef.current = ranked;
        if (ranked[0]) {
          const top = ranked[0];
          queueMicrotask(() => {
            selectRoute(top);
            setFitKey((k) => k + 1);
          });
        }
        return ranked;
      });
      if (stops.filter(Boolean).length >= 2) {
        void runDirections(stops, travelMode, routePrefs, nextRules);
      }
    },
    [routePrefs, stops, travelMode, runDirections, selectRoute],
  );

  const handleRoutePrefsChange = useCallback(
    (next) => {
      setRoutePrefs(next);
      applyPrefsToRoutes(next);
    },
    [applyPrefsToRoutes],
  );

  const handleTravelModeChange = useCallback(
    (mode) => {
      setTravelMode(mode);
      if (stops.filter(Boolean).length >= 2) {
        runDirections(stops, mode, routePrefs);
      }
    },
    [stops, runDirections, routePrefs],
  );

  const openDirections = useCallback(
    async ({ from = null, to = null } = {}) => {
      let start = from;
      if (!start) {
        let loc = userLocation;
        if (!loc) {
          try {
            loc = await refreshLocation();
          } catch {
            loc = null;
          }
        }
        if (loc) start = toCurrentLocationPlace(loc);
      }

      const nextStops = [start, to];
      const nextTexts = [
        start
          ? start.isCurrentLocation
            ? "Your location"
            : start.name
          : "",
        to ? (to.isCurrentLocation ? "Your location" : to.name) : "",
      ];
      setStops(nextStops);
      setStopTexts(nextTexts);
      clearRoutes();
      setView("directions");
      setPanelOpen(true);
      // Arm history in the same turn as the tap so Android Back peels this view.
      armMapsUiHistoryMarkerNow();
      if (nextStops[0] && nextStops[1]) {
        runDirections(nextStops, travelMode);
      }
    },
    [clearRoutes, runDirections, travelMode, userLocation, refreshLocation],
  );

  const selectSearchPlace = useCallback(
    (place) => {
      setSearchQuery(place.name);
      setSelectedPlace(place);
      rememberPlace(place);
      setFlyTarget({ lat: place.lat, lng: place.lng, zoom: 14 });
      setView("search");
      setPanelOpen(true);
    },
    [rememberPlace],
  );

  const handleMapClick = useCallback(
    async (latlng, screenPos = null) => {
      // Prefer / Avoid / Never sheet: ONLY while actively in Pick-on-map mode.
      // Never open it from long-press, right-click, or double-click.
      if (!roadPickMode) {
        setCtx(null);
      } else {
        const x =
          screenPos?.x ??
          (typeof window !== "undefined" ? window.innerWidth / 2 : 160);
        const y =
          screenPos?.y ??
          (typeof window !== "undefined" ? window.innerHeight / 2 : 200);
        // Prefetch road name while the Prefer/Avoid/Never sheet is open.
        const roadPromise = resolveRoadAt(latlng);
        setCtx({ latlng, x, y, roadPromise });
        setRoadPickMode(false);
        clearStatus();
        return;
      }

      setSelectedViaId(null);

      // Ignore the click that follows a route-line drag (otherwise it inserts a stop).
      if (Date.now() < suppressMapClickUntil.current) return;

      // When a route is on the map, stops are added only via the stop fields —
      // never by tapping / interacting with the map.
      if (view === "directions") {
        const routeShowing =
          Boolean(routeGeometryRef.current?.length > 1) ||
          Boolean(
            routeOptionsRef.current?.some((r) => r?.geometry?.length > 1),
          );
        if (routeShowing) return;

        const emptyIdx = stops.findIndex((s) => !s);
        try {
          const place = await reverseGeocode(latlng.lat, latlng.lng);
          rememberPlace(place);
          if (emptyIdx === -1) {
            return;
          }
          const nextStops = [...stops];
          nextStops[emptyIdx] = place;
          setStops(nextStops);
          setStopTexts((prev) => {
            const next = [...prev];
            next[emptyIdx] = place.name;
            return next;
          });
          clearRoutes();
          if (nextStops.filter(Boolean).length >= 2) {
            runDirections(nextStops, travelMode);
          }
        } catch {
          showStatus("Could not identify that place");
        }
        return;
      }

      setPanelOpen(true);
      setView("search");
      try {
        const place = await reverseGeocode(latlng.lat, latlng.lng);
        setSelectedPlace(place);
        setSearchQuery(place.name);
        rememberPlace(place);
      } catch {
        const place = {
          id: uid(),
          name: "Dropped pin",
          display_name: `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`,
          lat: latlng.lat,
          lng: latlng.lng,
        };
        setSelectedPlace(place);
        setSearchQuery(place.name);
      }
    },
    [
      view,
      stops,
      travelMode,
      showStatus,
      clearStatus,
      clearRoutes,
      rememberPlace,
      runDirections,
      roadPickMode,
    ],
  );

  const setStopText = useCallback((index, value) => {
    setStopTexts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const setStopPlace = useCallback(
    (index, place) => {
      const nextStops = [...stops];
      nextStops[index] = place || null;
      setStops(nextStops);
      setStopTexts((prev) => {
        const next = [...prev];
        if (!place) {
          next[index] = "";
        } else {
          next[index] = place.isCurrentLocation ? "Your location" : place.name;
        }
        return next;
      });
      clearRoutes();
      if (!place) return;
      if (!place.isCurrentLocation) {
        setFlyTarget({ lat: place.lat, lng: place.lng, zoom: 13 });
      }
      if (nextStops.filter(Boolean).length >= 2) {
        runDirections(nextStops, travelMode);
      }
    },
    [stops, clearRoutes, runDirections, travelMode],
  );

  const addStop = useCallback(() => {
    setStops((prev) => [...prev, null]);
    setStopTexts((prev) => [...prev, ""]);
    clearRoutes();
  }, [clearRoutes]);

  const removeStop = useCallback(
    (index) => {
      if (stops.length <= 2) return;
      const nextStops = stops.filter((_, i) => i !== index);
      setStops(nextStops);
      setStopTexts((prev) => prev.filter((_, i) => i !== index));
      clearRoutes();
      if (nextStops.filter(Boolean).length >= 2) {
        runDirections(nextStops, travelMode);
      }
    },
    [stops, clearRoutes, runDirections, travelMode],
  );

  /** Feature 3: reorder waypoints in the stop list (and on-map pins follow). */
  const moveStop = useCallback(
    (from, to) => {
      if (to < 0 || to >= stops.length || from === to) return;
      const nextStops = [...stops];
      const nextTexts = [...stopTexts];
      const [s] = nextStops.splice(from, 1);
      const [t] = nextTexts.splice(from, 1);
      nextStops.splice(to, 0, s);
      nextTexts.splice(to, 0, t);
      setStops(nextStops);
      setStopTexts(nextTexts);
      clearRoutes();
      if (nextStops.filter(Boolean).length >= 2) {
        runDirections(nextStops, travelMode);
      }
    },
    [stops, stopTexts, clearRoutes, runDirections, travelMode],
  );

  const swapStops = useCallback(() => {
    const nextStops = [...stops].reverse();
    setStops(nextStops);
    setStopTexts((prev) => [...prev].reverse());
    clearRoutes();
    if (nextStops.filter(Boolean).length >= 2) {
      runDirections(nextStops, travelMode);
    }
  }, [stops, clearRoutes, runDirections, travelMode]);

  const filledStops = stops.filter(Boolean);
  const editOrigin = filledStops[0] || null;
  const editDestination =
    filledStops.length >= 2 ? filledStops[filledStops.length - 1] : null;

  const rebuildFromVias = useCallback(
    async (nextVias, { pushHistory = true, preserveOrder = false } = {}) => {
      if (!editOrigin || !editDestination) return;
      const epoch = editEpochRef.current;
      setEditBusy(true);
      clearStatus();
      try {
        const ordered = preserveOrder
          ? nextVias
          : orderViasAlongGeometry(
              nextVias,
              routeGeometryRef.current || baselineRoute?.geometry || [],
            );
        const route = await rebuildEditedRoute(
          editOrigin,
          ordered.map((v) => ({ lat: v.lat, lng: v.lng })),
          editDestination,
          routingModeFor(travelMode),
        );
        if (epoch !== editEpochRef.current) return;
        applyEditedRoute(route, ordered, {
          pushHistory,
          epoch,
        });
      } catch (err) {
        if (epoch !== editEpochRef.current) return;
        showStatus(err.message || "Could not update route");
      } finally {
        if (epoch === editEpochRef.current) setEditBusy(false);
      }
    },
    [
      editOrigin,
      editDestination,
      baselineRoute,
      travelMode,
      applyEditedRoute,
      showStatus,
      clearStatus,
    ],
  );

  const enqueueEdit = useCallback((task) => {
    const run = editCommitChain.current.then(task, task);
    editCommitChain.current = run.catch(() => {});
    return run;
  }, []);

  const ensureEditSession = useCallback((opts = {}) => {
    setShowSteps(false);
    // Mid-nav accept must keep turn-by-turn chrome; other edits leave nav.
    if (!opts.keepNavigating) {
      setNavigating(false);
    }
    const selected =
      routeOptionsRef.current.find(
        (r) => r.id === selectedRouteIdRef.current,
      ) || baselineRoute;
    if (selected && !baselineRoute) setBaselineRoute(selected);
    // Seed mid-stops into vias before the first reshape so rebuilds stay
    // A → stops → B instead of collapsing to A → B.
    if (!selected?.edited && editViasRef.current.length === 0) {
      const seeded = seedViasFromStops(stops);
      if (seeded.length) {
        editViasRef.current = seeded;
        setEditVias(seeded);
      }
    }
  }, [baselineRoute, stops]);

  const commitVia = useCallback(
    (snapped, segmentIndex) =>
      enqueueEdit(async () => {
        ensureEditSession();
        const currentVias = editViasRef.current;
        const geometry = routeGeometryRef.current || [];
        const newVia = {
          id: uid(),
          lat: snapped.lat,
          lng: snapped.lng,
          name: snapped.name || "Via point",
        };
        const withMeta = currentVias.map((v) => {
          const c = closestPointOnPolyline(
            { lat: v.lat, lng: v.lng },
            geometry,
          );
          return { via: v, seg: c?.segmentIndex ?? 0 };
        });
        withMeta.sort((a, b) => a.seg - b.seg);
        const next = [];
        let inserted = false;
        for (const item of withMeta) {
          if (!inserted && segmentIndex <= item.seg) {
            next.push(newVia);
            inserted = true;
          }
          next.push(item.via);
        }
        if (!inserted) next.push(newVia);
        await rebuildFromVias(next, { pushHistory: true, preserveOrder: true });
      }),
    [enqueueEdit, rebuildFromVias, ensureEditSession],
  );

  const moveVia = useCallback(
    (viaId, snapped) =>
      enqueueEdit(async () => {
        ensureEditSession();
        const next = editViasRef.current.map((v) =>
          v.id === viaId
            ? {
                ...v,
                lat: snapped.lat,
                lng: snapped.lng,
                name: snapped.name || v.name,
              }
            : v,
        );
        await rebuildFromVias(next, { pushHistory: true, preserveOrder: true });
      }),
    [enqueueEdit, rebuildFromVias, ensureEditSession],
  );

  const deleteVia = useCallback(
    (viaId) =>
      enqueueEdit(async () => {
        ensureEditSession();
        const next = editViasRef.current.filter((v) => v.id !== viaId);
        setSelectedViaId(null);
        await rebuildFromVias(next, { pushHistory: true, preserveOrder: true });
      }),
    [enqueueEdit, rebuildFromVias, ensureEditSession],
  );

  const rememberBlockedStreet = useCallback((name, lat, lng) => {
    if (!name) return;
    setBlockedStreets((prev) => {
      if (prev.some((b) => roadNamesMatch(b.name, name))) return prev;
      return [...prev, { id: uid(), name, lat, lng, savedAt: Date.now() }];
    });
  }, []);

  const removeBlockedStreet = useCallback((id) => {
    setBlockedStreets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  /** Force the route off a road near `latlng`, or just add to Avoided list. */
  const avoidStreetAt = useCallback(
    async (
      latlng,
      { roadName = null, reshapeRoute = true, focus: focusOverride = null } = {},
    ) => {
      let name = roadName;
      let focus = focusOverride || { lat: latlng.lat, lng: latlng.lng };
      if (!focusOverride || !name) {
        try {
          const snapped = await nearestRoadPoint(
            latlng.lat,
            latlng.lng,
            routingModeFor(travelMode),
          );
          if (!focusOverride) focus = { lat: snapped.lat, lng: snapped.lng };
          name = name || snapped.name || null;
        } catch {
          /* use raw point */
        }
        if (!name) {
          try {
            const place = await reverseGeocode(focus.lat, focus.lng);
            name = place.address?.road || place.name || "this street";
          } catch {
            name = "this street";
          }
        }
      }

      rememberBlockedStreet(name, focus.lat, focus.lng);

      const geometry = routeGeometryRef.current;
      if (!reshapeRoute || !geometry?.length || !editOrigin || !editDestination) {
        return name;
      }

      const avoidVia = buildAvoidVia(focus, geometry, name);
      const via = {
        id: uid(),
        lat: avoidVia.lat,
        lng: avoidVia.lng,
        name: avoidVia.name,
      };
      await enqueueEdit(async () => {
        ensureEditSession();
        const next = [...editViasRef.current, via];
        await rebuildFromVias(next, {
          pushHistory: true,
          preserveOrder: true,
        });
      });
      return name;
    },
    [
      travelMode,
      editOrigin,
      editDestination,
      rememberBlockedStreet,
      enqueueEdit,
      rebuildFromVias,
      ensureEditSession,
    ],
  );

  /** Pull the route onto a named street (assistant / prefer action). */
  const preferStreetNamed = useCallback(
    async (streetName) => {
      const geometry = routeGeometryRef.current;
      if (!geometry?.length) {
        throw new Error("Get directions first");
      }
      const near =
        geometryMidpoint(geometry) ||
        stops.find(Boolean) ||
        userLocation;
      const results = await searchPlaces(streetName, { limit: 6, near });
      const hit =
        results.find((p) =>
          roadNamesMatch(p.address?.road || p.name, streetName),
        ) || results[0];
      if (!hit) {
        throw new Error(`Couldn’t find ${streetName} near this route`);
      }
      let point = { lat: hit.lat, lng: hit.lng, name: hit.address?.road || hit.name };
      try {
        const snapped = await nearestRoadPoint(hit.lat, hit.lng, routingModeFor(travelMode));
        point = {
          lat: snapped.lat,
          lng: snapped.lng,
          name: snapped.name || point.name,
        };
      } catch {
        /* keep place coords */
      }
      ensureEditSession();
      const via = { id: uid(), ...point };
      await enqueueEdit(async () => {
        const next = [...editViasRef.current, via];
        await rebuildFromVias(next, {
          pushHistory: true,
          preserveOrder: false,
        });
      });
      return point.name || streetName;
    },
    [
      stops,
      userLocation,
      travelMode,
      ensureEditSession,
      enqueueEdit,
      rebuildFromVias,
    ],
  );

  /** Bend around the current corridor when the user asks about traffic. */
  const rerouteAroundCorridor = useCallback(
    async ({ keepNavigating = false } = {}) => {
      const geometry = routeGeometryRef.current;
      if (!geometry?.length) throw new Error("Get directions first");
      const mid = geometryMidpoint(geometry);
      if (!mid) throw new Error("No route to adjust");
      ensureEditSession({ keepNavigating });
      const detour = buildAvoidVia(mid, geometry, "busy corridor");
      const via = {
        id: uid(),
        lat: detour.lat,
        lng: detour.lng,
        name: "Traffic detour",
      };
      await enqueueEdit(async () => {
        const next = [...editViasRef.current, via];
        await rebuildFromVias(next, { pushHistory: true, preserveOrder: true });
      });
    },
    [ensureEditSession, enqueueEdit, rebuildFromVias],
  );

  const undoEdit = useCallback(() => {
    const prev = editHistoryRef.current;
    if (!prev.length) return;

    // Invalidate in-flight rebuilds so they can't overwrite this undo.
    editEpochRef.current += 1;
    editCommitChain.current = Promise.resolve();
    setEditBusy(false);

    const snapshot = prev[prev.length - 1];
    const nextHistory = prev.slice(0, -1);
    editHistoryRef.current = nextHistory;
    setEditHistory(nextHistory);

    const vias = cloneVias(snapshot.vias);
    editViasRef.current = vias;
    setEditVias(vias);
    setSelectedViaId(null);
    setEditPreview(null);

    if (snapshot.options) {
      const options = cloneRouteOptions(snapshot.options);
      routeOptionsRef.current = options;
      setRouteOptions(options);
    }
    if (snapshot.routeId) {
      selectedRouteIdRef.current = snapshot.routeId;
      setSelectedRouteId(snapshot.routeId);
    }
    if (snapshot.geometry) {
      const geometry = cloneGeometry(snapshot.geometry);
      routeGeometryRef.current = geometry;
      setRouteGeometry(geometry);
    }
  }, []);

  const resetToSuggested = useCallback(() => {
    if (!baselineRoute) return;
    editEpochRef.current += 1;
    editCommitChain.current = Promise.resolve();
    setEditBusy(false);
    const seeded = seedViasFromStops(stops);
    editViasRef.current = seeded;
    setEditVias(seeded);
    clearEditHistory();
    setEditPreview(null);
    setSelectedViaId(null);
    setRouteOptions((prev) => {
      const clean = prev.filter((r) => !r.edited);
      const hasBaseline = clean.some((r) => r.id === baselineRoute.id);
      const next = hasBaseline ? clean : [baselineRoute, ...clean];
      routeOptionsRef.current = next;
      return next;
    });
    selectedRouteIdRef.current = baselineRoute.id;
    setSelectedRouteId(baselineRoute.id);
    routeGeometryRef.current = baselineRoute.geometry;
    setRouteGeometry(baselineRoute.geometry);
    // Keep the user's zoom during edit — don't re-fit the full route.
  }, [baselineRoute, stops, clearEditHistory]);

  // Ctrl/Cmd+Z + Delete via whenever a custom reshape stack exists.
  useEffect(() => {
    if (!editHistory.length && !editVias.length) return undefined;
    function onKeyDown(e) {
      const tag = e.target?.tagName?.toLowerCase?.();
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) {
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (!editHistoryRef.current.length) return;
        e.preventDefault();
        undoEdit();
        return;
      }

      if (e.key !== "Delete" && e.key !== "Backspace") return;
      e.preventDefault();
      const id =
        selectedViaId ||
        editViasRef.current[editViasRef.current.length - 1]?.id;
      if (id) deleteVia(id);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editHistory.length, editVias.length, selectedViaId, deleteVia, undoEdit]);

  const saveCurrentRoute = useCallback(
    (name) => {
      let route =
        routeOptionsRef.current.find(
          (r) => r.id === selectedRouteIdRef.current,
        ) || null;
      if (!route?.geometry?.length) {
        route =
          routeOptionsRef.current.find((r) => r.geometry?.length > 1) || null;
      }
      if (!route?.geometry?.length && routeGeometryRef.current?.length > 1) {
        route = {
          id: selectedRouteIdRef.current || `route-${Date.now()}`,
          label: "Route",
          distance: 0,
          duration: 0,
          geometry: cloneGeometry(routeGeometryRef.current),
          steps: [],
          edited: editViasRef.current.length > 0,
        };
      }
      if (!route?.geometry?.length) {
        showStatus("No route to save");
        return false;
      }
      const entry = {
        id: uid(),
        name: (name || "Saved route").trim() || "Saved route",
        savedAt: Date.now(),
        travelMode,
        stops: stops.map((s) =>
          s
            ? {
                id: s.id,
                name: s.name,
                display_name: s.display_name,
                lat: s.lat,
                lng: s.lng,
                type: s.type || "place",
                isCurrentLocation: Boolean(s.isCurrentLocation),
              }
            : null,
        ),
        stopTexts: [...stopTexts],
        vias: cloneVias(editViasRef.current),
        blockedStreets: blockedStreets.map((b) => ({ ...b })),
        route: {
          id: route.id,
          label: route.label,
          badge: route.badge || null,
          distance: route.distance,
          duration: route.duration,
          geometry: cloneGeometry(route.geometry),
          steps: route.steps ? route.steps.map((s) => ({ ...s })) : [],
          edited: Boolean(route.edited),
        },
        baseline: baselineRoute
          ? {
              id: baselineRoute.id,
              label: baselineRoute.label,
              distance: baselineRoute.distance,
              duration: baselineRoute.duration,
              geometry: cloneGeometry(baselineRoute.geometry),
              steps: baselineRoute.steps
                ? baselineRoute.steps.map((s) => ({ ...s }))
                : [],
            }
          : null,
      };
      setSavedRoutes((prev) => {
        const withoutDupes = prev.filter(
          (r) =>
            r.route?.id !== entry.route.id &&
            r.name !== entry.name,
        );
        return [entry, ...withoutDupes].slice(0, 24);
      });
      // Keep the live route linked so the bookmark fills immediately.
      setRouteOptions((prev) => {
        const next = prev.map((r) =>
          r.id === route.id
            ? {
                ...r,
                savedEntryId: entry.id,
                originalRouteId: r.originalRouteId || route.id,
              }
            : r,
        );
        routeOptionsRef.current = next;
        return next;
      });
      showStatus("Route saved on this device");
      return true;
    },
    [
      travelMode,
      stops,
      stopTexts,
      blockedStreets,
      baselineRoute,
      showStatus,
    ],
  );

  const loadSavedRoute = useCallback(
    (entry) => {
      if (!entry?.route?.geometry?.length) return;
      clearEditState();
      setView("directions");
      setPanelOpen(true);
      armMapsUiHistoryMarkerNow();
      setDirError(null);
      setStops(entry.stops?.length ? entry.stops : emptyStops());
      setStopTexts(
        entry.stopTexts?.length
          ? entry.stopTexts
          : (entry.stops || []).map((s) =>
              s?.isCurrentLocation ? "Your location" : s?.name || "",
            ),
      );
      setTravelMode(entry.travelMode || "driving");
      const restored = {
        ...entry.route,
        // Keep a stable link back to the saved entry for the bookmark state.
        originalRouteId: entry.route.id,
        savedEntryId: entry.id,
        id: `saved-${entry.id}`,
        edited: true,
        badge: entry.route.edited ? "Saved custom route" : "Saved route",
      };
      const baseline = entry.baseline
        ? { ...entry.baseline, id: entry.baseline.id || `baseline-${entry.id}` }
        : null;
      const options = baseline
        ? [restored, { ...baseline, badge: baseline.badge || null }]
        : [restored];
      routeOptionsRef.current = options;
      setRouteOptions(options);
      selectedRouteIdRef.current = restored.id;
      setSelectedRouteId(restored.id);
      routeGeometryRef.current = restored.geometry;
      setRouteGeometry(restored.geometry);
      setBaselineRoute(baseline || restored);
      const vias = cloneVias(entry.vias || []);
      editViasRef.current = vias;
      setEditVias(vias);
      setBlockedStreets(
        (entry.blockedStreets || []).map((b) => ({ ...b, id: b.id || uid() })),
      );
      setRouteLocked(true);
      setFitKey((k) => k + 1);
      clearStatus();
    },
    [clearEditState, clearStatus],
  );

  const deleteSavedRoute = useCallback((id) => {
    setSavedRoutes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const renameSavedRoute = useCallback((id, name) => {
    const next = (name || "").trim();
    if (!id || !next) return false;
    if (next.length > 80) return false;
    let changed = false;
    setSavedRoutes((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (r.name === next) return r;
        changed = true;
        return { ...r, name: next };
      }),
    );
    if (changed) showStatus("Route name updated");
    return true;
  }, [showStatus]);

  const pushAssistant = useCallback((role, reply) => {
    const payload =
      typeof reply === "string" ? assistantReply(reply) : reply;
    setAssistantMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role,
        text: payload.text,
        spoken: payload.spoken || payload.text,
      },
    ]);
  }, []);

  const handleAssistantMessage = useCallback(
    async (raw) => {
      const text = String(raw || "").trim();
      if (!text) return;
      pushAssistant("user", text);
      setAssistantBusy(true);
      try {
        const intent = parseRouteAssistantIntent(text);

        if (intent.type === "help") {
          pushAssistant(
            "agent",
            assistantReply(
              "I can avoid or block a street, prefer one road over another, try a detour when you mention traffic, undo the last edit, or save this route. Voice replies can be added later — I’ll confirm here for now.",
            ),
          );
          return;
        }

        if (intent.type === "undo") {
          if (!editHistoryRef.current.length) {
            pushAssistant("agent", assistantReply("Nothing to undo yet."));
            return;
          }
          undoEdit();
          pushAssistant("agent", assistantReply("Undid the last route edit."));
          return;
        }

        if (intent.type === "save") {
          const from = await resolveSaveEndpointName(stops[0], "Start");
          const to = await resolveSaveEndpointName(
            stops[stops.length - 1],
            "Destination",
          );
          saveCurrentRoute(`${from} to ${to}`);
          pushAssistant(
            "agent",
            assistantReply(`Saved “${from} to ${to}” on this device.`),
          );
          return;
        }

        if (intent.type === "reroute") {
          if (!routeGeometryRef.current?.length) {
            pushAssistant(
              "agent",
              assistantReply("Set a start and destination first, then ask me to reroute."),
            );
            return;
          }
          pushAssistant(
            "agent",
            assistantReply(
              "I don’t have live traffic feeds yet. I’ll bend the route onto a quieter corridor — confirm by watching the map update.",
              { confirm: true },
            ),
          );
          await rerouteAroundCorridor();
          pushAssistant(
            "agent",
            assistantReply("Detour applied. Say “undo” if you want the previous path back."),
          );
          return;
        }

        if (intent.type === "avoid") {
          const selected =
            routeOptionsRef.current.find(
              (r) => r.id === selectedRouteIdRef.current,
            ) || null;
          const matches = findStepsForRoad(selected?.steps, intent.street);
          let focus = null;
          if (matches.length) {
            const mid = matches[Math.floor(matches.length / 2)].step;
            if (mid.lat != null) focus = { lat: mid.lat, lng: mid.lng };
          }
          if (!focus) {
            const near =
              geometryMidpoint(routeGeometryRef.current) ||
              stops.find(Boolean) ||
              userLocation;
            const found = await searchPlaces(intent.street, { limit: 5, near });
            const hit = found[0];
            if (!hit) {
              pushAssistant(
                "agent",
                assistantReply(
                  `I couldn’t find “${intent.street}” near this trip. Open Route options → Your road rules → Pick on map, then tap that road.`,
                ),
              );
              return;
            }
            focus = { lat: hit.lat, lng: hit.lng };
          }
          const name = await avoidStreetAt(focus, { roadName: intent.street });
          pushAssistant(
            "agent",
            assistantReply(
              `Avoiding ${name}. The route now detours around it. You can also use Route options → Pick on map to Prefer, Avoid, or Never a road.`,
            ),
          );
          return;
        }

        if (intent.type === "prefer" || intent.type === "prefer_instead") {
          if (intent.type === "prefer_instead" && intent.avoid) {
            const selected =
              routeOptionsRef.current.find(
                (r) => r.id === selectedRouteIdRef.current,
              ) || null;
            const matches = findStepsForRoad(selected?.steps, intent.avoid);
            if (matches.length) {
              const mid = matches[Math.floor(matches.length / 2)].step;
              if (mid.lat != null) {
                await avoidStreetAt(
                  { lat: mid.lat, lng: mid.lng },
                  { roadName: intent.avoid },
                );
              }
            }
          }
          const street =
            intent.type === "prefer_instead" ? intent.prefer : intent.street;
          const used = await preferStreetNamed(street);
          const extra =
            intent.type === "prefer_instead" && intent.avoid
              ? ` and steering clear of ${intent.avoid}`
              : "";
          pushAssistant(
            "agent",
            assistantReply(`Routing via ${used}${extra}.`),
          );
          return;
        }

        pushAssistant(
          "agent",
          assistantReply(
            "I didn’t catch that. Try “avoid Oak St”, “take Main instead of 5th”, “reroute”, “undo”, or “save route”.",
          ),
        );
      } catch (err) {
        pushAssistant(
          "agent",
          assistantReply(err.message || "Couldn’t update the route."),
        );
      } finally {
        setAssistantBusy(false);
      }
    },
    [
      pushAssistant,
      undoEdit,
      saveCurrentRoute,
      rerouteAroundCorridor,
      avoidStreetAt,
      preferStreetNamed,
      stops,
      userLocation,
    ],
  );

  const goToMyLocation = useCallback(async () => {
    locateFlightRef.current = true;
    pulseFollowHighlight();

    // If we already have a fix (browser / magic base location), recenter now.
    if (userLocation?.lat != null && userLocation?.lng != null) {
      locateFn.current?.([userLocation.lat, userLocation.lng], 16);
      clearStatus();
    } else {
      showStatus("Locating…", 0);
    }

    try {
      const loc = await refreshLocation();
      if (loc?.lat != null && loc?.lng != null) {
        locateFlightRef.current = true;
        pulseFollowHighlight();
        locateFn.current?.([loc.lat, loc.lng], 16);
        clearStatus();
        return;
      }
      throw new Error("no location");
    } catch {
      if (userLocation?.lat != null && userLocation?.lng != null) {
        locateFlightRef.current = true;
        pulseFollowHighlight();
        locateFn.current?.([userLocation.lat, userLocation.lng], 16);
        clearStatus();
        return;
      }
      clearFollowHighlight();
      showStatus(geoError || "Could not get your location");
    }
  }, [
    refreshLocation,
    geoError,
    showStatus,
    clearStatus,
    userLocation,
    pulseFollowHighlight,
    clearFollowHighlight,
  ]);

  const resolveRoadAt = useCallback(async (latlng) => {
    let focus = { lat: latlng.lat, lng: latlng.lng };
    let name = null;
    try {
      const snapped = await nearestRoadPoint(
        latlng.lat,
        latlng.lng,
        routingModeFor(travelMode),
      );
      focus = { lat: snapped.lat, lng: snapped.lng };
      name = snapped.name || null;
    } catch {
      /* fall through */
    }
    if (!name) {
      try {
        const place = await reverseGeocode(focus.lat, focus.lng);
        name = place.address?.road || place.name || "This road";
      } catch {
        name = "This road";
      }
    }
    return { name, ...focus };
  }, [travelMode]);

  const highlightTimerRef = useRef(null);

  const enterRoadPickMode = useCallback((returnTo = "prefs") => {
    setRoadPickReturnTo(returnTo);
    setPrefsOpen(false);
    setRoadRulesOpen(false);
    setAssistantOpen(false);
    setCtx(null);
    setPanelOpen(false);
    setRoadPickMode(true);
    showStatus("Tap a road on the map to Prefer, Avoid, or Never use it", 0);
  }, [showStatus]);

  const restoreAfterRoadPick = useCallback((returnTo = roadPickReturnTo) => {
    setRoadPickMode(false);
    setCtx(null);
    setRoadPickReturnTo(null);
    clearStatus();
    if (returnTo === "roadRules") {
      setRoadRulesOpen(true);
      setPanelOpen(true);
      return;
    }
    if (returnTo === "prefs") {
      setPrefsOpen(true);
      setPanelOpen(true);
    }
  }, [roadPickReturnTo, clearStatus]);

  const openPrefsWithRoadRules = useCallback((ruleId = null) => {
    setRoadPickMode(false);
    setCtx(null);
    setRoadPickReturnTo(null);
    setAssistantOpen(false);
    setRoadRulesOpen(false);
    setPanelOpen(true);
    if (ruleId) {
      setHighlightedRoadRuleId(ruleId);
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedRoadRuleId(null);
      }, 4500);
    }
    setPrefsOpen(true);
  }, []);

  const applyRoadRuleAt = useCallback(
    async (latlng, mode, roadOrPromise = null) => {
      const road = await (roadOrPromise || resolveRoadAt(latlng));
      const existing = findRoadRule(roadRules, road.name);
      if (existing) {
        openPrefsWithRoadRules(existing.id);
        return {
          name: existing.name,
          id: existing.id,
          duplicate: true,
        };
      }

      const addedId = `road-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const nextRules = upsertRoadRule(roadRules, {
        name: road.name,
        lat: road.lat,
        lng: road.lng,
        mode,
        id: addedId,
      });
      setHighlightedRoadRuleId(addedId);
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedRoadRuleId(null);
      }, 2500);

      // Automatic routing only — re-rank now, then refetch (no reshape vias).
      applyRoadRulesNow(nextRules);

      return { name: road.name, id: addedId, duplicate: false };
    },
    [
      resolveRoadAt,
      roadRules,
      openPrefsWithRoadRules,
      applyRoadRulesNow,
    ],
  );

  const applyTypedRoadRule = useCallback(
    async ({ name, mode, lat = null, lng = null }) => {
      const trimmed = (name || "").trim();
      if (!trimmed || !mode) return { duplicate: false };
      const existing = findRoadRule(roadRules, trimmed);
      if (existing) {
        openPrefsWithRoadRules(existing.id);
        showStatus(`${existing.name} is already in your road rules`);
        return { name: existing.name, id: existing.id, duplicate: true };
      }

      const addedId = `road-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const nextRules = upsertRoadRule(roadRules, {
        name: trimmed,
        mode,
        lat,
        lng,
        id: addedId,
      });
      setHighlightedRoadRuleId(addedId);
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedRoadRuleId(null);
      }, 2500);

      applyRoadRulesNow(nextRules);

      const verb =
        mode === "prefer"
          ? "Preferring"
          : mode === "never"
            ? "Never use"
            : "Avoiding";
      showStatus(`${verb} ${trimmed}`);
      return { name: trimmed, id: addedId, duplicate: false };
    },
    [roadRules, openPrefsWithRoadRules, applyRoadRulesNow, showStatus],
  );

  const ctxActions = ctx
    ? [
        {
          id: "prefer-road",
          label: "Prefer this road",
          icon: "thumb_up",
          onClick: () => {
            const { latlng, roadPromise } = ctx;
            // Return to Route options immediately; finish save in background.
            openPrefsWithRoadRules(null);
            void (async () => {
              try {
                const result = await applyRoadRuleAt(
                  latlng,
                  "prefer",
                  roadPromise,
                );
                if (result?.duplicate) {
                  showStatus(
                    `${result.name} is already in your road rules`,
                  );
                } else {
                  showStatus(`Preferring ${result.name}`);
                }
              } catch (err) {
                showStatus(err.message || "Could not set road rule");
              }
            })();
          },
        },
        {
          id: "avoid-road",
          label: "Avoid this road",
          icon: "do_not_disturb_on",
          onClick: () => {
            const { latlng, roadPromise } = ctx;
            openPrefsWithRoadRules(null);
            void (async () => {
              try {
                const result = await applyRoadRuleAt(
                  latlng,
                  "avoid",
                  roadPromise,
                );
                if (result?.duplicate) {
                  showStatus(
                    `${result.name} is already in your road rules`,
                  );
                } else {
                  showStatus(`Avoiding ${result.name}`);
                }
              } catch (err) {
                showStatus(err.message || "Could not set road rule");
              }
            })();
          },
        },
        {
          id: "never-road",
          label: "Never use this road",
          icon: "block",
          onClick: () => {
            const { latlng, roadPromise } = ctx;
            openPrefsWithRoadRules(null);
            void (async () => {
              try {
                const result = await applyRoadRuleAt(
                  latlng,
                  "never",
                  roadPromise,
                );
                if (result?.duplicate) {
                  showStatus(
                    `${result.name} is already in your road rules`,
                  );
                } else {
                  showStatus(`Never use ${result.name}`);
                }
              } catch (err) {
                showStatus(err.message || "Could not set road rule");
              }
            })();
          },
        },
      ]
    : [];

  const mapMode = view === "directions" ? "directions" : "explore";
  const selectedRoute =
    routeOptions.find((r) => r.id === selectedRouteId) || null;
  const routeRoadHints = (() => {
    const names = [];
    const seen = new Set();
    for (const step of selectedRoute?.steps || []) {
      const name = String(step?.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
    return names;
  })();

  const startNavigation = useCallback(async () => {
    if (!selectedRoute?.steps?.length && !selectedRoute?.geometry?.length) {
      showStatus("No route to start");
      return;
    }
    setShowSteps(false);
    setNavigating(true);
    setPanelOpen(false);
    armMapsUiHistoryMarkerNow();
    setRerouteSuggestion(null);
    setAcceptedReroute(false);
    setReroutePromptSettled(false);
    // Snapshot the path we started with so "Return to original" can restore it.
    setNavOriginalRoute({
      ...selectedRoute,
      geometry: cloneGeometry(selectedRoute.geometry),
      steps: selectedRoute.steps
        ? selectedRoute.steps.map((s) => ({ ...s }))
        : [],
    });
    try {
      const loc = userLocation || (await refreshLocation().catch(() => null));
      if (loc) {
        setFlyTarget({ lat: loc.lat, lng: loc.lng, zoom: 17 });
      } else if (selectedRoute.geometry?.[0]) {
        const [lat, lng] = selectedRoute.geometry[0];
        setFlyTarget({ lat, lng, zoom: 16 });
      }
    } catch {
      /* Navigation UI is already active. */
    }
  }, [selectedRoute, userLocation, refreshLocation, showStatus]);

  const exitNavigation = useCallback(() => {
    setNavigating(false);
    setNavStepIndex(0);
    setShowSteps(false);
    setPanelOpen(true);
    setRerouteSuggestion(null);
    setAcceptedReroute(false);
    setReroutePromptSettled(false);
    setNavOriginalRoute(null);
  }, []);

  /**
   * Feature 6: mid-nav reroute interruption.
   * Auto-shows ~3s after Start (no manual simulate control).
   * ASSUMPTION: no live incident feed — mock reason for prototype testing.
   */
  const offerRerouteDemo = useCallback(() => {
    if (!selectedRoute) return;
    const alt =
      routeOptions.find((r) => r.id !== selectedRoute.id && !r.edited) || null;
    const saveMin = alt
      ? Math.max(
          3,
          Math.round(
            ((selectedRoute.duration || 0) - (alt.duration || 0)) / 60,
          ) + 8,
        )
      : 8;
    setRerouteSuggestion({
      reason: `Accident reported ahead — this saves ~${saveMin} min`,
      detail: alt?.reason
        ? `Suggested: ${alt.label}. ${alt.reason}`
        : "Takes a parallel corridor around the blockage.",
      altRoute: alt,
      saveMin,
    });
  }, [selectedRoute, routeOptions]);

  useEffect(() => {
    if (
      !navigating ||
      !selectedRoute ||
      rerouteSuggestion ||
      acceptedReroute ||
      reroutePromptSettled
    ) {
      return undefined;
    }
    const t = setTimeout(() => {
      offerRerouteDemo();
    }, 3000);
    return () => clearTimeout(t);
  }, [
    navigating,
    selectedRoute,
    rerouteSuggestion,
    acceptedReroute,
    reroutePromptSettled,
    offerRerouteDemo,
  ]);

  const acceptReroute = useCallback(async () => {
    const suggestion = rerouteSuggestion;
    setRerouteSuggestion(null);
    setReroutePromptSettled(true);
    if (!suggestion) return;
    setPanelOpen(false);
    setNavigating(true);
    if (suggestion.altRoute) {
      selectRoute(suggestion.altRoute, { keepNavigating: true });
      setAcceptedReroute(true);
      setNavStepIndex(0);
      showStatus("Reroute accepted");
      return;
    }
    try {
      await rerouteAroundCorridor({ keepNavigating: true });
      setAcceptedReroute(true);
      setNavigating(true);
      setNavStepIndex(0);
      showStatus("Reroute accepted");
    } catch (err) {
      setNavigating(true);
      showStatus(err.message || "Could not reroute");
    }
  }, [rerouteSuggestion, selectRoute, rerouteAroundCorridor, showStatus]);

  const rejectReroute = useCallback(() => {
    setRerouteSuggestion(null);
    setReroutePromptSettled(true);
    setAcceptedReroute(false);
    setNavigating(true);
    setPanelOpen(false);
    showStatus("Staying on current route");
  }, [showStatus]);

  const returnToOriginalRoute = useCallback(() => {
    if (!navOriginalRoute) return;
    selectRoute(navOriginalRoute, { keepNavigating: true });
    setAcceptedReroute(false);
    setNavStepIndex(0);
    setRerouteSuggestion(null);
  }, [navOriginalRoute, selectRoute]);

  // Advance turn-by-turn step when the user approaches the next maneuver.
  useEffect(() => {
    if (!navigating || !userLocation || !selectedRoute?.steps?.length) return;
    const steps = selectedRoute.steps;
    let idx = navStepIndex;
    while (idx < steps.length - 1) {
      const s = steps[idx];
      if (s.lat == null || s.lng == null) break;
      const d = haversineMeters(userLocation, { lat: s.lat, lng: s.lng });
      // Move to next instruction once within ~35m of this maneuver
      // (or past it toward the following one).
      if (d < 35) {
        idx += 1;
        continue;
      }
      break;
    }
    if (idx !== navStepIndex) setNavStepIndex(idx);
  }, [navigating, userLocation, selectedRoute, navStepIndex]);

  // Follow user location while navigating.
  useEffect(() => {
    if (!navigating || !userLocation) return;
    setFlyTarget({
      lat: userLocation.lat,
      lng: userLocation.lng,
      zoom: 17,
    });
  }, [navigating, userLocation]);


  const activeDuration =
    editPreview?.previewDuration ??
    routeOptions.find((r) => r.id === selectedRouteId)?.duration ??
    null;
  const comparison =
    baselineRoute && activeDuration != null
      ? comparisonVsSuggested(activeDuration, baselineRoute.duration)
      : null;
  const canReset =
    Boolean(baselineRoute) &&
    (editVias.length > 0 ||
      routeOptions.some((r) => r.edited) ||
      selectedRouteId !== baselineRoute.id);
  const hasCustomEdits =
    editHistory.length > 0 || routeOptions.some((r) => r.edited);
  const routeEditable =
    view === "directions" &&
    !navigating &&
    !roadPickMode &&
    Boolean(editOrigin) &&
    Boolean(editDestination) &&
    Boolean(routeGeometry?.length > 1);
  const freezeFit =
    editHistory.length > 0 ||
    Boolean(editPreview?.active) ||
    editBusy;
  // Undo/reset only after a reshape in this session — not for opened saved routes.
  const showEditBar =
    view === "directions" &&
    !navigating &&
    editHistory.length > 0 &&
    Boolean(selectedRoute);

  // Keep mid-stops in the reshape via list as soon as the route is editable
  // so live drag preview and the first commit both honor them.
  useEffect(() => {
    if (!routeEditable) return;
    ensureEditSession();
  }, [routeEditable, selectedRouteId, stops, ensureEditSession]);

  // Collapsing the left panel should dismiss floating sheets that reposition off it.
  useEffect(() => {
    if (panelOpen) return;
    setPrefsOpen(false);
    setRoadRulesOpen(false);
    setAssistantOpen(false);
  }, [panelOpen]);

  // Leave directions / start navigating → dismiss Route options.
  useEffect(() => {
    if (view !== "directions" || navigating) {
      setPrefsOpen(false);
      setRoadRulesOpen(false);
    }
  }, [view, navigating]);

  const closeDirectionsView = useCallback(() => {
    setPrefsOpen(false);
    setRoadRulesOpen(false);
    setAssistantOpen(false);
    setView("search");
    clearRoutes();
  }, [clearRoutes]);

  // Keep a sync snapshot for the system-back handler (read from popstate).
  mobileUiRef.current = {
    ctx,
    roadPickMode,
    roadPickReturnTo,
    rerouteSuggestion,
    assistantOpen,
    prefsOpen,
    roadRulesOpen,
    showSteps,
    navigating,
    view,
    searchBackable,
  };

  const countBackableUi = useCallback((overrides = {}) => {
    const s = { ...mobileUiRef.current, ...overrides };
    let n = 0;
    if (s.ctx) n += 1;
    if (s.roadPickMode) n += 1;
    if (s.rerouteSuggestion) n += 1;
    if (s.assistantOpen) n += 1;
    if (s.prefsOpen || s.roadRulesOpen) n += 1;
    if (s.showSteps) n += 1;
    if (s.navigating) n += 1;
    if (s.view === "directions") n += 1;
    else if (s.searchBackable || searchBackRef.current?.isBackable?.()) n += 1;
    return n;
  }, []);

  /** @returns {boolean} true if another layer remains after this peel */
  const dismissTopLayer = useCallback(() => {
    const s = mobileUiRef.current;
    if (s.ctx) {
      restoreAfterRoadPick(s.roadPickReturnTo || "prefs");
      return (
        countBackableUi({
          ctx: null,
          roadPickMode: false,
          prefsOpen: (s.roadPickReturnTo || "prefs") === "prefs",
          roadRulesOpen: s.roadPickReturnTo === "roadRules",
        }) > 0
      );
    }
    if (s.roadPickMode) {
      restoreAfterRoadPick(s.roadPickReturnTo || "prefs");
      return (
        countBackableUi({
          roadPickMode: false,
          prefsOpen: (s.roadPickReturnTo || "prefs") === "prefs",
          roadRulesOpen: s.roadPickReturnTo === "roadRules",
        }) > 0
      );
    }
    if (s.rerouteSuggestion) {
      setRerouteSuggestion(null);
      return countBackableUi({ rerouteSuggestion: null }) > 0;
    }
    if (s.assistantOpen) {
      setAssistantOpen(false);
      return countBackableUi({ assistantOpen: false }) > 0;
    }
    if (s.prefsOpen || s.roadRulesOpen) {
      setPrefsOpen(false);
      setRoadRulesOpen(false);
      setHighlightedRoadRuleId(null);
      return countBackableUi({ prefsOpen: false, roadRulesOpen: false }) > 0;
    }
    if (s.showSteps) {
      setShowSteps(false);
      return countBackableUi({ showSteps: false }) > 0;
    }
    if (s.navigating) {
      exitNavigation();
      return countBackableUi({ navigating: false }) > 0;
    }
    if (s.view === "directions") {
      if (dirBackRef.current?.handleBack) {
        const kept = dirBackRef.current.handleBack();
        if (kept) return true;
      } else {
        closeDirectionsView();
      }
      return Boolean(searchBackRef.current?.isBackable?.());
    }
    if (searchBackRef.current?.isBackable?.()) {
      return Boolean(searchBackRef.current.handleBack());
    }
    return false;
  }, [closeDirectionsView, countBackableUi, exitNavigation, restoreAfterRoadPick]);

  const armMapsUiHistoryMarker = useCallback(() => {
    if (!systemBackEnabled) return;
    if (ignoreMobilePopRef.current) return;
    if (countBackableUi() <= 0) return;
    if (historyHasMapsUiMarker()) return;
    window.history.pushState(makeMapsUiHistoryState(), "");
  }, [countBackableUi, systemBackEnabled]);

  const syncMapsUiHistoryMarker = useCallback(() => {
    if (!systemBackEnabled) return;
    if (ignoreMobilePopRef.current) return;
    const has = countBackableUi() > 0;
    const marked = historyHasMapsUiMarker();
    if (has && !marked) {
      window.history.pushState(makeMapsUiHistoryState(), "");
    } else if (!has && marked) {
      ignoreMobilePopRef.current = true;
      window.history.back();
    }
  }, [countBackableUi, systemBackEnabled]);

  // Stable listener — do not tear down on every layer change (that drops backs).
  useEffect(() => {
    if (!systemBackEnabled) return undefined;

    function onPopState() {
      if (ignoreMobilePopRef.current) {
        ignoreMobilePopRef.current = false;
        // Disarm raced with a newly opened layer — re-arm so Back keeps working.
        if (countBackableUi() > 0 && !historyHasMapsUiMarker()) {
          window.history.pushState(makeMapsUiHistoryState(), "");
        }
        return;
      }
      if (countBackableUi() <= 0) return;
      const still = dismissTopLayer();
      if (still) {
        window.history.pushState(makeMapsUiHistoryState(), "");
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [systemBackEnabled, countBackableUi, dismissTopLayer]);

  // Keep one history marker armed while any dismissible layer is open.
  useLayoutEffect(() => {
    syncMapsUiHistoryMarker();
  }, [
    syncMapsUiHistoryMarker,
    ctx,
    roadPickMode,
    roadPickReturnTo,
    rerouteSuggestion,
    assistantOpen,
    prefsOpen,
    roadRulesOpen,
    showSteps,
    navigating,
    view,
    searchBackable,
  ]);

  // Arm during the same user gesture that opened a layer (Chrome won't skip it).
  useEffect(() => {
    if (!systemBackEnabled) return undefined;
    function onGesture() {
      armMapsUiHistoryMarker();
    }
    window.addEventListener("pointerup", onGesture, true);
    window.addEventListener("click", onGesture, true);
    return () => {
      window.removeEventListener("pointerup", onGesture, true);
      window.removeEventListener("click", onGesture, true);
    };
  }, [systemBackEnabled, armMapsUiHistoryMarker]);

  const fitPadding = useMemo(() => {
    const mobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 800px)").matches;
    if (!panelOpen) {
      return { top: 72, right: 72, bottom: 72, left: 72 };
    }
    if (mobile) {
      if (view === "directions") {
        const sheetPx = Math.round(
          (typeof window !== "undefined" ? window.innerHeight : 800) *
            (sheetHeightFrac || 0.3),
        );
        return {
          top: 160,
          right: 28,
          bottom: Math.max(120, sheetPx + 24),
          left: 28,
        };
      }
      return { top: 120, right: 28, bottom: 200, left: 28 };
    }
    return { top: 48, right: 72, bottom: 48, left: 420 };
  }, [panelOpen, view, sheetHeightFrac]);

  const pullToRefreshEnabled = isCompact && !navigating && !roadPickMode;

  const reloadApp = useCallback(() => {
    window.location.reload();
  }, []);

  const {
    pullPx: ptrPullPx,
    refreshing: ptrRefreshing,
    armed: ptrArmed,
  } = usePullToRefresh({
    enabled: pullToRefreshEnabled,
    onRefresh: reloadApp,
  });

  return (
    <div
      className={`app ${panelOpen ? "" : "panel-collapsed"} ${navigating ? "nav-mode" : ""} ${navigating && rerouteSuggestion ? "has-reroute-prompt" : ""} ${roadPickMode ? "road-pick-mode" : ""} ${ptrPullPx > 0 || ptrRefreshing ? "is-pulling-refresh" : ""}`}
    >
      {pullToRefreshEnabled && (ptrPullPx > 0 || ptrRefreshing) ? (
        <div
          className={`pull-to-refresh ${ptrArmed ? "is-armed" : ""} ${ptrRefreshing ? "is-refreshing" : ""}`}
          style={{ height: `${Math.max(ptrPullPx, ptrRefreshing ? 48 : 0)}px` }}
          aria-hidden
        >
          <div className="pull-to-refresh-inner">
            <md-circular-progress
              indeterminate={ptrRefreshing || undefined}
              value={ptrArmed || ptrRefreshing ? 1 : Math.min(1, ptrPullPx / 72)}
              aria-label="Pull to refresh"
            />
          </div>
        </div>
      ) : null}
      <aside
        className={`panel m3-surface ${view === "search" ? "is-search-chrome" : "is-directions-chrome"}`}
        aria-label="Map tools"
        aria-hidden={navigating ? "true" : undefined}
        inert={navigating ? true : undefined}
      >
        {view === "search" && !navigating && (
          <SearchPanel
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSelectPlace={selectSearchPlace}
            place={selectedPlace}
            recentPlaces={recentPlaces}
            near={userLocation}
            savedRoutes={savedRoutes}
            onLoadSaved={loadSavedRoute}
            onDeleteSaved={deleteSavedRoute}
            onRenameSaved={renameSavedRoute}
            onClear={() => {
              setSearchQuery("");
              setSelectedPlace(null);
            }}
            onDismissPlace={() => setSelectedPlace(null)}
            onDirectionsTo={() => {
              if (!selectedPlace) return;
              openDirections({ to: selectedPlace });
            }}
            onDirectionsFrom={() => {
              if (!selectedPlace) return;
              openDirections({ from: selectedPlace });
            }}
            backRef={searchBackRef}
            onBackableChange={(next) => {
              setSearchBackable(next);
              if (next) armMapsUiHistoryMarkerNow();
            }}
          />
        )}

        {view === "directions" && !navigating && (
          <DirectionsPanel
            stops={stops}
            stopTexts={stopTexts}
            onStopText={setStopText}
            onStopSelect={(i, place) => {
              setStopPlace(i, place);
              rememberPlace(place);
            }}
            onAddStop={addStop}
            onRemoveStop={removeStop}
            onMoveStop={moveStop}
            onSwap={swapStops}
            backRef={dirBackRef}
            onSheetHeightChange={setSheetHeightFrac}
            onClose={closeDirectionsView}
            routeOptions={routeOptions}
            selectedRouteId={selectedRouteId}
            onSelectRoute={(opt) => {
              selectRoute(opt);
            }}
            loading={dirLoading}
            error={dirError}
            currentLocation={userLocation}
            near={userLocation}
            recentPlaces={recentPlaces}
            onRequestLocation={async () => {
              showStatus("Locating…", 0);
              try {
                const loc = await refreshLocation();
                clearStatus();
                return loc;
              } catch {
                if (userLocation?.lat != null) {
                  clearStatus();
                  return userLocation;
                }
                showStatus(geoError || "Could not get your location");
                throw new Error("location");
              }
            }}
            comparison={hasCustomEdits ? comparison : null}
            editBusy={editBusy || Boolean(editPreview?.active)}
            onSaveRoute={saveCurrentRoute}
            onUnsaveRoute={(id) => {
              deleteSavedRoute(id);
              showStatus("Route removed from saved");
            }}
            savedRoutes={savedRoutes}
            onStart={startNavigation}
            onOpenAssistant={() => {
              setPrefsOpen(false);
              setAssistantOpen((open) => !open);
            }}
            assistantOpen={assistantOpen}
            onOpenPrefs={() => setPrefsOpen((open) => !open)}
            prefsOpen={prefsOpen}
            hasCustomEdits={hasCustomEdits}
            travelMode={travelMode}
            onTravelMode={handleTravelModeChange}
            showTollPassPrices={Boolean(routePrefs.showTollPassPrices)}
            routePrefs={routePrefs}
            onRoutePrefsChange={handleRoutePrefsChange}
          />
        )}
      </aside>

      <main className="map-stage">
        {showEditBar ? (
          <div
            className="route-reshape-bar"
            role="toolbar"
            aria-label="Route reshape actions"
          >
            <ActionTip tip="Undo last reshape (Ctrl+Z)">
              <md-icon-button
                type="button"
                class="route-reshape-undo"
                aria-label="Undo last reshape"
                onClick={undoEdit}
                disabled={editHistory.length === 0 || undefined}
              >
                <md-icon>undo</md-icon>
              </md-icon-button>
            </ActionTip>
            <ActionTip tip="Reset to original route">
              <md-icon-button
                type="button"
                class="route-reshape-reset"
                aria-label="Reset to original route"
                onClick={resetToSuggested}
                disabled={!canReset || undefined}
              >
                <md-icon>restart_alt</md-icon>
              </md-icon-button>
            </ActionTip>
          </div>
        ) : null}
        <MapView
          mode={mapMode}
          layer={layer}
          searchMarker={view === "search" ? selectedPlace : null}
          userLocation={userLocation}
          directions={{
            from: filledStops[0] || null,
            to: filledStops[filledStops.length - 1] || null,
            geometry: routeGeometry,
          }}
          createRoute={{
            waypoints:
              view === "directions"
                ? stops
                    .map((wp, stopIndex) =>
                      wp ? { ...wp, stopIndex } : null,
                    )
                    .filter(Boolean)
                : [],
            geometry: null,
            alternatives: [],
          }}
          routeOptions={view === "directions" ? routeOptions : []}
          selectedRouteId={selectedRouteId}
          onSelectRoute={(opt) => {
            selectRoute(opt);
          }}
          routeEditable={routeEditable}
          roadPickMode={roadPickMode}
          freezeFit={freezeFit}
          editOrigin={editOrigin}
          editDestination={editDestination}
          editVias={editVias}
          editTravelMode={routingModeFor(travelMode)}
          selectedViaId={selectedViaId}
          onSelectVia={(id) => {
            suppressMapClickUntil.current = Date.now() + 900;
            setSelectedViaId(id);
          }}
          onEditPreview={setEditPreview}
          onSuppressMapClick={() => {
            suppressMapClickUntil.current = Date.now() + 900;
          }}
          onCommitVia={(snapped, segmentIndex) => {
            suppressMapClickUntil.current = Date.now() + 900;
            return commitVia(snapped, segmentIndex);
          }}
          onMoveVia={(viaId, snapped) => {
            suppressMapClickUntil.current = Date.now() + 900;
            return moveVia(viaId, snapped);
          }}
          onDeleteVia={(viaId) => {
            suppressMapClickUntil.current = Date.now() + 900;
            return deleteVia(viaId);
          }}
          onEditError={(msg) => showStatus(msg)}
          flyTarget={flyTarget}
          fitKey={fitKey}
          fitPadding={fitPadding}
          onMapClick={handleMapClick}
          onWaypointDrag={async (stopIndex, lat, lng) => {
            try {
              const place = await reverseGeocode(lat, lng);
              setStopPlace(stopIndex, place);
              rememberPlace(place);
            } catch {
              setStopPlace(stopIndex, {
                id: uid(),
                name: "Moved pin",
                display_name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                lat,
                lng,
              });
            }
          }}
          onLocateReady={(fn) => {
            locateFn.current = fn;
          }}
          onZoomReady={(api) => {
            zoomFn.current = api;
          }}
          onUserDrag={() => clearFollowHighlight()}
          onMarkerClick={(place) => {
            setView("search");
            setPanelOpen(true);
            setSelectedPlace(place);
            setSearchQuery(place.name || placeLabel(place));
            setFlyTarget({ lat: place.lat, lng: place.lng, zoom: 15 });
          }}
        />

        <div className="map-controls">
          <div className="map-ctrl-stack" role="group" aria-label="Map controls">
            {showEditBar ? (
              <>
                <ActionTip tip="Undo last reshape" className="map-ctrl-mobile-only">
                  <button
                    type="button"
                    className="map-ctrl-btn"
                    aria-label="Undo last reshape"
                    onClick={undoEdit}
                    disabled={editHistory.length === 0 || undefined}
                  >
                    <md-icon>undo</md-icon>
                  </button>
                </ActionTip>
                <ActionTip tip="Reset to original route" className="map-ctrl-mobile-only">
                  <button
                    type="button"
                    className="map-ctrl-btn"
                    aria-label="Reset to original route"
                    onClick={resetToSuggested}
                    disabled={!canReset || undefined}
                  >
                    <md-icon>restart_alt</md-icon>
                  </button>
                </ActionTip>
              </>
            ) : null}
            <ActionTip tip="Map" className="map-ctrl-desktop-only">
              <button
                type="button"
                className={layer === "map" ? "map-ctrl-btn is-selected" : "map-ctrl-btn"}
                aria-label="Map"
                aria-pressed={layer === "map" ? "true" : "false"}
                onClick={() => setLayer("map")}
              >
                <md-icon>map</md-icon>
              </button>
            </ActionTip>
            <ActionTip tip="Satellite" className="map-ctrl-desktop-only">
              <button
                type="button"
                className={
                  layer === "satellite" ? "map-ctrl-btn is-selected" : "map-ctrl-btn"
                }
                aria-label="Satellite"
                aria-pressed={layer === "satellite" ? "true" : "false"}
                onClick={() => setLayer("satellite")}
              >
                <md-icon>satellite_alt</md-icon>
              </button>
            </ActionTip>
            <ActionTip tip="Layers" className="map-ctrl-mobile-only">
              <button
                type="button"
                className={
                  layer === "satellite" ? "map-ctrl-btn is-selected" : "map-ctrl-btn"
                }
                aria-label="Layers"
                aria-pressed={layer === "satellite" ? "true" : "false"}
                onClick={() =>
                  setLayer((prev) => (prev === "satellite" ? "map" : "satellite"))
                }
              >
                <md-icon>layers</md-icon>
              </button>
            </ActionTip>
            <ActionTip tip="My location">
              <button
                type="button"
                className={`map-ctrl-btn locate-btn ${followingLocation ? "is-located" : ""}`}
                aria-label="My location"
                aria-pressed={followingLocation ? "true" : "false"}
                onClick={goToMyLocation}
              >
                <md-icon>my_location</md-icon>
              </button>
            </ActionTip>
            <ActionTip tip="Zoom in" className="map-ctrl-desktop-only">
              <button
                type="button"
                className="map-ctrl-btn"
                aria-label="Zoom in"
                onClick={() => {
                  clearFollowHighlight();
                  zoomFn.current?.zoomIn?.();
                }}
              >
                <md-icon>add</md-icon>
              </button>
            </ActionTip>
            <ActionTip tip="Zoom out" className="map-ctrl-desktop-only">
              <button
                type="button"
                className="map-ctrl-btn"
                aria-label="Zoom out"
                onClick={() => {
                  clearFollowHighlight();
                  zoomFn.current?.zoomOut?.();
                }}
              >
                <md-icon>remove</md-icon>
              </button>
            </ActionTip>
          </div>
        </div>

        {status && !navigating && (
          <div className="map-status md-typescale-label-large" role="status">
            {status}
          </div>
        )}
      </main>

      {/* Outside the side panel so Drive-sheet stacking can never block nav chrome */}
      {navigating && selectedRoute ? (
        <NavigationUI
          active={navigating}
          route={selectedRoute}
          currentStepIndex={navStepIndex}
          onExit={exitNavigation}
          rerouteSuggestion={rerouteSuggestion}
          onAcceptReroute={acceptReroute}
          onRejectReroute={rejectReroute}
          canReturnToOriginal={acceptedReroute && Boolean(navOriginalRoute)}
          onReturnToOriginal={returnToOriginalRoute}
          onShowAlternatives={() => {
            const alt = routeOptions.find(
              (r) => r.id !== selectedRoute.id && !r.edited,
            );
            if (alt) {
              setSelectedRouteId(alt.id);
              setRerouteSuggestion(null);
              showStatus(`Switched to ${alt.label || "alternate route"}`);
            } else {
              showStatus("No alternate routes available");
            }
          }}
        />
      ) : null}

      <ContextMenu
        position={ctx}
        onClose={() => restoreAfterRoadPick()}
        actions={ctxActions}
        title="Choose a road rule"
      />

      <RouteAssistant
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        messages={assistantMessages}
        busy={assistantBusy}
        onSend={handleAssistantMessage}
      />

      <RoutePrefsSheet
        open={prefsOpen}
        prefs={routePrefs}
        onChange={handleRoutePrefsChange}
        onClose={() => {
          setPrefsOpen(false);
          setHighlightedRoadRuleId(null);
        }}
        roadRules={roadRules}
        highlightedRoadRuleId={highlightedRoadRuleId}
        near={
          userLocation ||
          stops.find((s) => s?.lat != null && s?.lng != null) ||
          null
        }
        routeRoadHints={routeRoadHints}
        onAddTypedRoadRule={applyTypedRoadRule}
        onPickRoadOnMap={() => enterRoadPickMode("prefs")}
        onRemoveRoadRule={(id) => {
          const rule = roadRules.find((r) => r.id === id);
          const nextRules = removeRoadRule(roadRules, id);
          if (rule?.name) {
            const name = rule.name;
            setBlockedStreets((prev) =>
              prev.filter((b) => !roadNamesMatch(b.name, name)),
            );
          }
          applyRoadRulesNow(nextRules);
        }}
        onSetRoadRuleMode={(id, mode) => {
          const nextRules = roadRules.map((r) =>
            r.id === id ? { ...r, mode, updatedAt: Date.now() } : r,
          );
          applyRoadRulesNow(nextRules);
        }}
      />

      {roadRulesOpen ? (
        <RoadRulesSheet
          open={roadRulesOpen}
          rules={roadRules}
          onClose={() => setRoadRulesOpen(false)}
          onAdd={() => enterRoadPickMode("roadRules")}
          onRemove={(id) => {
            const rule = roadRules.find((r) => r.id === id);
            const nextRules = removeRoadRule(roadRules, id);
            if (rule?.name) {
              const name = rule.name;
              setBlockedStreets((prev) =>
                prev.filter((b) => !roadNamesMatch(b.name, name)),
              );
            }
            applyRoadRulesNow(nextRules);
          }}
          onSetMode={(id, mode) => {
            const nextRules = roadRules.map((r) =>
              r.id === id ? { ...r, mode, updatedAt: Date.now() } : r,
            );
            applyRoadRulesNow(nextRules);
          }}
        />
      ) : null}

      {/* Assistant entry lives beside Route options in the Drive top bar. */}
    </div>
  );
}
