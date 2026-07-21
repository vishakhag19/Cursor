import { useCallback, useEffect, useRef, useState } from "react";
import MapView from "./components/MapView";
import SearchPanel from "./components/SearchPanel";
import DirectionsPanel from "./components/DirectionsPanel";
import ContextMenu from "./components/ContextMenu";
import { reverseGeocode } from "./api/geocode";
import { fetchShortestRoutes } from "./api/routing";
import { placeLabel } from "./utils/format";
import { loadRecentSearches, pushRecentSearch } from "./utils/storage";
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
  const [recentPlaces, setRecentPlaces] = useState(() => loadRecentSearches());

  const [stops, setStops] = useState(emptyStops);
  const [stopTexts, setStopTexts] = useState(["", ""]);
  const [travelMode, setTravelMode] = useState("driving");
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [routeLocked, setRouteLocked] = useState(false);
  const [editMode, setEditMode] = useState(false);
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
    setEditMode(false);
    setDirError(null);
  }, []);

  const rememberPlace = useCallback((place) => {
    if (!place || place.isCurrentLocation) return;
    setRecentPlaces((prev) => pushRecentSearch(place, prev));
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
      // Only resolve an explicit "Your location" choice — never auto-fill GPS.
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
      // Do not auto-fill Your location — user picks it from the start field.
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
      showStatus(placeLabel(place));
    },
    [showStatus, rememberPlace],
  );

  const handleMapClick = useCallback(
    async (latlng) => {
      setCtx(null);

      // Edit route: pin a via point the path must go through.
      if (view === "directions" && editMode) {
        try {
          const place = await reverseGeocode(latlng.lat, latlng.lng);
          rememberPlace(place);
          if (stops.length < 2 || !stops[0] || !stops[stops.length - 1]) {
            showStatus("Set start and destination before editing");
            return;
          }
          const nextStops = [...stops];
          nextStops.splice(nextStops.length - 1, 0, place);
          const nextTexts = [...stopTexts];
          nextTexts.splice(nextTexts.length - 1, 0, place.name);
          setStops(nextStops);
          setStopTexts(nextTexts);
          setEditMode(false);
          showStatus(`Via ${place.name} — rebuilding…`);
          await runDirections(nextStops, travelMode);
        } catch {
          showStatus("Could not pin that point");
        }
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
        rememberPlace(place);
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
    [
      view,
      editMode,
      stops,
      stopTexts,
      showStatus,
      clearRoutes,
      rememberPlace,
      runDirections,
      travelMode,
    ],
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
            onAddToRoute={() => {
              if (!selectedPlace) return;
              openDirections({ to: selectedPlace });
            }}
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
            near={userLocation}
            editMode={editMode}
            onToggleEdit={() => {
              setEditMode((v) => {
                const next = !v;
                if (next) showStatus("Click the map to pin a via point");
                return next;
              });
            }}
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
            selectRoute(opt);
            showStatus(`Selected: ${opt.badge || opt.label}`);
          }}
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
