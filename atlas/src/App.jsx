import { useCallback, useEffect, useRef, useState } from "react";
import MapView from "./components/MapView";
import SearchPanel from "./components/SearchPanel";
import DirectionsPanel from "./components/DirectionsPanel";
import ContextMenu from "./components/ContextMenu";
import { reverseGeocode } from "./api/geocode";
import { fetchShortestRoutes } from "./api/routing";
import { placeLabel } from "./utils/format";
import useGeolocation, { toCurrentLocationPlace } from "./hooks/useGeolocation";
import "./App.css";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyStops() {
  return [null, null];
}

export default function App() {
  const [view, setView] = useState("search"); // search | directions
  const [panelOpen, setPanelOpen] = useState(true);
  const [layer, setLayer] = useState("map");
  const [status, setStatus] = useState(null);
  const statusTimer = useRef(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);

  const [stops, setStops] = useState(emptyStops);
  const [stopTexts, setStopTexts] = useState(["", ""]);
  const [travelMode, setTravelMode] = useState("driving");
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [routeLocked, setRouteLocked] = useState(false);
  const [dirLoading, setDirLoading] = useState(false);
  const [dirError, setDirError] = useState(null);

  const [flyTarget, setFlyTarget] = useState(null);
  const [fitKey, setFitKey] = useState(0);
  const [ctx, setCtx] = useState(null);
  const locateFn = useRef(null);

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

  const clearRoutes = useCallback(() => {
    setRouteOptions([]);
    setSelectedRouteId(null);
    setRouteGeometry(null);
    setRouteLocked(false);
    setDirError(null);
  }, []);

  const selectRoute = useCallback((opt) => {
    if (!opt) return;
    setSelectedRouteId(opt.id);
    setRouteGeometry(opt.geometry);
    setRouteLocked(true);
    setFitKey((k) => k + 1);
  }, []);

  const runDirections = useCallback(
    async (nextStops = stops, mode = travelMode) => {
      // Resolve any null slots that still say "Your location" in the text field.
      const resolved = nextStops.map((s, i) => {
        if (s) return s;
        const text = (stopTexts[i] || "").trim().toLowerCase();
        if (
          userLocation &&
          (text === "your location" || text === "my location" || text === "")
        ) {
          // Only auto-fill the first empty "your location" intent for start.
          if (i === 0 || text.includes("location")) {
            return toCurrentLocationPlace(userLocation);
          }
        }
        return s;
      });

      // If start is empty but we have GPS, use it.
      if (!resolved[0] && userLocation) {
        resolved[0] = toCurrentLocationPlace(userLocation);
        setStops((prev) => {
          const next = [...prev];
          next[0] = resolved[0];
          return next;
        });
        setStopTexts((prev) => {
          const next = [...prev];
          next[0] = "Your location";
          return next;
        });
      }

      const filled = resolved.filter(Boolean);
      if (filled.length < 2) {
        setDirError("Choose a starting point and destination");
        return;
      }
      setDirLoading(true);
      setDirError(null);
      showStatus("Finding shortest routes…", 0);
      try {
        let options;
        try {
          options = await fetchShortestRoutes(filled, mode, { limit: 5 });
        } catch (firstErr) {
          // One retry — public OSRM can be briefly unavailable.
          await new Promise((r) => setTimeout(r, 600));
          options = await fetchShortestRoutes(filled, mode, { limit: 5 });
        }
        setRouteOptions(options);
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
    ],
  );

  const openDirections = useCallback(
    ({ from = null, to = null } = {}) => {
      const nextStops = [from, to];
      const nextTexts = [
        from ? (from.isCurrentLocation ? "Your location" : from.name) : "",
        to ? (to.isCurrentLocation ? "Your location" : to.name) : "",
      ];
      // Default start to current location when opening "directions to"
      if (!from && userLocation && to) {
        const me = toCurrentLocationPlace(userLocation);
        nextStops[0] = me;
        nextTexts[0] = "Your location";
      }
      setStops(nextStops);
      setStopTexts(nextTexts);
      clearRoutes();
      setView("directions");
      setPanelOpen(true);
      if (nextStops[0] && nextStops[1]) {
        runDirections(nextStops, travelMode);
      }
    },
    [userLocation, clearRoutes, runDirections, travelMode],
  );

  const selectSearchPlace = useCallback(
    (place) => {
      setSearchQuery(place.name);
      setSelectedPlace(place);
      setFlyTarget({ lat: place.lat, lng: place.lng, zoom: 14 });
      setView("search");
      setPanelOpen(true);
      showStatus(placeLabel(place));
    },
    [showStatus],
  );

  const handleMapClick = useCallback(
    async (latlng) => {
      setCtx(null);
      if (view === "directions") {
        // In directions, map click sets the first empty stop.
        const emptyIdx = stops.findIndex((s) => !s);
        if (emptyIdx === -1) {
          showStatus("All stops set — use Add destination for more");
          return;
        }
        if (routeLocked) {
          showStatus("Unlock isn’t needed — clear routes to edit stops");
        }
        try {
          const place = await reverseGeocode(latlng.lat, latlng.lng);
          setStops((prev) => {
            const next = [...prev];
            next[emptyIdx] = place;
            return next;
          });
          setStopTexts((prev) => {
            const next = [...prev];
            next[emptyIdx] = place.name;
            return next;
          });
          clearRoutes();
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
        showStatus(placeLabel(place));
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
    [view, stops, routeLocked, showStatus, clearRoutes],
  );

  const setStopText = useCallback(
    (index, value) => {
      setStopTexts((prev) => {
        const next = [...prev];
        next[index] = value;
        return next;
      });
    },
    [],
  );

  const setStopPlace = useCallback(
    (index, place) => {
      setStops((prev) => {
        const next = [...prev];
        next[index] = place;
        return next;
      });
      setStopTexts((prev) => {
        const next = [...prev];
        next[index] = place.isCurrentLocation ? "Your location" : place.name;
        return next;
      });
      clearRoutes();
      if (!place.isCurrentLocation) {
        setFlyTarget({ lat: place.lat, lng: place.lng, zoom: 13 });
      }
    },
    [clearRoutes],
  );

  const addStop = useCallback(() => {
    setStops((prev) => [...prev, null]);
    setStopTexts((prev) => [...prev, ""]);
    clearRoutes();
  }, [clearRoutes]);

  const removeStop = useCallback(
    (index) => {
      setStops((prev) => {
        if (prev.length <= 2) return prev;
        return prev.filter((_, i) => i !== index);
      });
      setStopTexts((prev) => {
        if (prev.length <= 2) return prev;
        return prev.filter((_, i) => i !== index);
      });
      clearRoutes();
    },
    [clearRoutes],
  );

  const swapStops = useCallback(() => {
    setStops((prev) => [...prev].reverse());
    setStopTexts((prev) => [...prev].reverse());
    clearRoutes();
  }, [clearRoutes]);

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
  const filledStops = stops.filter(Boolean);

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

        {view === "search" && (
          <SearchPanel
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSelectPlace={selectSearchPlace}
            place={selectedPlace}
            currentLocation={userLocation}
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
            onAddToRoute={() => {
              if (!selectedPlace) return;
              openDirections({
                from: userLocation
                  ? toCurrentLocationPlace(userLocation)
                  : null,
                to: selectedPlace,
              });
              // Ensure destination is set even if from was null
              setTimeout(() => {
                setStops((prev) => {
                  const next = [...prev];
                  if (!next[1]) next[1] = selectedPlace;
                  return next;
                });
              }, 0);
            }}
          />
        )}

        {view === "directions" && (
          <DirectionsPanel
            stops={stops}
            stopTexts={stopTexts}
            onStopText={setStopText}
            onStopSelect={setStopPlace}
            onAddStop={addStop}
            onRemoveStop={removeStop}
            onSwap={swapStops}
            travelMode={travelMode}
            onTravelMode={(m) => {
              setTravelMode(m);
              clearRoutes();
              const filled = stops.filter(Boolean);
              if (filled.length >= 2) runDirections(stops, m);
            }}
            onClose={() => {
              setView("search");
              clearRoutes();
            }}
            onSearch={() => runDirections()}
            routeOptions={routeOptions}
            selectedRouteId={selectedRouteId}
            onSelectRoute={(opt) => {
              selectRoute(opt);
              showStatus(opt.badge || opt.label);
            }}
            loading={dirLoading}
            error={dirError}
            currentLocation={userLocation}
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
            alternatives: routeOptions
              .filter((o) => o.id !== selectedRouteId)
              .map((o) => o.geometry),
          }}
          createRoute={{
            waypoints: view === "directions" ? filledStops : [],
            geometry: null,
            alternatives: [],
          }}
          flyTarget={flyTarget}
          fitKey={fitKey}
          onMapClick={handleMapClick}
          onContextMenu={(latlng, pos) => setCtx({ latlng, ...pos })}
          onWaypointDrag={async (index, lat, lng) => {
            try {
              const place = await reverseGeocode(lat, lng);
              setStopPlace(index, place);
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
          onMarkerClick={(place) => {
            setView("search");
            setPanelOpen(true);
            setSelectedPlace(place);
            setSearchQuery(place.name || placeLabel(place));
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
