import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import RouteEditorLayer from "./RouteEditorLayer";

const DEFAULT_CENTER = [37.7749, -122.4194];
const DEFAULT_ZOOM = 13;

/** Teardrop map pin — no letter badges (A/B chips). */
const PIN_ICON_CACHE = new Map();

function pinIcon(kind = "default") {
  const cached = PIN_ICON_CACHE.get(kind);
  if (cached) return cached;

  const colors = {
    default: "#EA4335",
    start: "#34A853",
    end: "#EA4335",
    stop: "#1A73E8",
    search: "#1A73E8",
  };
  const color = colors[kind] || colors.default;
  const icon = L.divIcon({
    className: "atlas-pin",
    html: `<div style="position:relative;width:28px;height:36px">
      <svg viewBox="0 0 28 36" width="28" height="36" aria-hidden="true">
        <path d="M14 0C6.3 0 0 6.1 0 13.6 0 23.5 14 36 14 36s14-12.5 14-22.4C28 6.1 21.7 0 14 0z" fill="${color}"/>
        <circle cx="14" cy="13" r="5.5" fill="#fff"/>
      </svg>
    </div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  });
  PIN_ICON_CACHE.set(kind, icon);
  return icon;
}

const USER_LOC_ICON = L.divIcon({
  className: "atlas-user-loc",
  html: `<div class="user-loc-dot" aria-hidden="true">
      <span class="user-loc-pulse"></span>
      <span class="user-loc-core"></span>
    </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function userLocationIcon() {
  return USER_LOC_ICON;
}

/**
 * Controlled Marker + drag: ignore prop position updates while dragging so
 * parent re-renders don't yank the pin back mid-gesture.
 */
function DraggableStopMarker({
  position,
  icon,
  draggable = true,
  onClick,
  onDragEnd,
}) {
  const markerRef = useRef(null);
  const draggingRef = useRef(false);
  const [livePos, setLivePos] = useState(position);

  useEffect(() => {
    if (draggingRef.current) return;
    setLivePos(position);
  }, [position?.[0], position?.[1]]);

  return (
    <Marker
      ref={markerRef}
      position={livePos}
      icon={icon}
      draggable={draggable}
      autoPan={false}
      zIndexOffset={2500}
      eventHandlers={{
        click: () => {
          if (draggingRef.current) return;
          onClick?.();
        },
        dragstart: () => {
          draggingRef.current = true;
        },
        drag: (e) => {
          const { lat, lng } = e.target.getLatLng();
          setLivePos([lat, lng]);
        },
        dragend: (e) => {
          const { lat, lng } = e.target.getLatLng();
          setLivePos([lat, lng]);
          draggingRef.current = false;
          onDragEnd?.(lat, lng);
        },
      }}
    />
  );
}

function MapClickHandler({ onMapClick, onContextMenu }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng);
    },
    contextmenu(e) {
      e.originalEvent.preventDefault();
      onContextMenu?.(e.latlng, {
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
      });
    },
  });
  return null;
}

function FitBounds({ positions, version }) {
  const map = useMap();
  // Only re-fit when `version` changes (new directions / explicit reset).
  // Do NOT re-fit when geometry updates during route editing — that caused
  // the map to zoom out after every drag commit.
  useEffect(() => {
    if (!positions?.length) return;
    if (positions.length === 1) {
      map.setView(positions[0], Math.max(map.getZoom(), 14), { animate: true });
      return;
    }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15, animate: true });
    // intentionally omit `positions` from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, version]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom ?? 14, { duration: 0.8 });
  }, [map, target]);
  return null;
}

function LocateControl({ onLocate }) {
  const map = useMap();
  useEffect(() => {
    onLocate?.((coords, zoom = 15) => {
      map.flyTo(coords, zoom, { duration: 0.8 });
    });
  }, [map, onLocate]);
  return null;
}

/** Expose zoomIn / zoomOut so App can render a unified control stack. */
function ZoomBridge({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady?.({
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
    });
  }, [map, onReady]);
  return null;
}

/** Stable panes so the selected route stays above alts without bringToFront thrash. */
function EnsureRoutePanes() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane("routeAlt")) {
      const pane = map.createPane("routeAlt");
      pane.style.zIndex = 410;
    }
    if (!map.getPane("routeSelected")) {
      const pane = map.createPane("routeSelected");
      pane.style.zIndex = 420;
    }
    if (!map.getPane("routeHit")) {
      const pane = map.createPane("routeHit");
      pane.style.zIndex = 430;
    }
    // Above faded selected route, below markers — owns edit-mode drag hits.
    if (!map.getPane("routeEdit")) {
      const pane = map.createPane("routeEdit");
      pane.style.zIndex = 450;
    }
    if (!map.getPane("routeEditHit")) {
      const pane = map.createPane("routeEditHit");
      pane.style.zIndex = 460;
      pane.style.pointerEvents = "auto";
    }
  }, [map]);
  return null;
}

