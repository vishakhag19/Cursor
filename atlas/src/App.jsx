import { useCallback, useEffect, useRef, useState } from "react";
import MapView from "./components/MapView";
import ExplorePanel from "./components/ExplorePanel";
import DirectionsPanel from "./components/DirectionsPanel";
import CreateRoutePanel from "./components/CreateRoutePanel";
import ContextMenu from "./components/ContextMenu";
import MdTabs from "./components/MdTabs";
import { reverseGeocode } from "./api/geocode";
import { fetchRouteOptions, buildCustomRouteOptions } from "./api/routing";
import { placeLabel } from "./utils/format";
import { loadSavedRoutes, persistSavedRoutes } from "./utils/storage";
import useGeolocation, { toCurrentLocationPlace } from "./hooks/useGeolocation";
import "./App.css";

const MODES = [
  { id: "explore", label: "Explore" },
  { id: "directions", label: "Directions" },
  { id: "create", label: "Create route" },
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const [mode, setMode] = useState("explore");
  const [panelOpen, setPanelOpen] = useState(true);
  const [layer, setLayer] = useState("map");
  const [status, setStatus] = useState(null);
  const statusTimer = useRef(null);

  const [exploreQuery, setExploreQuery] = useState("");
  const [searchMarker, setSearchMarker] = useState(null);

  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [dirFrom, setDirFrom] = useState(null);
  const [dirTo, setDirTo] = useState(null);
  const [dirSummary, setDirSummary] = useState(null);
  const [dirGeometry, setDirGeometry] = useState(null);
  const [dirOptions, setDirOptions] = useState([]);
  const [dirSelectedId, setDirSelectedId] = useState(null);
  const [dirLocked, setDirLocked] = useState(false);
  const [dirPrefer, setDirPrefer] = useState("time");
  const [dirLoading, setDirLoading] = useState(false);
  const [dirError, setDirError] = useState(null);

  const [routeName, setRouteName] = useState("");
  const [waypoints, setWaypoints] = useState([]);
  const [travelMode, setTravelMode] = useState("driving");
  const [snapToRoads, setSnapToRoads] = useState(true);
  const [createPrefer, setCreatePrefer] = useState("distance");
  const [createSummary, setCreateSummary] = useState(null);
  const [createGeometry, setCreateGeometry] = useState(null);
  const [createOptions, setCreateOptions] = useState([]);
  const [createSelectedId, setCreateSelectedId] = useState(null);
  const [createLocked, setCreateLocked] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [savedRoutes, setSavedRoutes] = useState(() => loadSavedRoutes());

  const [flyTarget, setFlyTarget] = useState(null);
  const [fitKey, setFitKey] = useState(0);
  const [ctx, setCtx] = useState(null);
  const locateFn = useRef(null);
  const prefilledFromLocation = useRef(false);

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

  useEffect(() => {
    persistSavedRoutes(savedRoutes);
  }, [savedRoutes]);

  // Center map on the user once when location first becomes available.
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

  // Prefill directions "from" with current location the first time we get it.
  useEffect(() => {
    if (!userLocation || prefilledFromLocation.current) return;
    prefilledFromLocation.current = true;
    const place = toCurrentLocationPlace(userLocation);
    setDirFrom(place);
    setFromText(place.name);
  }, [userLocation]);

  // Keep live "Your location" points in sync — but never while a route is locked
  // (avoids mid-trip redirects against the user's will).
  useEffect(() => {
    if (!userLocation) return;
    if (dirLocked || createLocked) return;
    const place = toCurrentLocationPlace(userLocation);

    setDirFrom((prev) => (prev?.isCurrentLocation ? { ...place } : prev));
    setDirTo((prev) => (prev?.isCurrentLocation ? { ...place } : prev));
    setWaypoints((prev) => {
      let changed = false;
      const next = prev.map((wp) => {
        if (!wp.isCurrentLocation) return wp;
        changed = true;
        return {
          ...wp,
          lat: place.lat,
          lng: place.lng,
          accuracy: place.accuracy,
        };
      });
      return changed ? next : prev;
    });
  }, [userLocation, dirLocked, createLocked]);

  const invalidateCreateRoute = useCallback(() => {
    setCreateSummary(null);
    setCreateGeometry(null);
    setCreateError(null);
    setCreateOptions([]);
    setCreateSelectedId(null);
    setCreateLocked(false);
  }, []);

  const clearDirRoute = useCallback(() => {
    setDirSummary(null);
    setDirGeometry(null);
    setDirOptions([]);
    setDirSelectedId(null);
    setDirLocked(false);
    setDirError(null);
  }, []);

  const applySelectedRoute = useCallback((opt, kind) => {
    if (!opt) return;
    if (kind === "directions") {
      setDirSelectedId(opt.id);
      setDirGeometry(opt.geometry);
      setDirSummary({ distance: opt.distance, duration: opt.duration });
      setFitKey((k) => k + 1);
    } else {
      setCreateSelectedId(opt.id);
      setCreateGeometry(opt.geometry);
      setCreateSummary({ distance: opt.distance, duration: opt.duration });
      setFitKey((k) => k + 1);
    }
  }, []);

  const selectExplorePlace = useCallback(
    (place) => {
      setExploreQuery(place.name);
      setSearchMarker(place);
      setFlyTarget({ lat: place.lat, lng: place.lng, zoom: 14 });
      showStatus(placeLabel(place));
    },
    [showStatus],
  );

  const runDirections = useCallback(
    async (from = dirFrom, to = dirTo, prefer = dirPrefer) => {
      if (!from || !to) {
        setDirError("Choose a start and destination");
        return;
      }
      setDirLoading(true);
      setDirError(null);
      showStatus("Finding route options…", 0);
      try {
        const options = await fetchRouteOptions([from, to], "driving", {
          alternatives: true,
          prefer,
        });
        setDirOptions(options);
        applySelectedRoute(options[0], "directions");
        setDirLocked(true);
        showStatus(`${options.length} route option${options.length === 1 ? "" : "s"} ready — pick one`);
      } catch (err) {
        clearDirRoute();
        setDirError(err.message || "Could not find a route");
        showStatus(err.message || "Could not find a route");
      } finally {
        setDirLoading(false);
      }
    },
    [dirFrom, dirTo, dirPrefer, showStatus, applySelectedRoute, clearDirRoute],
  );

  const buildCustomRoute = useCallback(
    async (wps = waypoints) => {
      if (wps.length < 2) {
        setCreateError("Add at least two stops");
        return;
      }
      setCreateLoading(true);
      setCreateError(null);
      showStatus("Building your route options…", 0);
      try {
        const options = await buildCustomRouteOptions(wps, travelMode, {
          prefer: createPrefer,
          snapToRoads,
        });
        setCreateOptions(options);
        applySelectedRoute(options[0], "create");
        setCreateLocked(true);
        showStatus(
          `${options.length} custom option${options.length === 1 ? "" : "s"} — locked until you change it`,
        );
      } catch (err) {
        setCreateError(err.message || "Could not build route");
        showStatus(err.message || "Could not build route");
      } finally {
        setCreateLoading(false);
      }
    },
    [waypoints, snapToRoads, travelMode, createPrefer, showStatus, applySelectedRoute],
  );

  const addWaypoint = useCallback(
    async (lat, lng, placeHint = null) => {
      let place = placeHint;
      if (!place) {
        try {
          place = await reverseGeocode(lat, lng);
        } catch {
          place = {
            id: uid(),
            name: "Dropped pin",
            display_name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            lat,
            lng,
          };
        }
      }
      const wp = {
        id: place.isCurrentLocation ? `current-${uid()}` : uid(),
        name: place.name,
        display_name: place.display_name,
        lat: place.lat ?? lat,
        lng: place.lng ?? lng,
        isCurrentLocation: Boolean(place.isCurrentLocation),
      };
      setWaypoints((prev) => [...prev, wp]);
      invalidateCreateRoute();
      showStatus(`Stop added: ${placeLabel(wp)}`);
    },
    [invalidateCreateRoute, showStatus],
  );

  const startFromMyLocation = useCallback(async () => {
    try {
      const loc = userLocation || (await refreshLocation());
      const place = toCurrentLocationPlace(loc);
      if (!place) throw new Error("no location");
      setDirFrom(place);
      setFromText(place.name);
      clearDirRoute();
      setFlyTarget({ lat: place.lat, lng: place.lng, zoom: 15 });
      showStatus("Starting from your location");
    } catch {
      showStatus(geoError || "Could not get your location");
    }
  }, [userLocation, refreshLocation, geoError, showStatus, clearDirRoute]);

  const endAtMyLocation = useCallback(async () => {
    try {
      const loc = userLocation || (await refreshLocation());
      const place = toCurrentLocationPlace(loc);
      if (!place) throw new Error("no location");
      setDirTo(place);
      setToText(place.name);
      clearDirRoute();
      showStatus("Destination set to your location");
    } catch {
      showStatus(geoError || "Could not get your location");
    }
  }, [userLocation, refreshLocation, geoError, showStatus, clearDirRoute]);

  const addCurrentLocationStop = useCallback(async () => {
    try {
      const loc = userLocation || (await refreshLocation());
      const place = toCurrentLocationPlace(loc);
      if (!place) throw new Error("no location");
      await addWaypoint(place.lat, place.lng, place);
      setFlyTarget({ lat: place.lat, lng: place.lng, zoom: 15 });
    } catch {
      showStatus(geoError || "Could not get your location");
    }
  }, [userLocation, refreshLocation, addWaypoint, geoError, showStatus]);

  const handleMapClick = useCallback(
    async (latlng) => {
      setCtx(null);
      if (mode === "explore") {
        setPanelOpen(true);
        try {
          const place = await reverseGeocode(latlng.lat, latlng.lng);
          setSearchMarker(place);
          setExploreQuery(place.name);
          showStatus(placeLabel(place));
        } catch {
          const place = {
            id: uid(),
            name: "Dropped pin",
            display_name: `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`,
            lat: latlng.lat,
            lng: latlng.lng,
          };
          setSearchMarker(place);
          setExploreQuery(place.name);
        }
        return;
      }
      if (mode === "create") {
        if (createLocked) {
          showStatus("Route is locked — unlock it to edit stops");
          return;
        }
        await addWaypoint(latlng.lat, latlng.lng);
      }
    },
    [mode, addWaypoint, showStatus, createLocked],
  );

  const handleWaypointDrag = useCallback(
    async (index, lat, lng) => {
      let label;
      try {
        label = await reverseGeocode(lat, lng);
      } catch {
        label = {
          name: "Moved pin",
          display_name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        };
      }
      setWaypoints((prev) =>
        prev.map((wp, i) =>
          i === index
            ? {
                ...wp,
                lat,
                lng,
                name: label.name,
                display_name: label.display_name,
                isCurrentLocation: false,
              }
            : wp,
        ),
      );
      invalidateCreateRoute();
    },
    [invalidateCreateRoute],
  );

  const saveRoute = useCallback(() => {
    if (!createGeometry || waypoints.length < 2) return;
    const name = routeName.trim() || `Route ${savedRoutes.length + 1}`;
    const entry = {
      id: uid(),
      name,
      waypoints,
      geometry: createGeometry,
      stats: createSummary,
      travelMode,
      snapToRoads,
      savedAt: Date.now(),
    };
    setSavedRoutes((prev) => [entry, ...prev]);
    showStatus(`Saved “${name}”`);
  }, [
    createGeometry,
    waypoints,
    routeName,
    savedRoutes.length,
    createSummary,
    travelMode,
    snapToRoads,
    showStatus,
  ]);

  const loadSaved = useCallback(
    (route) => {
      setWaypoints(route.waypoints || []);
      setCreateGeometry(route.geometry || null);
      setCreateSummary(route.stats || null);
      setRouteName(route.name || "");
      setTravelMode(route.travelMode || "driving");
      setSnapToRoads(route.snapToRoads !== false);
      setCreateError(null);
      setCreateOptions(
        route.geometry
          ? [
              {
                id: route.id || "saved",
                label: route.name || "Saved route",
                distance: route.stats?.distance,
                duration: route.stats?.duration,
                geometry: route.geometry,
              },
            ]
          : [],
      );
      setCreateSelectedId(route.id || "saved");
      setCreateLocked(true);
      setFitKey((k) => k + 1);
      showStatus(`Loaded “${route.name}” (locked)`);
    },
    [showStatus],
  );

  const goToMyLocation = useCallback(async () => {
    showStatus("Locating…", 0);
    try {
      const loc = await refreshLocation();
      locateFn.current?.([loc.lat, loc.lng], 16);
      showStatus("Location found");
    } catch {
      showStatus(geoError || "Could not get your location");
    }
  }, [refreshLocation, geoError, showStatus]);

  const ctxActions = ctx
    ? [
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
            setDirFrom(place);
            setFromText(placeLabel(place));
            setMode("directions");
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
            setDirTo(place);
            setToText(placeLabel(place));
            setMode("directions");
          },
        },
        {
          id: "directions-from-me",
          label: "Directions from my location",
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
            setMode("directions");
            setDirTo(place);
            setToText(placeLabel(place));
            await startFromMyLocation();
          },
        },
        {
          id: "add-stop",
          label: "Add stop to route",
          onClick: async () => {
            setMode("create");
            await addWaypoint(ctx.latlng.lat, ctx.latlng.lng);
          },
        },
      ]
    : [];

  return (
    <div className={`app ${panelOpen ? "" : "panel-collapsed"}`}>
      <aside className="panel m3-surface" aria-label="Map tools">
        <header className="panel-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden>
              <md-icon>location_on</md-icon>
            </span>
            <span className="brand-name md-typescale-title-large">Atlas</span>
          </div>
          <md-icon-button
            type="button"
            onClick={() => setPanelOpen(false)}
            aria-label="Collapse panel"
            title="Collapse panel"
          >
            <md-icon>chevron_left</md-icon>
          </md-icon-button>
        </header>

        <MdTabs
          className="mode-tabs"
          aria-label="Map modes"
          activeIndex={MODES.findIndex((m) => m.id === mode)}
          onChange={(index) => {
            const next = MODES[index]?.id;
            if (!next) return;
            setMode(next);
            if (next === "create") {
              showStatus("Create route: click the map to add stops", 3500);
            }
          }}
        >
          {MODES.map((m) => (
            <md-primary-tab key={m.id}>{m.label}</md-primary-tab>
          ))}
        </MdTabs>

        {mode === "explore" && (
          <ExplorePanel
            query={exploreQuery}
            onQueryChange={setExploreQuery}
            onSelectPlace={selectExplorePlace}
            place={searchMarker}
            currentLocation={userLocation}
            onClear={() => {
              setExploreQuery("");
              setSearchMarker(null);
            }}
            onDirectionsFrom={() => {
              if (!searchMarker) return;
              setDirFrom(searchMarker);
              setFromText(placeLabel(searchMarker));
              setMode("directions");
            }}
            onDirectionsTo={() => {
              if (!searchMarker) return;
              setDirTo(searchMarker);
              setToText(placeLabel(searchMarker));
              setMode("directions");
            }}
            onAddToRoute={() => {
              if (!searchMarker) return;
              setMode("create");
              addWaypoint(searchMarker.lat, searchMarker.lng, searchMarker);
            }}
          />
        )}

        {mode === "directions" && (
          <DirectionsPanel
            fromText={fromText}
            toText={toText}
            onFromText={setFromText}
            onToText={setToText}
            onFromSelect={(p) => {
              setDirFrom(p);
              setFromText(p.name);
              if (!p.isCurrentLocation) {
                setFlyTarget({ lat: p.lat, lng: p.lng, zoom: 13 });
              }
              clearDirRoute();
            }}
            onToSelect={(p) => {
              setDirTo(p);
              setToText(p.name);
              if (!p.isCurrentLocation) {
                setFlyTarget({ lat: p.lat, lng: p.lng, zoom: 13 });
              }
              clearDirRoute();
            }}
            onSwap={() => {
              setDirFrom(dirTo);
              setDirTo(dirFrom);
              setFromText(toText);
              setToText(fromText);
              clearDirRoute();
            }}
            onSubmit={() => runDirections()}
            onClear={() => {
              setFromText("");
              setToText("");
              setDirFrom(null);
              setDirTo(null);
              clearDirRoute();
            }}
            onUseCurrentFrom={startFromMyLocation}
            onUseCurrentTo={endAtMyLocation}
            currentLocation={userLocation}
            geoStatus={geoStatus}
            prefer={dirPrefer}
            onPrefer={(p) => {
              setDirPrefer(p);
              clearDirRoute();
            }}
            routeOptions={dirOptions}
            selectedRouteId={dirSelectedId}
            onSelectRoute={(opt) => {
              applySelectedRoute(opt, "directions");
              setDirLocked(true);
              showStatus(`Using ${opt.label}`);
            }}
            routeLocked={dirLocked}
            onToggleLock={() => setDirLocked((v) => !v)}
            summary={dirSummary}
            loading={dirLoading}
            error={dirError}
          />
        )}

        {mode === "create" && (
          <CreateRoutePanel
            routeName={routeName}
            onRouteName={setRouteName}
            waypoints={waypoints}
            travelMode={travelMode}
            onTravelMode={(m) => {
              setTravelMode(m);
              invalidateCreateRoute();
            }}
            snapToRoads={snapToRoads}
            onSnapToRoads={(v) => {
              setSnapToRoads(v);
              invalidateCreateRoute();
            }}
            prefer={createPrefer}
            onPrefer={(p) => {
              setCreatePrefer(p);
              invalidateCreateRoute();
            }}
            routeOptions={createOptions}
            selectedRouteId={createSelectedId}
            onSelectRoute={(opt) => {
              applySelectedRoute(opt, "create");
              setCreateLocked(true);
              showStatus(`Using ${opt.label}`);
            }}
            routeLocked={createLocked}
            onToggleLock={() => setCreateLocked((v) => !v)}
            summary={createSummary}
            loading={createLoading}
            error={createError}
            savedRoutes={savedRoutes}
            currentLocation={userLocation}
            onAddPlace={(place) => addWaypoint(place.lat, place.lng, place)}
            onAddCurrentLocation={addCurrentLocationStop}
            onRemoveWaypoint={(i) => {
              setWaypoints((prev) => prev.filter((_, idx) => idx !== i));
              invalidateCreateRoute();
            }}
            onMoveWaypoint={(from, to) => {
              setWaypoints((prev) => {
                const next = [...prev];
                const [item] = next.splice(from, 1);
                next.splice(to, 0, item);
                return next;
              });
              invalidateCreateRoute();
            }}
            onUndo={() => {
              setWaypoints((prev) => prev.slice(0, -1));
              invalidateCreateRoute();
            }}
            onClear={() => {
              setWaypoints([]);
              setRouteName("");
              invalidateCreateRoute();
            }}
            onBuild={() => buildCustomRoute()}
            onSave={saveRoute}
            onLoadSaved={loadSaved}
            onDeleteSaved={(id) =>
              setSavedRoutes((prev) => prev.filter((r) => r.id !== id))
            }
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
          mode={mode}
          layer={layer}
          searchMarker={searchMarker}
          userLocation={userLocation}
          directions={{
            from: dirFrom,
            to: dirTo,
            geometry: dirGeometry,
            alternatives: dirOptions
              .filter((o) => o.id !== dirSelectedId)
              .map((o) => o.geometry),
          }}
          createRoute={{
            waypoints,
            geometry: createGeometry,
            alternatives: createOptions
              .filter((o) => o.id !== createSelectedId)
              .map((o) => o.geometry),
          }}
          flyTarget={flyTarget}
          fitKey={fitKey}
          onMapClick={handleMapClick}
          onContextMenu={(latlng, pos) => setCtx({ latlng, ...pos })}
          onWaypointDrag={handleWaypointDrag}
          onLocateReady={(fn) => {
            locateFn.current = fn;
          }}
          onMarkerClick={(place) => {
            setMode("explore");
            setPanelOpen(true);
            setSearchMarker(place);
            setExploreQuery(place.name || placeLabel(place));
            setFlyTarget({ lat: place.lat, lng: place.lng, zoom: 15 });
          }}
        />

        <div className="map-controls">
          <md-chip-set class="layer-toggle" role="group" aria-label="Map type">
            <md-filter-chip
              label="Map"
              selected={layer === "map" || undefined}
              onClick={() => setLayer("map")}
            >
              <md-icon slot="icon">map</md-icon>
            </md-filter-chip>
            <md-filter-chip
              label="Satellite"
              selected={layer === "satellite" || undefined}
              onClick={() => setLayer("satellite")}
            >
              <md-icon slot="icon">satellite_alt</md-icon>
            </md-filter-chip>
          </md-chip-set>
          <md-fab
            class={`locate-fab ${geoStatus === "ready" ? "is-located" : ""}`}
            variant="surface"
            size="medium"
            aria-label="My location"
            title="My location"
            onClick={goToMyLocation}
          >
            <md-icon slot="icon">my_location</md-icon>
          </md-fab>
        </div>

        {status && (
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
