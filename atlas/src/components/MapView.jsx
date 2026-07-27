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
import { formatDuration } from "../utils/format";

const DEFAULT_CENTER = [37.7749, -122.4194];
const DEFAULT_ZOOM = 13;

/** Teardrop map pin — no letter badges (A/B chips). */
const PIN_ICON_CACHE = new Map();
/** Matches --atlas-accent (Maps blue) for routes + interactive map chrome */
const ROUTE_BLUE = "#1A73E8";
const ROUTE_BLUE_ALT = "#8AB4F8";

function pinIcon(kind = "default") {
  const cached = PIN_ICON_CACHE.get(kind);
  if (cached) return cached;

  const colors = {
    default: "#EA4335",
    start: "#34A853",
    end: "#EA4335",
    stop: ROUTE_BLUE,
    search: ROUTE_BLUE,
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

const ROUTE_TIME_ICON_CACHE = new Map();
function routeTimeIcon(label, active = false) {
  const key = `${label}-${active ? 1 : 0}-near`;
  const cached = ROUTE_TIME_ICON_CACHE.get(key);
  if (cached) return cached;
  // Chip sits above the anchor point; lateral offset is applied in geometry.
  const icon = L.divIcon({
    className: "atlas-route-time",
    html: `<div class="map-route-time ${active ? "is-active" : ""}" style="--route-blue:${ROUTE_BLUE}">${label}</div>`,
    iconSize: [72, 28],
    iconAnchor: [36, 40],
  });
  ROUTE_TIME_ICON_CACHE.set(key, icon);
  return icon;
}

/**
 * Point at an arc-length fraction along the polyline, nudged perpendicular
 * so the chip stays close without overlapping the stroke.
 */
function geometryLabelPoint(geometry, fraction = 0.5, side = 1) {
  if (!geometry?.length) return null;
  if (geometry.length === 1) {
    return { lat: geometry[0][0], lng: geometry[0][1] };
  }
  const segLens = [];
  let total = 0;
  for (let i = 1; i < geometry.length; i += 1) {
    const a = geometry[i - 1];
    const b = geometry[i];
    const dLat = (b[0] - a[0]) * 111320;
    const dLng =
      (b[1] - a[1]) * 111320 * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
    const len = Math.hypot(dLat, dLng);
    segLens.push(len);
    total += len;
  }
  if (total <= 0) {
    const pt = geometry[Math.floor(geometry.length / 2)];
    return { lat: pt[0], lng: pt[1] };
  }
  const target = total * Math.min(1, Math.max(0, fraction));
  let walked = 0;
  for (let i = 0; i < segLens.length; i += 1) {
    const seg = segLens[i];
    if (walked + seg >= target) {
      const t = seg > 0 ? (target - walked) / seg : 0;
      const a = geometry[i];
      const b = geometry[i + 1];
      const lat = a[0] + (b[0] - a[0]) * t;
      const lng = a[1] + (b[1] - a[1]) * t;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const inv = Math.hypot(dx, dy) || 1;
      // ~40–55 m off the line — close at city zoom, clear of the stroke.
      const nudgeM = 48;
      const nLat = (-dy / inv) * (nudgeM / 111320) * side;
      const nLng =
        (dx / inv) *
        (nudgeM / (111320 * Math.cos((lat * Math.PI) / 180) || 1)) *
        side;
      return { lat: lat + nLat, lng: lng + nLng };
    }
    walked += seg;
  }
  const last = geometry[geometry.length - 1];
  return { lat: last[0], lng: last[1] };
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

function MapClickHandler({ onMapClick }) {
  const map = useMap();
  const pointerDownAt = useRef(0);
  const suppressNextClick = useRef(false);
  const lastClickAt = useRef(0);

  useMapEvents({
    click(e) {
      if (suppressNextClick.current) {
        suppressNextClick.current = false;
        return;
      }
      const now = Date.now();
      /* Ignore the second click of a double-click / double-tap. */
      if (now - lastClickAt.current < 350) {
        lastClickAt.current = now;
        return;
      }
      lastClickAt.current = now;
      const oe = e.originalEvent;
      onMapClick?.(e.latlng, {
        x: oe?.clientX,
        y: oe?.clientY,
      });
    },
    dblclick() {
      /* Swallow — no app sheet / menu from double-click. */
      suppressNextClick.current = true;
    },
    contextmenu(e) {
      e.originalEvent?.preventDefault?.();
      suppressNextClick.current = true;
    },
  });

  useEffect(() => {
    const el = map.getContainer();

    function onPointerDown() {
      pointerDownAt.current = Date.now();
    }

    function onPointerUp() {
      /* Long-press must not open sheets — suppress the click that follows. */
      if (Date.now() - pointerDownAt.current >= 400) {
        suppressNextClick.current = true;
      }
    }

    function blockContextMenu(ev) {
      ev.preventDefault();
      suppressNextClick.current = true;
    }

    el.addEventListener("pointerdown", onPointerDown, { passive: true });
    el.addEventListener("pointerup", onPointerUp, { passive: true });
    el.addEventListener("pointercancel", onPointerUp, { passive: true });
    el.addEventListener("contextmenu", blockContextMenu);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("contextmenu", blockContextMenu);
    };
  }, [map]);

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
      // Above edit visuals so alternate routes stay tappable while editing.
      pane.style.zIndex = 470;
    } else {
      map.getPane("routeHit").style.zIndex = 470;
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
  onWaypointDrag,
  onLocateReady,
  onZoomReady,
  onUserDrag,
  onMarkerClick,
  routeOptions = [],
  selectedRouteId = null,
  onSelectRoute,
  routeEditable = false,
  roadPickMode = false,
  freezeFit = false,
  editOrigin = null,
  editDestination = null,
  editVias = [],
  editTravelMode = "driving",
  selectedViaId = null,
  onSelectVia,
  onEditPreview,
  onSuppressMapClick = null,
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
      doubleClickZoom={false}
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

      <MapClickHandler onMapClick={onMapClick} />
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
        const stopIndex =
          typeof wp.stopIndex === "number" ? wp.stopIndex : i;
        return (
          <DraggableStopMarker
            key={wp.id || `dir-wp-${stopIndex}`}
            position={[wp.lat, wp.lng]}
            icon={pinIcon(kind)}
            draggable={!roadPickMode}
            onClick={() => onMarkerClick?.(wp)}
            onDragEnd={(lat, lng) => onWaypointDrag?.(stopIndex, lat, lng)}
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
          const stopIndex =
            typeof wp.stopIndex === "number" ? wp.stopIndex : i;
          return (
            <DraggableStopMarker
              key={wp.id}
              position={[wp.lat, wp.lng]}
              icon={pinIcon(kind)}
              draggable={!roadPickMode}
              onClick={() => onMarkerClick?.(wp)}
              onDragEnd={(lat, lng) => onWaypointDrag?.(stopIndex, lat, lng)}
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
            interactive={!roadPickMode}
            pathOptions={{
              color: ROUTE_BLUE_ALT,
              weight: 5,
              opacity: 0.88,
              lineJoin: "round",
              lineCap: "round",
            }}
            eventHandlers={
              roadPickMode
                ? undefined
                : {
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
                  }
            }
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
              interactive={!roadPickMode}
              pathOptions={{
                color: ROUTE_BLUE,
                weight: 6,
                opacity: 0.95,
                lineJoin: "round",
                lineCap: "round",
              }}
              eventHandlers={
                roadPickMode
                  ? undefined
                  : {
                      click: (e) => {
                        L.DomEvent.stopPropagation(e);
                        onSelectRoute?.(opt);
                      },
                    }
              }
            />
          ))}

      {/* Fat hit targets: all routes when idle; alternates stay tappable while editing */}
      {!roadPickMode &&
        routeOptions
          .filter((opt) => {
            if (!opt?.geometry?.length) return false;
            // Selected line is handled by the editor while editing.
            if (showRouteEditor && opt.id === selectedRouteId) return false;
            return true;
          })
          // Selected last so it wins shared corridors when not editing.
          .sort((a, b) => {
            if (a.id === selectedRouteId) return 1;
            if (b.id === selectedRouteId) return -1;
            return 0;
          })
          .map((opt) => (
            <Polyline
              key={`hit-${opt.id}`}
              positions={opt.geometry}
              pane="routeHit"
              pathOptions={{
                color: "#000",
                weight: 22,
                opacity: 0,
              }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  onSelectRoute?.(opt);
                },
              }}
            />
          ))}

      {/* Travel-time chips sit just beside the line; never capture pointer events */}
      {routeOptions.map((opt, index) => {
        const fraction = 0.4 + (index % 4) * 0.07;
        const side = index % 2 === 0 ? 1 : -1;
        const mid = geometryLabelPoint(opt?.geometry, fraction, side);
        if (!mid) return null;
        const active = opt.id === selectedRouteId;
        const label = formatDuration(opt.duration);
        return (
          <Marker
            key={`time-${opt.id}`}
            position={[mid.lat, mid.lng]}
            icon={routeTimeIcon(label, active)}
            interactive={false}
            keyboard={false}
            zIndexOffset={active ? 500 : 400}
          />
        );
      })}

      {showRouteEditor && (
        <RouteEditorLayer
          enabled={showRouteEditor}
          origin={editOrigin}
          destination={editDestination}
          stopPins={directionWaypoints}
          vias={editVias}
          geometry={selectedGeometry}
          alternateGeometries={routeOptions
            .filter(
              (opt) =>
                opt?.geometry?.length && opt.id !== selectedRouteId,
            )
            .map((opt) => opt.geometry)}
          travelMode={editTravelMode}
          selectedViaId={selectedViaId}
          onSelectVia={onSelectVia}
          onPreview={onEditPreview}
          onSuppressMapClick={onSuppressMapClick}
          onCommitVia={onCommitVia}
          onMoveVia={onMoveVia}
          onDeleteVia={onDeleteVia}
          onError={onEditError}
        />
      )}
    </MapContainer>
  );
}
