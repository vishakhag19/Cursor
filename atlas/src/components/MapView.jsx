import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

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
      ? `<span style="position:absolute;top:-6px;right:-8px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#202124;color:#fff;font:700 10px/16px 'Plus Jakarta Sans',sans-serif;text-align:center">${label}</span>`
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
  useEffect(() => {
    if (!positions?.length) return;
    if (positions.length === 1) {
      map.setView(positions[0], Math.max(map.getZoom(), 14), { animate: true });
      return;
    }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
  }, [map, positions, version]);
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
    onLocate?.((coords) => {
      map.flyTo(coords, 15, { duration: 0.8 });
    });
  }, [map, onLocate]);
  return null;
}

export default function MapView({
  mode,
  layer,
  searchMarker,
  directions,
  createRoute,
  flyTarget,
  fitKey,
  onMapClick,
  onContextMenu,
  onWaypointDrag,
  onLocateReady,
}) {
  const routeLine =
    mode === "directions"
      ? directions?.geometry
      : mode === "create"
        ? createRoute?.geometry
        : null;

  const fitPositions = (() => {
    if (mode === "directions" && directions?.geometry?.length) {
      return directions.geometry;
    }
    if (mode === "create" && createRoute?.waypoints?.length) {
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
      {layer === "satellite" ? (
        <TileLayer
          attribution='Tiles &copy; Esri'
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

      {searchMarker && mode === "explore" && (
        <Marker
          position={[searchMarker.lat, searchMarker.lng]}
          icon={pinIcon("search")}
        />
      )}

      {mode === "directions" && directions?.from && (
        <Marker
          position={[directions.from.lat, directions.from.lng]}
          icon={pinIcon("start", "A")}
        />
      )}
      {mode === "directions" && directions?.to && (
        <Marker
          position={[directions.to.lat, directions.to.lng]}
          icon={pinIcon("end", "B")}
        />
      )}

      {mode === "create" &&
        createRoute?.waypoints?.map((wp, i) => {
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
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  onWaypointDrag?.(i, lat, lng);
                },
              }}
            />
          );
        })}

      {routeLine?.length > 1 && (
        <Polyline
          positions={routeLine}
          pathOptions={{
            color: mode === "create" ? "#1A73E8" : "#4285F4",
            weight: 5,
            opacity: 0.9,
            lineJoin: "round",
            lineCap: "round",
          }}
        />
      )}
    </MapContainer>
  );
}
