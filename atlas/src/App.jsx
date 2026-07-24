import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView from "./components/MapView";
import SearchPanel from "./components/SearchPanel";
import DirectionsPanel from "./components/DirectionsPanel";
import NavigationUI from "./components/NavigationUI";
import StepsSheet from "./components/StepsSheet";
import ContextMenu from "./components/ContextMenu";
import RouteAssistant from "./components/RouteAssistant";
import RoutePrefsSheet from "./components/RoutePrefsSheet";
import RoadRulesSheet from "./components/RoadRulesSheet";
import { reverseGeocode, haversineMeters, searchPlaces } from "./api/geocode";
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
} from "./utils/routePreferences";
import { enrichAndRankRoutes } from "./utils/routeRecommend";
import { removeRoadRule, upsertRoadRule } from "./utils/roadRules";
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
  const [rerouteSuggestion, setRerouteSuggestion] = useState(null);
  const [navOriginalRoute, setNavOriginalRoute] = useState(null);
  const [acceptedReroute, setAcceptedReroute] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState(() => loadSavedRoutes());
  const [savedTab, setSavedTab] = useState("routes");
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
  const [followingLocation, setFollowingLocation] = useState(false);
  const [editCoachOpen, setEditCoachOpen] = useState(false);
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
    async (nextStops = stops, mode = travelMode, prefs = routePrefs) => {
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
      setDirLoading(true);
      setDirError(null);
      clearEditState();
      clearStatus();
      try {
        const excludes = excludesFromPrefs(prefs);
        let options;
        try {
          options = await fetchShortestRoutes(filled, mode, {
            limit: 5,
            excludes,
          });
        } catch {
          await new Promise((r) => setTimeout(r, 600));
          options = await fetchShortestRoutes(filled, mode, {
            limit: 5,
            excludes,
          });
        }
        // Feature 1/2/7: enrich with traffic + reasons, re-rank by prefs / road rules.
        const ranked = enrichAndRankRoutes(options, prefs, roadRules, {
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

  const applyPrefsToRoutes = useCallback(() => {
    // Re-rank existing options without a full network round-trip when possible.
    if (routeOptions.length >= 2) {
      const ranked = enrichAndRankRoutes(routeOptions, routePrefs, roadRules, {
        limit: 5,
      });
      setRouteOptions(ranked);
      selectRoute(ranked[0]);
      return;
    }
    runDirections(stops, travelMode, routePrefs);
  }, [
    routeOptions,
    routePrefs,
    roadRules,
    selectRoute,
    runDirections,
    stops,
    travelMode,
  ]);

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
    async (latlng) => {
      setCtx(null);

      // Directions: fill empty stop, or insert a mid-waypoint when A/B are set
      // (Feature 3 — tap map to add pins). Route-line drag still owns reshape.
      if (view === "directions") {
        const emptyIdx = stops.findIndex((s) => !s);
        try {
          const place = await reverseGeocode(latlng.lat, latlng.lng);
          rememberPlace(place);
          if (emptyIdx === -1) {
            // Insert before destination so start/end stay anchors.
            const nextStops = [...stops];
            const dest = nextStops.pop();
            nextStops.push(place, dest);
            const nextTexts = [...stopTexts];
            const destText = nextTexts.pop();
            nextTexts.push(place.name, destText);
            setStops(nextStops);
            setStopTexts(nextTexts);
            clearRoutes();
            runDirections(nextStops, travelMode);
            showStatus(`Added stop: ${place.name}`);
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
      stopTexts,
      travelMode,
      showStatus,
      clearRoutes,
      rememberPlace,
      runDirections,
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
      nextStops[index] = place;
      setStops(nextStops);
      setStopTexts((prev) => {
        const next = [...prev];
        next[index] = place.isCurrentLocation ? "Your location" : place.name;
        return next;
      });
      clearRoutes();
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
          travelMode,
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

  const commitVia = useCallback(
    (snapped, segmentIndex) =>
      enqueueEdit(async () => {
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
    [enqueueEdit, rebuildFromVias],
  );

  const moveVia = useCallback(
    (viaId, snapped) =>
      enqueueEdit(async () => {
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
    [enqueueEdit, rebuildFromVias],
  );

  const deleteVia = useCallback(
    (viaId) =>
      enqueueEdit(async () => {
        const next = editViasRef.current.filter((v) => v.id !== viaId);
        setSelectedViaId(null);
        await rebuildFromVias(next, { pushHistory: true, preserveOrder: true });
      }),
    [enqueueEdit, rebuildFromVias],
  );

  const ensureEditSession = useCallback(() => {
    setShowSteps(false);
    setNavigating(false);
    const selected =
      routeOptionsRef.current.find(
        (r) => r.id === selectedRouteIdRef.current,
      ) || baselineRoute;
    if (selected && !baselineRoute) setBaselineRoute(selected);
    if (!selected?.edited && editViasRef.current.length === 0) {
      const seeded = seedViasFromStops(stops);
      editViasRef.current = seeded;
      setEditVias(seeded);
    }
  }, [baselineRoute, stops]);

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
    async (latlng, { roadName = null, reshapeRoute = true } = {}) => {
      let name = roadName;
      let focus = { lat: latlng.lat, lng: latlng.lng };
      try {
        const snapped = await nearestRoadPoint(
          latlng.lat,
          latlng.lng,
          travelMode,
        );
        focus = { lat: snapped.lat, lng: snapped.lng };
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
        const snapped = await nearestRoadPoint(hit.lat, hit.lng, travelMode);
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
  const rerouteAroundCorridor = useCallback(async () => {
    const geometry = routeGeometryRef.current;
    if (!geometry?.length) throw new Error("Get directions first");
    const mid = geometryMidpoint(geometry);
    if (!mid) throw new Error("No route to adjust");
    ensureEditSession();
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
  }, [ensureEditSession, enqueueEdit, rebuildFromVias]);

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

  const finishRouteEdits = useCallback(() => {
    setEditPreview(null);
    setSelectedViaId(null);
    setEditCoachOpen(false);
    setPanelOpen(true);
    setShowSteps(false);
    setNavigating(false);
  }, []);

  // Once the user makes an edit, the coach tip is no longer needed.
  useEffect(() => {
    if (editHistory.length > 0) setEditCoachOpen(false);
  }, [editHistory.length]);

  // First custom reshape on a phone: brief coach, then tools live in the bar.
  useEffect(() => {
    if (editHistory.length !== 1) return;
    let mobile = false;
    try {
      mobile = window.matchMedia("(max-width: 800px)").matches;
    } catch {
      mobile = false;
    }
    if (mobile) setEditCoachOpen(true);
  }, [editHistory.length]);

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
      const route =
        routeOptionsRef.current.find(
          (r) => r.id === selectedRouteIdRef.current,
        ) || null;
      if (!route?.geometry?.length) {
        showStatus("No route to save");
        return;
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
      setSavedRoutes((prev) => [entry, ...prev.filter((r) => r.name !== entry.name)].slice(0, 24));
      showStatus("Route saved on this device");
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
          const from = stops[0]?.name || "Start";
          const to = stops[stops.length - 1]?.name || "Destination";
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
                  `I couldn’t find “${intent.street}” near this trip. Long-press the map on that road and choose Avoid this road.`,
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
              `Avoiding ${name}. The route now detours around it. You can also right‑click / long‑press a road to block it.`,
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
        travelMode,
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

  const applyRoadRuleAt = useCallback(
    async (latlng, mode) => {
      const road = await resolveRoadAt(latlng);
      setRoadRules((prev) =>
        upsertRoadRule(prev, {
          name: road.name,
          lat: road.lat,
          lng: road.lng,
          mode,
        }),
      );
      // Soft trip avoid still reshapes when "avoid" / "never" and a route is live.
      if (
        (mode === "avoid" || mode === "never") &&
        routeGeometryRef.current?.length
      ) {
        await avoidStreetAt(latlng, {
          roadName: road.name,
          reshapeRoute: true,
        });
      } else if (mode === "prefer" && routeGeometryRef.current?.length) {
        try {
          await preferStreetNamed(road.name);
        } catch {
          /* keep list update even if prefer snap fails */
        }
      }
      // Re-rank cards so Prefer/Avoid/Never change recommendation order.
      setRouteOptions((prev) => {
        if (prev.length < 2) return prev;
        return enrichAndRankRoutes(prev, routePrefs, [
          ...roadRules.filter(
            (r) => r.name.toLowerCase() !== road.name.toLowerCase(),
          ),
          { name: road.name, mode, lat: road.lat, lng: road.lng, id: "tmp" },
        ]);
      });
      return road.name;
    },
    [resolveRoadAt, avoidStreetAt, preferStreetNamed, routePrefs, roadRules],
  );

  const ctxActions = ctx
    ? [
        {
          id: "prefer-road",
          label: "Prefer this road",
          onClick: async () => {
            try {
              const name = await applyRoadRuleAt(ctx.latlng, "prefer");
              showStatus(`Preferring ${name}`);
            } catch (err) {
              showStatus(err.message || "Could not set road rule");
            }
          },
        },
        {
          id: "avoid-road",
          label: "Avoid this road",
          onClick: async () => {
            try {
              const name = await applyRoadRuleAt(ctx.latlng, "avoid");
              showStatus(`Avoiding ${name}`);
            } catch (err) {
              showStatus(err.message || "Could not set road rule");
            }
          },
        },
        {
          id: "never-road",
          label: "Never use this road",
          onClick: async () => {
            try {
              const name = await applyRoadRuleAt(ctx.latlng, "never");
              showStatus(`Never use ${name}`);
            } catch (err) {
              showStatus(err.message || "Could not set road rule");
            }
          },
        },
        {
          id: "directions-to",
          label: "Directions to here",
          onClick: async () => {
            const place = await reverseGeocode(
              ctx.latlng.lat,
              ctx.latlng.lng,
            ).catch(() => ({
              name: "Point",
              display_name: "Selected point",
              lat: ctx.latlng.lat,
              lng: ctx.latlng.lng,
            }));
            openDirections({ to: place });
          },
        },
        {
          id: "directions-from",
          label: "Directions from here",
          onClick: async () => {
            const place = await reverseGeocode(
              ctx.latlng.lat,
              ctx.latlng.lng,
            ).catch(() => ({
              name: "Point",
              display_name: "Selected point",
              lat: ctx.latlng.lat,
              lng: ctx.latlng.lng,
            }));
            openDirections({ from: place });
          },
        },
        {
          id: "road-rules",
          label: "Your road rules",
          onClick: () => {
            setRoadRulesOpen(true);
            setPanelOpen(true);
          },
        },
      ]
    : [];

  const mapMode = view === "directions" ? "directions" : "explore";
  const selectedRoute =
    routeOptions.find((r) => r.id === selectedRouteId) || null;

  const startNavigation = useCallback(async () => {
    if (!selectedRoute?.steps?.length && !selectedRoute?.geometry?.length) {
      showStatus("No route to start");
      return;
    }
    setShowSteps(false);
    setNavigating(true);
    setPanelOpen(false);
    setRerouteSuggestion(null);
    setAcceptedReroute(false);
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
    setNavOriginalRoute(null);
  }, []);

  /**
   * Feature 6: mid-nav reroute interruption.
   * Auto-demo ~5s after Start; also triggerable via "Simulate reroute".
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
    if (!navigating || !selectedRoute || rerouteSuggestion || acceptedReroute) {
      return undefined;
    }
    const t = setTimeout(() => {
      offerRerouteDemo();
    }, 5000);
    return () => clearTimeout(t);
  }, [
    navigating,
    selectedRoute,
    rerouteSuggestion,
    acceptedReroute,
    offerRerouteDemo,
  ]);

  const acceptReroute = useCallback(async () => {
    const suggestion = rerouteSuggestion;
    setRerouteSuggestion(null);
    if (!suggestion) return;
    if (suggestion.altRoute) {
      selectRoute(suggestion.altRoute, { keepNavigating: true });
      setAcceptedReroute(true);
      setNavStepIndex(0);
      return;
    }
    try {
      await rerouteAroundCorridor();
      setAcceptedReroute(true);
      setNavStepIndex(0);
    } catch (err) {
      showStatus(err.message || "Could not reroute");
    }
  }, [rerouteSuggestion, selectRoute, rerouteAroundCorridor, showStatus]);

  const rejectReroute = useCallback(() => {
    setRerouteSuggestion(null);
  }, []);

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
    Boolean(editOrigin) &&
    Boolean(editDestination) &&
    Boolean(routeGeometry?.length > 1);
  const freezeFit =
    editHistory.length > 0 ||
    Boolean(editPreview?.active) ||
    editBusy;
  const showEditBar =
    !panelOpen && !navigating && hasCustomEdits && Boolean(selectedRoute);

  const fitPadding = useMemo(() => {
    const mobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 800px)").matches;
    if (!panelOpen) {
      return { top: 72, right: 72, bottom: 72, left: 72 };
    }
    if (mobile) {
      return { top: 280, right: 28, bottom: 56, left: 28 };
    }
    return { top: 48, right: 72, bottom: 48, left: 420 };
  }, [panelOpen]);

  return (
    <div
      className={`app ${panelOpen ? "" : "panel-collapsed"} ${navigating ? "nav-mode" : ""}`}
    >
      <aside className="panel m3-surface" aria-label="Map tools">
        <header className="panel-header">
          <div className="brand">
            <img
              className="brand-logo"
              src={`${import.meta.env.BASE_URL}favicon.svg`}
              alt=""
              width="32"
              height="32"
            />
            <span className="brand-name">Maps</span>
          </div>
          <ActionTip tip="Collapse panel">
            <md-icon-button
              type="button"
              class="collapse-panel-btn"
              onClick={() => setPanelOpen(false)}
              aria-label="Collapse panel"
            >
              <md-icon>{isCompact ? "expand_less" : "chevron_left"}</md-icon>
            </md-icon-button>
          </ActionTip>
        </header>

        {view === "search" && (
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
            blockedStreets={blockedStreets}
            onRemoveBlocked={removeBlockedStreet}
            onClearBlocked={() => setBlockedStreets([])}
            savedTab={savedTab}
            onSavedTab={setSavedTab}
            onClear={() => {
              setSearchQuery("");
              setSelectedPlace(null);
            }}
            onDirectionsTo={() => {
              if (!selectedPlace) return;
              openDirections({ to: selectedPlace });
            }}
            onDirectionsFrom={() => {
              if (!selectedPlace) return;
              openDirections({ from: selectedPlace });
            }}
          />
        )}

        {view === "directions" && showSteps && selectedRoute && (
          <StepsSheet
            route={selectedRoute}
            embedded
            className="steps-in-panel"
            onClose={() => setShowSteps(false)}
            onStart={startNavigation}
          />
        )}

        {view === "directions" && (
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
            onClose={() => {
              setView("search");
              clearRoutes();
            }}
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
            canUndo={editHistory.length > 0}
            onUndo={undoEdit}
            canReset={canReset}
            onResetSuggested={resetToSuggested}
            comparison={hasCustomEdits ? comparison : null}
            editBusy={editBusy || Boolean(editPreview?.active)}
            onShowSteps={() => setShowSteps(true)}
            onSaveRoute={saveCurrentRoute}
            onOpenAssistant={() => setAssistantOpen(true)}
            onOpenPrefs={() => setPrefsOpen(true)}
            onOpenRoadRules={() => setRoadRulesOpen(true)}
            hasCustomEdits={hasCustomEdits}
          />
        )}
      </aside>

      {showEditBar && (
        <div
          className="mobile-edit-bar"
          role="toolbar"
          aria-label="Route edit actions"
        >
          <ActionTip tip="Undo last edit (Ctrl+Z)">
            <md-icon-button
              type="button"
              class="mobile-edit-undo"
              aria-label="Undo last edit"
              onClick={undoEdit}
              disabled={editHistory.length === 0 || undefined}
            >
              <md-icon>undo</md-icon>
            </md-icon-button>
          </ActionTip>
          <ActionTip tip="Reset to original route">
            <md-icon-button
              type="button"
              class="mobile-edit-reset"
              aria-label="Reset to original route"
              onClick={resetToSuggested}
              disabled={!canReset || undefined}
            >
              <md-icon>restart_alt</md-icon>
            </md-icon-button>
          </ActionTip>
          {comparison ? (
            <span
              className={`mobile-edit-comparison tone-${comparison.tone}`}
              title={comparison.label}
            >
              <span className="mobile-edit-comparison-value md-typescale-label-medium">
                {editBusy || editPreview?.active
                  ? "Updating…"
                  : comparison.shortLabel}
              </span>
              {!editBusy && !editPreview?.active ? (
                <span className="mobile-edit-comparison-detail">
                  {comparison.detailLabel}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="mobile-edit-spacer" aria-hidden />
          )}
          <button
            type="button"
            className="mobile-edit-done"
            aria-label="Done editing"
            onClick={finishRouteEdits}
          >
            Done
          </button>
        </div>
      )}

      {editCoachOpen && isCompact && showEditBar && (
        <div className="edit-coach" role="status">
          <md-icon class="edit-coach-icon">touch_app</md-icon>
          <p className="edit-coach-text md-typescale-body-medium">
            Drag the blue route to bend it. Travel time updates in the bar
            above. Tap Done to review the new steps.
          </p>
          <button
            type="button"
            className="edit-coach-dismiss"
            onClick={() => setEditCoachOpen(false)}
          >
            Got it
          </button>
        </div>
      )}

      {!panelOpen && (
        <ActionTip tip="Open panel" className="expand-panel-tip">
          <md-icon-button
            type="button"
            class="expand-panel"
            aria-label="Open panel"
            onClick={() => setPanelOpen(true)}
          >
            <md-icon>{isCompact ? "expand_more" : "chevron_right"}</md-icon>
          </md-icon-button>
        </ActionTip>
      )}

      <main className="map-stage">
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
            waypoints: view === "directions" ? filledStops : [],
            geometry: null,
            alternatives: [],
          }}
          routeOptions={view === "directions" ? routeOptions : []}
          selectedRouteId={selectedRouteId}
          onSelectRoute={(opt) => {
            selectRoute(opt);
          }}
          routeEditable={routeEditable}
          freezeFit={freezeFit}
          editOrigin={editOrigin}
          editDestination={editDestination}
          editVias={editVias}
          editTravelMode={travelMode}
          selectedViaId={selectedViaId}
          onSelectVia={setSelectedViaId}
          onEditPreview={setEditPreview}
          onCommitVia={commitVia}
          onMoveVia={moveVia}
          onDeleteVia={deleteVia}
          onEditError={(msg) => showStatus(msg)}
          flyTarget={flyTarget}
          fitKey={fitKey}
          fitPadding={fitPadding}
          onMapClick={handleMapClick}
          onContextMenu={(latlng, pos) => {
            setCtx({ latlng, ...pos });
          }}
          onWaypointDrag={async (index, lat, lng) => {
            try {
              const place = await reverseGeocode(lat, lng);
              setStopPlace(index, place);
              rememberPlace(place);
            } catch {
              setStopPlace(index, {
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
            <ActionTip tip="Map">
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
            <ActionTip tip="Satellite">
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
            <ActionTip tip="Zoom in">
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
            <ActionTip tip="Zoom out">
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

        {view === "directions" && selectedRoute && !showEditBar && (
          <>
            {navigating && !showSteps && (
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
                onDemoReroute={
                  !rerouteSuggestion && !acceptedReroute
                    ? offerRerouteDemo
                    : null
                }
              />
            )}
            {!navigating && !showSteps && selectedRoute.steps?.length > 0 && (
              <button
                type="button"
                className="steps-fab"
                aria-label="Steps"
                onClick={() => {
                  setShowSteps(true);
                  setPanelOpen(false);
                }}
              >
                Steps
              </button>
            )}
            {showSteps && (
              <StepsSheet
                route={selectedRoute}
                className="steps-bottom-sheet"
                onClose={() => setShowSteps(false)}
                onStart={startNavigation}
              />
            )}
          </>
        )}

        {status && !navigating && (
          <div className="map-status md-typescale-label-large" role="status">
            {status}
          </div>
        )}
      </main>

      <ContextMenu
        position={ctx}
        onClose={() => setCtx(null)}
        actions={ctxActions}
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
        onChange={setRoutePrefs}
        onClose={() => setPrefsOpen(false)}
        onApply={applyPrefsToRoutes}
      />

      <RoadRulesSheet
        open={roadRulesOpen}
        rules={roadRules}
        onClose={() => setRoadRulesOpen(false)}
        onRemove={(id) => setRoadRules((prev) => removeRoadRule(prev, id))}
        onSetMode={(id, mode) =>
          setRoadRules((prev) =>
            prev.map((r) => (r.id === id ? { ...r, mode, updatedAt: Date.now() } : r)),
          )
        }
      />

      {view === "directions" &&
        selectedRoute &&
        !assistantOpen &&
        !prefsOpen &&
        !roadRulesOpen &&
        !showEditBar &&
        !navigating && (
        <ActionTip tip="Ask route assistant" className="assistant-fab-tip">
          <button
            type="button"
            className="assistant-fab"
            aria-label="Ask route assistant"
            onClick={() => setAssistantOpen(true)}
          >
            <md-icon>auto_awesome</md-icon>
          </button>
        </ActionTip>
      )}
    </div>
  );
}
