import { useCallback, useEffect, useRef, useState } from "react";
import MapView from "./components/MapView";
import ExplorePanel from "./components/ExplorePanel";
import DirectionsPanel from "./components/DirectionsPanel";
import CreateRoutePanel from "./components/CreateRoutePanel";
import ContextMenu from "./components/ContextMenu";
import { reverseGeocode } from "./api/geocode";
import { fetchRoute, straightLineRoute } from "./api/routing";
import { placeLabel } from "./utils/format";
import { loadSavedRoutes, persistSavedRoutes } from "./utils/storage";
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
  const [dirLoading, setDirLoading] = useState(false);
  const [dirError, setDirError] = useState(null);

  const [routeName, setRouteName] = useState("");
  const [waypoints, setWaypoints] = useState([]);
  const [travelMode, setTravelMode] = useState("driving");
  const [snapToRoads, setSnapToRoads] = useState(true);
  const [createSummary, setCreateSummary] = useState(null);
  const [createGeometry, setCreateGeometry] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [savedRoutes, setSavedRoutes] = useState(() => loadSavedRoutes());

  const [flyTarget, setFlyTarget] = useState(null);
  const [fitKey, setFitKey] = useState(0);
  const [ctx, setCtx] = useState(null);
  const locateFn = useRef(null);

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

  const invalidateCreateRoute = useCallback(() => {
    setCreateSummary(null);
    setCreateGeometry(null);
    setCreateError(null);
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

  const runDirections = useCallback(async (from = dirFrom, to = dirTo) => {
    if (!from || !to) {
      setDirError("Choose a start and destination");
      return;
    }
    setDirLoading(true);
    setDirError(null);
    showStatus("Finding the best route…", 0);
    try {
      const route = await fetchRoute([from, to], "driving");
      setDirGeometry(route.geometry);
      setDirSummary({ distance: route.distance, duration: route.duration });
      setFitKey((k) => k + 1);
      showStatus("Route ready");
    } catch (err) {
      setDirGeometry(null);
      setDirSummary(null);
      setDirError(err.message || "Could not find a route");
      showStatus(err.message || "Could not find a route");
    } finally {
      setDirLoading(false);
    }
  }, [dirFrom, dirTo, showStatus]);

  const buildCustomRoute = useCallback(
    async (wps = waypoints) => {
      if (wps.length < 2) {
        setCreateError("Add at least two stops");
        return;
      }
      setCreateLoading(true);
      setCreateError(null);
      showStatus("Building your route…", 0);
      try {
        let route;
        if (snapToRoads) {
          try {
            route = await fetchRoute(wps, travelMode);
          } catch {
            route = straightLineRoute(wps);
            showStatus("Road snap unavailable — using straight lines");
          }
        } else {
          route = straightLineRoute(wps);
        }
        setCreateGeometry(route.geometry);
        setCreateSummary({ distance: route.distance, duration: route.duration });
        setFitKey((k) => k + 1);
        showStatus("Custom route ready");
      } catch (err) {
        setCreateError(err.message || "Could not build route");
        showStatus(err.message || "Could not build route");
      } finally {
        setCreateLoading(false);
      }
    },
    [waypoints, snapToRoads, travelMode, showStatus],
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
        id: uid(),
        name: place.name,
        display_name: place.display_name,
        lat: place.lat ?? lat,
        lng: place.lng ?? lng,
      };
      setWaypoints((prev) => [...prev, wp]);
      invalidateCreateRoute();
      showStatus(`Stop added: ${placeLabel(wp)}`);
    },
    [invalidateCreateRoute, showStatus],
  );

  const handleMapClick = useCallback(
    async (latlng) => {
      setCtx(null);
      if (mode === "explore") {
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
        await addWaypoint(latlng.lat, latlng.lng);
      }
    },
    [mode, addWaypoint, showStatus],
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
      setFitKey((k) => k + 1);
      showStatus(`Loaded “${route.name}”`);
    },
    [showStatus],
  );

  const ctxActions = ctx
    ? [
        {
          id: "directions-from",
          label: "Directions from here",
          onClick: async () => {
            const place = await reverseGeocode(ctx.latlng.lat, ctx.latlng.lng).catch(
              () => ({
                name: "Point",
                display_name: "Selected point",
                lat: ctx.latlng.lat,
                lng: ctx.latlng.lng,
              }),
            );
            setDirFrom(place);
            setFromText(placeLabel(place));
            setMode("directions");
          },
        },
        {
          id: "directions-to",
          label: "Directions to here",
          onClick: async () => {
            const place = await reverseGeocode(ctx.latlng.lat, ctx.latlng.lng).catch(
              () => ({
                name: "Point",
                display_name: "Selected point",
                lat: ctx.latlng.lat,
                lng: ctx.latlng.lng,
              }),
            );
            setDirTo(place);
            setToText(placeLabel(place));
            setMode("directions");
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
      <aside className="panel" aria-label="Map tools">
        <header className="panel-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                <path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                  fill="currentColor"
                />
                <circle cx="12" cy="9" r="2.5" fill="#fff" />
              </svg>
            </span>
            <span className="brand-name">Atlas</span>
          </div>
          <button
            className="icon-btn"
            type="button"
            onClick={() => setPanelOpen(false)}
            aria-label="Collapse panel"
            title="Collapse panel"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </header>

        <div className="mode-tabs" role="tablist" aria-label="Map modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode-tab ${mode === m.id ? "is-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => {
                setMode(m.id);
                if (m.id === "create") {
                  showStatus("Create route: click the map to add stops", 3500);
                }
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "explore" && (
          <ExplorePanel
            query={exploreQuery}
            onQueryChange={setExploreQuery}
            onSelectPlace={selectExplorePlace}
            place={searchMarker}
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
              setFlyTarget({ lat: p.lat, lng: p.lng, zoom: 13 });
            }}
            onToSelect={(p) => {
              setDirTo(p);
              setToText(p.name);
              setFlyTarget({ lat: p.lat, lng: p.lng, zoom: 13 });
            }}
            onSwap={() => {
              setDirFrom(dirTo);
              setDirTo(dirFrom);
              setFromText(toText);
              setToText(fromText);
              setDirSummary(null);
              setDirGeometry(null);
            }}
            onSubmit={() => runDirections()}
            onClear={() => {
              setFromText("");
              setToText("");
              setDirFrom(null);
              setDirTo(null);
              setDirSummary(null);
              setDirGeometry(null);
              setDirError(null);
            }}
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
            summary={createSummary}
            loading={createLoading}
            error={createError}
            savedRoutes={savedRoutes}
            onAddPlace={(place) => addWaypoint(place.lat, place.lng, place)}
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
              setCreateGeometry(null);
              setCreateSummary(null);
              setCreateError(null);
              setRouteName("");
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
        <button
          className="expand-panel"
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Open panel"
        >
          <span className="brand-mark" aria-hidden>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                fill="currentColor"
              />
              <circle cx="12" cy="9" r="2.5" fill="#fff" />
            </svg>
          </span>
        </button>
      )}

      <main className="map-stage">
        <MapView
          mode={mode}
          layer={layer}
          searchMarker={searchMarker}
          directions={{
            from: dirFrom,
            to: dirTo,
            geometry: dirGeometry,
          }}
          createRoute={{
            waypoints,
            geometry: createGeometry,
          }}
          flyTarget={flyTarget}
          fitKey={fitKey}
          onMapClick={handleMapClick}
          onContextMenu={(latlng, pos) => setCtx({ latlng, ...pos })}
          onWaypointDrag={handleWaypointDrag}
          onLocateReady={(fn) => {
            locateFn.current = fn;
          }}
        />

        <div className="map-controls">
          <div className="layer-toggle" role="group" aria-label="Map type">
            <button
              type="button"
              className={layer === "map" ? "is-active" : ""}
              onClick={() => setLayer("map")}
            >
              Map
            </button>
            <button
              type="button"
              className={layer === "satellite" ? "is-active" : ""}
              onClick={() => setLayer("satellite")}
            >
              Satellite
            </button>
          </div>
          <button
            className="fab"
            type="button"
            title="My location"
            aria-label="My location"
            onClick={() => {
              if (!navigator.geolocation) {
                showStatus("Geolocation not available");
                return;
              }
              showStatus("Locating…", 0);
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const coords = [pos.coords.latitude, pos.coords.longitude];
                  locateFn.current?.(coords);
                  showStatus("Location found");
                },
                () => showStatus("Could not get your location"),
                { enableHighAccuracy: true, timeout: 10000 },
              );
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
        </div>

        {status && (
          <div className="map-status" role="status">
            {status}
          </div>
        )}
      </main>

      <ContextMenu position={ctx} onClose={() => setCtx(null)} actions={ctxActions} />
    </div>
  );
}
