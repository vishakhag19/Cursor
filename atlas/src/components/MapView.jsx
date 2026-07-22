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

function MapClickHandler({
  onMapClick,
  onContextMenu,
  suppressContextMenu = false,
}) {
  const map = useMap();
  const longPressTimer = useRef(null);
  const longPressOrigin = useRef(null);
  const longPressFired = useRef(false);

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressOrigin.current = null;
  }

  useMapEvents({
    click(e) {
      if (longPressFired.current) {
        longPressFired.current = false;
        return;
      }
      onMapClick?.(e.latlng);
    },
    contextmenu(e) {
      e.originalEvent.preventDefault();
      if (suppressContextMenu) return;
      onContextMenu?.(e.latlng, {
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
      });
    },
    mousedown(e) {
      // Desktop right-click uses contextmenu; ignore other mouse buttons here.
      if (e.originalEvent.button != null && e.originalEvent.button !== 0) return;
    },
  });

  useEffect(() => {
    const el = map.getContainer();

    function onTouchStart(ev) {
      if (suppressContextMenu) return;
      if (ev.touches?.length !== 1) return;
      const t = ev.touches[0];
      longPressFired.current = false;
      longPressOrigin.current = { x: t.clientX, y: t.clientY };
      clearLongPress();
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        const origin = longPressOrigin.current;
        if (!origin) return;
        longPressFired.current = true;
        const rect = el.getBoundingClientRect();
        const containerPoint = L.point(
          origin.x - rect.left,
          origin.y - rect.top,
        );
        const latlng = map.containerPointToLatLng(containerPoint);
        onContextMenu?.(latlng, { x: origin.x, y: origin.y });
        try {
          navigator.vibrate?.(12);
        } catch {
          /* ignore */
        }
      }, 480);
    }

    function onTouchMove(ev) {
      const origin = longPressOrigin.current;
      if (!origin || !ev.touches?.[0]) return;
      const t = ev.touches[0];
      if (
        Math.hypot(t.clientX - origin.x, t.clientY - origin.y) > 12
      ) {
        clearLongPress();
      }
    }

    function onTouchEnd() {
      clearLongPress();
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      clearLongPress();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [map, onContextMenu, suppressContextMenu]);

  return null;
}

function FitBounds({ positions, version, padding, enabled = true }) {
  const map = useMap();
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Re-fit only when fit version / padding changes — never because edit
  // mode toggled (that would yank zoom after the user framed an area).
  useEffect(() => {
    if (!enabledRef.current) return;
    if (!positions?.length) return;
    const pad = {
      top: padding?.top ?? 80,
      right: padding?.right ?? 80,
      bottom: padding?.bottom ?? 80,
      left: padding?.left ?? 80,
    };
    if (positions.length === 1) {
      map.setView(positions[0], Math.max(map.getZoom(), 14), { animate: true });
      return;
    }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, {
      paddingTopLeft: [pad.left, pad.top],
      paddingBottomRight: [pad.right, pad.bottom],
      maxZoom: 15,
      animate: true,
    });
    // intentionally omit `positions` from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    map,
    version,
    padding?.top,
    padding?.right,
    padding?.bottom,
    padding?.left,
  ]);
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

/** Clear “following location” when the user pans the map. */
function MapDragBridge({ onUserDrag }) {
  const map = useMap();
  useEffect(() => {
    if (!onUserDrag) return undefined;
    const handle = () => onUserDrag();
    map.on("dragstart", handle);
    return () => {
      map.off("dragstart", handle);
    };
  }, [map, onUserDrag]);
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
  fitPadding = null,
  onMapClick,
  onContextMenu,
  onWaypointDrag,
  onLocateReady,
  onZoomReady,
  onUserDrag,
  onMarkerClick,
  routeOptions = [],
  selectedRouteId = null,
  onSelectRoute,
  routeEditable = false,
  freezeFit = false,
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

  const showRouteEditor =
    Boolean(routeEditable) &&
    Boolean(selectedGeometry?.length > 1) &&
    Boolean(editOrigin) &&
    Boolean(editDestination);

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
        suppressContextMenu={false}
      />
      <FitBounds
        positions={fitPositions}
        version={fitKey}
        padding={fitPadding}
        enabled={!freezeFit}
      />
      <FlyTo target={flyTarget} />
      <LocateControl onLocate={onLocateReady} />
      <ZoomBridge onReady={onZoomReady} />
      <MapDragBridge onUserDrag={onUserDrag} />

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
            draggable
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

      {/* Alternate routes stay tappable while the selected route is editable */}
      {routeOptions
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

      {/* Static selected polyline only when the editor isn't drawing it */}
      {!showRouteEditor &&
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

      {!showRouteEditor &&
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

      {showRouteEditor && (
        <RouteEditorLayer
          enabled={showRouteEditor}
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
