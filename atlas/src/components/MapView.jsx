import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Polyline,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import RouteEditorLayer from "./RouteEditorLayer";

const DEFAULT_CENTER = [37.7749, -122.4194];
const DEFAULT_ZOOM = 13;

function pinIcon(kind = "default", label = "") {
  const colors = {
    default: "#EA4335",
    start: "#34A853",
    end: "#EA4335",
    stop: "#1A73E8",
    search: "#1A73E8",
  };
  const color = colors[kind] || colors.default;
  const badge =
    label !== ""
      ? `<span style="position:absolute;top:-6px;right:-8px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#202124;color:#fff;font:700 10px/16px Roboto,sans-serif;text-align:center">${label}</span>`
      : "";
  return L.divIcon({
    className: "atlas-pin",
    html: `<div style="position:relative;width:28px;height:36px">
      <svg viewBox="0 0 28 36" width="28" height="36">
        <path d="M14 0C6.3 0 0 6.1 0 13.6 0 23.5 14 36 14 36s14-12.5 14-22.4C28 6.1 21.7 0 14 0z" fill="${color}"/>
        <circle cx="14" cy="13" r="5.5" fill="#fff"/>
      </svg>${badge}
    </div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  });
}

function userLocationIcon() {
  return L.divIcon({
    className: "atlas-user-loc",
    html: `<div class="user-loc-dot" aria-hidden="true">
      <span class="user-loc-pulse"></span>
      <span class="user-loc-core"></span>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
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
  onMarkerClick,
  routeOptions = [],
  selectedRouteId = null,
  onSelectRoute,
  editMode = false,
  editOrigin = null,
  editDestination = null,
  editVias = [],
  editTravelMode = "driving",
  onEditPreview,
  onCommitVia,
  onMoveVia,
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

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
      className="map-root"
    >
      <ZoomControl position="bottomright" />
      <InvalidateOnResize />
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

      {mode === "directions" &&
        directions?.from &&
        !directions.from.isCurrentLocation && (
          <Marker
            position={[directions.from.lat, directions.from.lng]}
            icon={pinIcon("start", "A")}
            eventHandlers={{
              click: () => onMarkerClick?.(directions.from),
            }}
          />
        )}
      {mode === "directions" &&
        directions?.to &&
        !directions.to.isCurrentLocation && (
          <Marker
            position={[directions.to.lat, directions.to.lng]}
            icon={pinIcon("end", "B")}
            eventHandlers={{
              click: () => onMarkerClick?.(directions.to),
            }}
          />
        )}

      {mode === "directions" &&
        createRoute?.waypoints?.length > 2 &&
        createRoute.waypoints.slice(1, -1).map((wp, i) => {
          if (wp.isCurrentLocation) return null;
          return (
            <Marker
              key={wp.id || `mid-${i}`}
              position={[wp.lat, wp.lng]}
              icon={pinIcon("stop", String(i + 2))}
              eventHandlers={{
                click: () => onMarkerClick?.(wp),
              }}
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
            <Marker
              key={wp.id}
              position={[wp.lat, wp.lng]}
              icon={pinIcon(kind, String(i + 1))}
              draggable
              eventHandlers={{
                click: () => onMarkerClick?.(wp),
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  onWaypointDrag?.(i, lat, lng);
                },
              }}
            />
          );
        })}

      {routeOptions.map((opt) => {
        if (!opt?.geometry?.length) return null;
        const active = opt.id === selectedRouteId;
        // While editing, hide alternate routes so the drag target is clear.
        if (editMode && !active) return null;
        return (
          <Polyline
            key={opt.id}
            positions={opt.geometry}
            pathOptions={{
              color: active ? (editMode ? "#1A73E8" : "#1A73E8") : "#90CAF9",
              weight: active ? 6 : 5,
              opacity: active ? (editMode ? 0.35 : 0.95) : 0.55,
              lineJoin: "round",
              lineCap: "round",
            }}
            interactive={!editMode}
            eventHandlers={{
              click: (e) => {
                if (editMode) return;
                L.DomEvent.stopPropagation(e);
                onSelectRoute?.(opt);
              },
              mouseover: (e) => {
                if (editMode || active) return;
                e.target.setStyle({ opacity: 0.85, weight: 6 });
              },
              mouseout: (e) => {
                if (editMode || active) return;
                e.target.setStyle({ opacity: 0.55, weight: 5 });
              },
            }}
          />
        );
      })}

      {!editMode &&
        routeOptions.map((opt) =>
          opt?.geometry?.length ? (
            <Polyline
              key={`hit-${opt.id}`}
              positions={opt.geometry}
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
          ) : null,
        )}

      {editMode && selectedGeometry?.length > 1 && editOrigin && editDestination && (
        <RouteEditorLayer
          enabled={editMode}
          origin={editOrigin}
          destination={editDestination}
          vias={editVias}
          geometry={selectedGeometry}
          travelMode={editTravelMode}
          onPreview={onEditPreview}
          onCommitVia={onCommitVia}
          onMoveVia={onMoveVia}
          onError={onEditError}
        />
      )}

      {selectedGeometry?.length > 1 &&
        !editMode &&
        !routeOptions.some((o) => o.id === selectedRouteId) && (
          <Polyline
            positions={selectedGeometry}
            pathOptions={{
              color: "#1A73E8",
              weight: 6,
              opacity: 0.95,
              lineJoin: "round",
              lineCap: "round",
            }}
          />
        )}
    </MapContainer>
  );
}