/** Keep Leaflet in sync if the container size ever changes. */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const node = map.getContainer();
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(node);
    map.invalidateSize({ animate: false });
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function MapView({
  mode,
  layer,
  searchMarker,
  userLocation,
  directions,
  createRoute,
  flyTarget,
  fitKey,
  onMapClick,
  onContextMenu,
  onWaypointDrag,
  onLocateReady,
  onZoomReady,
  onMarkerClick,
  routeOptions = [],
  selectedRouteId = null,
  onSelectRoute,
  editMode = false,
  editOrigin = null,
  editDestination = null,
  editVias = [],
  editTravelMode = "driving",
  selectedViaId = null,
  onSelectVia,
  onEditPreview,
  onCommitVia,
  onMoveVia,
  onDeleteVia,
  onEditError,
}) {
  const selectedGeometry =
    mode === "directions"
      ? directions?.geometry
      : mode === "create"
        ? createRoute?.geometry
        : null;

  const fitPositions = (() => {
    if (selectedGeometry?.length) return selectedGeometry;
    if (mode === "create" && createRoute?.waypoints?.length) {
      return createRoute.waypoints.map((w) => [w.lat, w.lng]);
    }
    if (mode === "directions" && createRoute?.waypoints?.length) {
      return createRoute.waypoints.map((w) => [w.lat, w.lng]);
    }
    if (searchMarker) return [[searchMarker.lat, searchMarker.lng]];
    return null;
  })();

  const directionWaypoints =
    mode === "directions" ? createRoute?.waypoints || [] : [];

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
      className="map-root"
    >
      <InvalidateOnResize />
      <EnsureRoutePanes />
      {layer === "satellite" ? (
        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
      )}

      <MapClickHandler
        onMapClick={onMapClick}
        onContextMenu={onContextMenu}
      />
      <FitBounds positions={fitPositions} version={fitKey} />
      <FlyTo target={flyTarget} />
      <LocateControl onLocate={onLocateReady} />
      <ZoomBridge onReady={onZoomReady} />

      {userLocation && (
        <>
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={Math.max(userLocation.accuracy || 40, 25)}
            pathOptions={{
              color: "#1A73E8",
              weight: 1,
              fillColor: "#1A73E8",
              fillOpacity: 0.12,
              opacity: 0.35,
            }}
          />
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userLocationIcon()}
            zIndexOffset={1000}
            interactive={false}
          />
        </>
      )}

      {searchMarker && mode === "explore" && (
        <Marker
          position={[searchMarker.lat, searchMarker.lng]}
          icon={pinIcon("search")}
          eventHandlers={{
            click: () => onMarkerClick?.(searchMarker),
          }}
        />
      )}

      {directionWaypoints.map((wp, i) => {
        if (!wp || wp.isCurrentLocation) return null;
        const last = directionWaypoints.length - 1;
        // Single stop (destination only) should still use the end pin color.
        const kind =
          directionWaypoints.length === 1
            ? "end"
            : i === 0
              ? "start"
              : i === last
                ? "end"
                : "stop";
        return (
          <DraggableStopMarker
            key={wp.id || `dir-wp-${i}`}
            position={[wp.lat, wp.lng]}
            icon={pinIcon(kind)}
            draggable={!editMode}
            onClick={() => onMarkerClick?.(wp)}
            onDragEnd={(lat, lng) => onWaypointDrag?.(i, lat, lng)}
          />
        );
      })}

      {mode === "create" &&
        createRoute?.waypoints?.map((wp, i) => {
          if (wp.isCurrentLocation) return null;
          const kind =
            i === 0
              ? "start"
              : i === createRoute.waypoints.length - 1 &&
                  createRoute.waypoints.length > 1
                ? "end"
                : "stop";
          return (
            <DraggableStopMarker
              key={wp.id}
              position={[wp.lat, wp.lng]}
              icon={pinIcon(kind)}
              draggable
              onClick={() => onMarkerClick?.(wp)}
              onDragEnd={(lat, lng) => onWaypointDrag?.(i, lat, lng)}
            />
          );
        })}

      {/* Alternate routes on a lower pane so the selected route stays on top */}
      {!editMode &&
        routeOptions
          .filter((opt) => opt?.geometry?.length && opt.id !== selectedRouteId)
          .map((opt) => (
            <Polyline
              key={opt.id}
              positions={opt.geometry}
              pane="routeAlt"
              pathOptions={{
                color: "#64B5F6",
                weight: 5,
                opacity: 0.82,
                lineJoin: "round",
                lineCap: "round",
              }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  onSelectRoute?.(opt);
                },
                mouseover: (e) => {
                  e.target.setStyle({ opacity: 0.95, weight: 6 });
                },
                mouseout: (e) => {
                  e.target.setStyle({ opacity: 0.82, weight: 5 });
                },
              }}
            />
          ))}

      {/* Hide during edit — RouteEditorLayer draws the active path + hit target */}
      {!editMode &&
        routeOptions
          .filter((opt) => opt?.geometry?.length && opt.id === selectedRouteId)
          .map((opt) => (
            <Polyline
              key={opt.id}
              positions={opt.geometry}
              pane="routeSelected"
              pathOptions={{
                color: "#1A73E8",
                weight: 6,
                opacity: 0.95,
                lineJoin: "round",
                lineCap: "round",
              }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  onSelectRoute?.(opt);
                },
              }}
            />
          ))}

      {!editMode &&
        routeOptions.map((opt) => {
          if (!opt?.geometry?.length) return null;
          return (
            <Polyline
              key={`hit-${opt.id}`}
              positions={opt.geometry}
              pane="routeHit"
              pathOptions={{
                color: "#000",
                weight: 18,
                opacity: 0,
              }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  onSelectRoute?.(opt);
                },
              }}
            />
          );
        })}

      {editMode && selectedGeometry?.length > 1 && editOrigin && editDestination && (
        <RouteEditorLayer
          enabled={editMode}
          origin={editOrigin}
          destination={editDestination}
          vias={editVias}
          geometry={selectedGeometry}
          travelMode={editTravelMode}
          selectedViaId={selectedViaId}
          onSelectVia={onSelectVia}
          onPreview={onEditPreview}
          onCommitVia={onCommitVia}
          onMoveVia={onMoveVia}
          onDeleteVia={onDeleteVia}
          onError={onEditError}
        />
      )}
    </MapContainer>
  );
}
