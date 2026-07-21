import { useCallback, useEffect, useRef, useState } from "react";
import MapView from "./components/MapView";
import SearchPanel from "./components/SearchPanel";
import DirectionsPanel from "./components/DirectionsPanel";
import NavigationUI from "./components/NavigationUI";
import StepsSheet from "./components/StepsSheet";
import ContextMenu from "./components/ContextMenu";
import { reverseGeocode, haversineMeters } from "./api/geocode";
import {
  closestPointOnPolyline,
  fetchShortestRoutes,
  rebuildEditedRoute,
} from "./api/routing";
import { placeLabel } from "./utils/format";
import {
  comparisonVsSuggested,
  seedViasFromStops,
} from "./utils/routeEdit";
import { loadRecentSearches, pushRecentSearch } from "./utils/storage";
import useGeolocation, { toCurrentLocationPlace } from "./hooks/useGeolocation";
import "./App.css";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyStops() {
  return [null, null];
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
  const [editMode, setEditMode] = useState(false);
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

  const [flyTarget, setFlyTarget] = useState(null);
  const [fitKey, setFitKey] = useState(0);
  const [ctx, setCtx] = useState(null);
  const locateFn = useRef(null);
  const zoomFn = useRef(null);
  const editViasRef = useRef([]);
  const routeGeometryRef = useRef(null);
  const selectedRouteIdRef = useRef(null);
  const routeOptionsRef = useRef([]);
  const editCommitChain = useRef(Promise.resolve());

  const {
    location: userLocation,
    status: geoStatus,
    error: geoError,
    refresh: refreshLocation,
    takeCenteredOnce,
  } = useGeolocation({ autoStart: true });

  const showStatus = useCallback((message, ms = 2800) => {
    setStatus(message);
    clearTimeout(statusTimer.current);
    if (ms > 0) {
      statusTimer.current = setTimeout(() => setStatus(null), ms);
    }
  }, []);

  useEffect(() => () => clearTimeout(statusTimer.current), []);

  editViasRef.current = editVias;
  routeGeometryRef.current = routeGeometry;
  selectedRouteIdRef.current = selectedRouteId;
  routeOptionsRef.current = routeOptions;

  useEffect(() => {
    if (!userLocation) return;
    if (!takeCenteredOnce()) return;
    setFlyTarget({
      lat: userLocation.lat,
      lng: userLocation.lng,
      zoom: 15,
    });
    showStatus("Centered on your location");
  }, [userLocation, takeCenteredOnce, showStatus]);

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

  const clearEditState = useCallback(() => {
    setEditMode(false);
    setBaselineRoute(null);
    editViasRef.current = [];
    setEditVias([]);
    setEditHistory([]);
    setEditPreview(null);
    setEditBusy(false);
    setNavigating(false);
    setNavStepIndex(0);
    setShowSteps(false);
  }, []);

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

  const applyEditedRoute = useCallback((route, vias, { pushHistory = true } = {}) => {
    const edited = {
      ...route,
      id: `edited-${Math.round(route.distance)}-${Math.round(route.duration)}-${vias.length}-${Date.now()}`,
      label: vias.length
        ? `Custom · ${vias.length} drag point${vias.length === 1 ? "" : "s"}`
        : route.label || "Custom route",
      badge: "Edited route",
      rank: 0,
      edited: true,
    };

    if (pushHistory) {
      setEditHistory((prev) => [
        ...prev,
        {
          vias: editViasRef.current,
          routeId: selectedRouteIdRef.current,
          geometry: routeGeometryRef.current,
          options: routeOptionsRef.current,
        },
      ]);
    }

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
  }, []);

  const selectRoute = useCallback((opt) => {
    if (!opt) return;
    selectedRouteIdRef.current = opt.id;
    setSelectedRouteId(opt.id);
    routeGeometryRef.current = opt.geometry;
    setRouteGeometry(opt.geometry);
    setRouteLocked(true);
    setNavigating(false);
    setNavStepIndex(0);
    setShowSteps(false);
    if (!opt.edited) {
      setBaselineRoute(opt);
      editViasRef.current = [];
      setEditVias([]);
      setEditHistory([]);
      setEditPreview(null);
    }
  }, []);

  const runDirections = useCallback(
    async (nextStops = stops, mode = travelMode) => {
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
      showStatus("Finding shortest routes…", 0);
      try {
        let options;
        try {
          options = await fetchShortestRoutes(filled, mode, { limit: 5 });
        } catch {
          await new Promise((r) => setTimeout(r, 600));
          options = await fetchShortestRoutes(filled, mode, { limit: 5 });
        }
        setRouteOptions(options);
        setBaselineRoute(options[0]);
        selectRoute(options[0]);
        showStatus(
          `${options.length} shortest option${options.length === 1 ? "" : "s"}`,
        );
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
      userLocation,
      showStatus,
      selectRoute,
      clearRoutes,
      clearEditState,
    ],
  );

  const openDirections = useCallback(
    ({ from = null, to = null } = {}) => {
      const nextStops = [from, to];
      const nextTexts = [
        from ? (from.isCurrentLocation ? "Your location" : from.name) : "",
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
    [clearRoutes, runDirections, travelMode],
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

      // Edit mode uses drag-to-reshape — ignore plain clicks on the map.
      if (view === "directions" && editMode) {
        return;
      }

      if (view === "directions") {
        const emptyIdx = stops.findIndex((s) => !s);
        if (emptyIdx === -1) {
          showStatus("Use Add Stops or Edit route to change the path");
          return;
        }
        try {
          const place = await reverseGeocode(latlng.lat, latlng.lng);
          rememberPlace(place);
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
      editMode,
      stops,
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
      setEditBusy(true);
      showStatus("Recalculating shortest route…", 0);
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
        applyEditedRoute(route, ordered, { pushHistory });
        showStatus("Shortest route via your points");
      } catch (err) {
        showStatus(err.message || "Could not update route");
      } finally {
        setEditBusy(false);
      }
    },
    [
      editOrigin,
      editDestination,
      baselineRoute,
      travelMode,
      applyEditedRoute,
      showStatus,
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
        showStatus(next.length ? "Removed via point" : "Via point removed");
      }),
    [enqueueEdit, rebuildFromVias, showStatus],
  );

  const undoEdit = useCallback(() => {
    setEditHistory((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const snapshot = next.pop();
      const vias = snapshot.vias || [];
      editViasRef.current = vias;
      setEditVias(vias);
      if (snapshot.options) {
        routeOptionsRef.current = snapshot.options;
        setRouteOptions(snapshot.options);
      }
      if (snapshot.routeId) {
        selectedRouteIdRef.current = snapshot.routeId;
        setSelectedRouteId(snapshot.routeId);
      }
      if (snapshot.geometry) {
        routeGeometryRef.current = snapshot.geometry;
        setRouteGeometry(snapshot.geometry);
      }
      setEditPreview(null);
      showStatus("Undid last edit");
      return next;
    });
  }, [showStatus]);

  const resetToSuggested = useCallback(() => {
    if (!baselineRoute) return;
    const seeded = seedViasFromStops(stops);
    editViasRef.current = seeded;
    setEditVias(seeded);
    setEditHistory([]);
    setEditPreview(null);
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
    setFitKey((k) => k + 1);
    showStatus("Reset to suggested route");
  }, [baselineRoute, stops, showStatus]);

  const toggleEditMode = useCallback(() => {
    setEditMode((v) => {
      const next = !v;
      if (next) {
        const selected =
          routeOptionsRef.current.find(
            (r) => r.id === selectedRouteIdRef.current,
          ) || baselineRoute;
        if (selected && !baselineRoute) setBaselineRoute(selected);
        if (!selected?.edited) {
          const seeded = seedViasFromStops(stops);
          editViasRef.current = seeded;
          setEditVias(seeded);
        }
        setEditPreview(null);
        showStatus("Drag the route line to reshape it");
      } else {
        setEditPreview(null);
        setSelectedViaId(null);
      }
      return next;
    });
  }, [baselineRoute, stops, showStatus]);

  // Delete / Backspace removes the selected via (or the last via) in edit mode.
  useEffect(() => {
    if (!editMode) return undefined;
    function onKeyDown(e) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = e.target?.tagName?.toLowerCase?.();
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      const id =
        selectedViaId ||
        editViasRef.current[editViasRef.current.length - 1]?.id;
      if (id) deleteVia(id);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editMode, selectedViaId, deleteVia]);

  const goToMyLocation = useCallback(async () => {
    // If we already have a fix (browser / magic base location), recenter now.
    if (userLocation?.lat != null && userLocation?.lng != null) {
      locateFn.current?.([userLocation.lat, userLocation.lng], 16);
    } else {
      showStatus("Locating…", 0);
    }

    try {
      const loc = await refreshLocation();
      if (loc?.lat != null && loc?.lng != null) {
        locateFn.current?.([loc.lat, loc.lng], 16);
        showStatus("Centered on your location");
        return;
      }
      throw new Error("no location");
    } catch {
      if (userLocation?.lat != null && userLocation?.lng != null) {
        locateFn.current?.([userLocation.lat, userLocation.lng], 16);
        showStatus("Centered on your location");
        return;
      }
      showStatus(geoError || "Could not get your location");
    }
  }, [refreshLocation, geoError, showStatus, userLocation]);

  const ctxActions = ctx
    ? [
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
    setNavStepIndex(0);
    setNavigating(true);
    setPanelOpen(false);
    setEditMode(false);
    try {
      const loc = userLocation || (await refreshLocation().catch(() => null));
      if (loc) {
        setFlyTarget({ lat: loc.lat, lng: loc.lng, zoom: 17 });
      } else if (selectedRoute.geometry?.[0]) {
        const [lat, lng] = selectedRoute.geometry[0];
        setFlyTarget({ lat, lng, zoom: 16 });
      }
      showStatus("Navigation started");
    } catch {
      showStatus("Navigation started");
    }
  }, [selectedRoute, userLocation, refreshLocation, showStatus]);

  const exitNavigation = useCallback(() => {
    setNavigating(false);
    setNavStepIndex(0);
    setShowSteps(false);
    setPanelOpen(true);
    showStatus("Navigation ended");
  }, [showStatus]);

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

  return (
    <div
      className={`app ${panelOpen ? "" : "panel-collapsed"} ${navigating ? "nav-mode" : ""}`}
    >
      <aside className="panel m3-surface" aria-label="Map tools">
        <header className="panel-header">
          <div className="brand">
            <img
              className="brand-logo"
              src="/favicon.svg"
              alt=""
              width="28"
              height="28"
            />
            <span className="brand-name md-typescale-title-large">Atlas</span>
          </div>
          <md-icon-button
            type="button"
            class="collapse-panel-btn"
            onClick={() => setPanelOpen(false)}
            aria-label="Collapse panel"
            title="Collapse panel"
          >
            <md-icon class="collapse-icon-desktop">chevron_left</md-icon>
            <md-icon class="collapse-icon-mobile">keyboard_arrow_up</md-icon>
          </md-icon-button>
        </header>

        {view === "search" && (
          <SearchPanel
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSelectPlace={selectSearchPlace}
            place={selectedPlace}
            recentPlaces={recentPlaces}
            near={userLocation}
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
            onSwap={swapStops}
            onClose={() => {
              setView("search");
              clearRoutes();
            }}
            routeOptions={routeOptions}
            selectedRouteId={selectedRouteId}
            onSelectRoute={(opt) => {
              if (editMode) return;
              selectRoute(opt);
              showStatus(opt.badge || opt.label);
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
                showStatus("Location found");
                return loc;
              } catch {
                if (userLocation?.lat != null) {
                  showStatus("Using your last known location");
                  return userLocation;
                }
                showStatus(geoError || "Could not get your location");
                throw new Error("location");
              }
            }}
            editMode={editMode}
            onToggleEdit={toggleEditMode}
            canUndo={editHistory.length > 0}
            onUndo={undoEdit}
            canReset={canReset}
            onResetSuggested={resetToSuggested}
            comparison={editMode ? comparison : null}
            editBusy={editBusy || Boolean(editPreview?.active)}
            onShowSteps={() => setShowSteps(true)}
          />
        )}
      </aside>

      {!panelOpen && (
        <md-fab
          class="expand-panel"
          variant="primary"
          size="medium"
          aria-label="Open panel"
          onClick={() => setPanelOpen(true)}
        >
          <md-icon slot="icon">menu</md-icon>
        </md-fab>
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
            if (editMode) return;
            selectRoute(opt);
            showStatus(`Selected: ${opt.badge || opt.label}`);
          }}
          editMode={view === "directions" && editMode}
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
          onMapClick={handleMapClick}
          onContextMenu={(latlng, pos) => setCtx({ latlng, ...pos })}
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
            <button
              type="button"
              className={layer === "map" ? "map-ctrl-btn is-selected" : "map-ctrl-btn"}
              aria-label="Map"
              title="Map"
              aria-pressed={layer === "map" ? "true" : "false"}
              onClick={() => setLayer("map")}
            >
              <md-icon>map</md-icon>
            </button>
            <button
              type="button"
              className={
                layer === "satellite" ? "map-ctrl-btn is-selected" : "map-ctrl-btn"
              }
              aria-label="Satellite"
              title="Satellite"
              aria-pressed={layer === "satellite" ? "true" : "false"}
              onClick={() => setLayer("satellite")}
            >
              <md-icon>satellite_alt</md-icon>
            </button>
            <button
              type="button"
              className={`map-ctrl-btn locate-btn ${geoStatus === "ready" ? "is-located" : ""}`}
              aria-label="My location"
              title="My location"
              onClick={goToMyLocation}
            >
              <md-icon>my_location</md-icon>
            </button>
            <button
              type="button"
              className="map-ctrl-btn"
              aria-label="Zoom in"
              title="Zoom in"
              onClick={() => zoomFn.current?.zoomIn?.()}
            >
              <md-icon>add</md-icon>
            </button>
            <button
              type="button"
              className="map-ctrl-btn"
              aria-label="Zoom out"
              title="Zoom out"
              onClick={() => zoomFn.current?.zoomOut?.()}
            >
              <md-icon>remove</md-icon>
            </button>
          </div>
        </div>

        {view === "directions" && selectedRoute && !editMode && (
          <>
            {navigating && !showSteps && (
              <NavigationUI
                active={navigating}
                route={selectedRoute}
                currentStepIndex={navStepIndex}
                onExit={exitNavigation}
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
                <md-icon>list</md-icon>
                <span>Steps</span>
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
    </div>
  );
}
