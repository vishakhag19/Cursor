import { useEffect, useRef, useState } from "react";
import { Marker, Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import {
  closestPointOnPolyline,
  nearestRoadPoint,
  rebuildEditedRoute,
} from "../api/routing";

function handleIcon(dragging = false) {
  const size = dragging ? 22 : 18;
  return L.divIcon({
    className: "atlas-drag-handle",
    html: `<div class="drag-handle-core ${dragging ? "is-dragging" : ""}" style="width:${size}px;height:${size}px"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function orderedViasWithInsert(vias, geometry, segmentIndex, newVia) {
  if (!vias.length) return [newVia];
  const withMeta = vias.map((v) => {
    const c = closestPointOnPolyline({ lat: v.lat, lng: v.lng }, geometry);
    return { via: v, seg: c?.segmentIndex ?? 0 };
  });
  withMeta.sort((a, b) => a.seg - b.seg);
  const result = [];
  let inserted = false;
  for (const item of withMeta) {
    if (!inserted && segmentIndex <= item.seg) {
      result.push(newVia);
      inserted = true;
    }
    result.push(item.via);
  }
  if (!inserted) result.push(newVia);
  return result;
}

/**
 * Drag-to-reshape the active route (edit mode only).
 * Snaps to nearest road and shows a live dashed preview before commit.
 */
export default function RouteEditorLayer({
  enabled,
  origin,
  destination,
  vias = [],
  geometry,
  travelMode = "driving",
  onPreview,
  onCommitVia,
  onMoveVia,
  onError,
}) {
  const map = useMap();
  const [dragState, setDragState] = useState(null);
  const dragRef = useRef(null);
  const snapTimer = useRef(null);
  const previewSeq = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setDragState(null);
      dragRef.current = null;
      map.dragging.enable();
      map.getContainer().classList.remove("is-route-dragging");
      onPreview?.(null);
    }
  }, [enabled, map, onPreview]);

  useEffect(
    () => () => {
      clearTimeout(snapTimer.current);
    },
    [],
  );

  async function runPreview(lat, lng, segmentIndex, viaId) {
    if (!origin || !destination) return;
    const seq = ++previewSeq.current;
    try {
      const snapped = await nearestRoadPoint(lat, lng, travelMode);
      if (seq !== previewSeq.current) return;

      let nextVias;
      if (viaId) {
        nextVias = vias.map((v) =>
          v.id === viaId
            ? { ...v, lat: snapped.lat, lng: snapped.lng, name: snapped.name }
            : v,
        );
      } else {
        nextVias = orderedViasWithInsert(vias, geometry, segmentIndex, {
          id: "preview",
          lat: snapped.lat,
          lng: snapped.lng,
          name: snapped.name,
        });
      }

      const route = await rebuildEditedRoute(
        origin,
        nextVias.map((v) => ({ lat: v.lat, lng: v.lng })),
        destination,
        travelMode,
      );
      if (seq !== previewSeq.current) return;

      const next = {
        active: true,
        lat: snapped.lat,
        lng: snapped.lng,
        snapLat: snapped.lat,
        snapLng: snapped.lng,
        snapped: true,
        name: snapped.name,
        snapDistance: snapped.snapDistance,
        previewGeometry: route.geometry,
        previewDistance: route.distance,
        previewDuration: route.duration,
        segmentIndex,
        viaId: viaId || null,
      };
      dragRef.current = { ...dragRef.current, ...next };
      setDragState(next);
      onPreview?.(next);
    } catch (err) {
      if (seq !== previewSeq.current) return;
      setDragState((prev) =>
        prev
          ? {
              ...prev,
              lat,
              lng,
              snapped: false,
              previewGeometry: null,
              previewDistance: null,
              previewDuration: null,
            }
          : prev,
      );
      onError?.(err.message || "Could not snap to a road");
    }
  }

  function schedulePreview(lat, lng, segmentIndex, viaId) {
    clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      runPreview(lat, lng, segmentIndex, viaId);
    }, 100);
  }

  useMapEvents({
    mousemove(e) {
      if (!enabled || !dragRef.current?.active) return;
      const { lat, lng } = e.latlng;
      dragRef.current = {
        ...dragRef.current,
        lat,
        lng,
        snapped: false,
      };
      setDragState((prev) =>
        prev ? { ...prev, lat, lng, snapped: false } : prev,
      );
      schedulePreview(
        lat,
        lng,
        dragRef.current.segmentIndex,
        dragRef.current.viaId || null,
      );
    },
    mouseup() {
      if (!enabled || !dragRef.current?.active) return;
      finishDrag();
    },
  });

  async function finishDrag() {
    clearTimeout(snapTimer.current);
    const state = dragRef.current;
    dragRef.current = null;
    map.dragging.enable();
    map.getContainer().classList.remove("is-route-dragging");

    if (!state?.active) {
      setDragState(null);
      onPreview?.(null);
      return;
    }

    try {
      const snapped =
        state.snapped && state.snapLat != null && state.snapLng != null
          ? {
              lat: state.snapLat,
              lng: state.snapLng,
              name: state.name || "Via point",
              snapDistance: state.snapDistance || 0,
            }
          : await nearestRoadPoint(state.lat, state.lng, travelMode);

      if (state.viaId) onMoveVia?.(state.viaId, snapped);
      else onCommitVia?.(snapped, state.segmentIndex);
    } catch (err) {
      onError?.(err.message || "No road nearby");
    } finally {
      setDragState(null);
      onPreview?.(null);
    }
  }

  function beginPolylineDrag(latlng, segmentIndex) {
    if (!enabled || !origin || !destination) return;
    map.dragging.disable();
    map.getContainer().classList.add("is-route-dragging");
    const start = {
      active: true,
      lat: latlng.lat,
      lng: latlng.lng,
      snapped: false,
      segmentIndex,
      viaId: null,
      previewGeometry: null,
    };
    dragRef.current = start;
    setDragState(start);
    schedulePreview(latlng.lat, latlng.lng, segmentIndex, null);
  }

  function beginViaDrag(via, latlng) {
    if (!enabled) return;
    map.dragging.disable();
    map.getContainer().classList.add("is-route-dragging");
    const start = {
      active: true,
      lat: latlng.lat,
      lng: latlng.lng,
      snapped: false,
      segmentIndex: 0,
      viaId: via.id,
      previewGeometry: null,
    };
    dragRef.current = start;
    setDragState(start);
    schedulePreview(latlng.lat, latlng.lng, 0, via.id);
  }

  if (!enabled || !geometry?.length) return null;

  const displayGeometry =
    dragState?.previewGeometry?.length > 0
      ? dragState.previewGeometry
      : geometry;

  return (
    <>
      <Polyline
        positions={geometry}
        pathOptions={{ color: "#000", weight: 28, opacity: 0 }}
        eventHandlers={{
          mousedown: (e) => {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            const closest = closestPointOnPolyline(
              { lat: e.latlng.lat, lng: e.latlng.lng },
              geometry,
            );
            beginPolylineDrag(e.latlng, closest?.segmentIndex ?? 0);
          },
        }}
      />

      {dragState?.previewGeometry?.length > 0 && (
        <Polyline
          positions={geometry}
          pathOptions={{
            color: "#1A73E8",
            weight: 4,
            opacity: 0.28,
            lineJoin: "round",
            lineCap: "round",
          }}
          interactive={false}
        />
      )}

      <Polyline
        positions={displayGeometry}
        pathOptions={{
          color: dragState?.active ? "#F9AB00" : "#1A73E8",
          weight: 6,
          opacity: 0.95,
          dashArray: dragState?.active ? "10 8" : null,
          lineJoin: "round",
          lineCap: "round",
        }}
        interactive={false}
      />

      {vias.map((via) => (
        <Marker
          key={via.id}
          position={[via.lat, via.lng]}
          icon={handleIcon(dragState?.viaId === via.id)}
          eventHandlers={{
            mousedown: (e) => {
              L.DomEvent.stopPropagation(e);
              beginViaDrag(via, e.latlng);
            },
          }}
          zIndexOffset={2000}
        />
      ))}

      {dragState?.active && (
        <>
          {dragState.snapLat != null && dragState.snapLng != null && (
            <>
              <Polyline
                positions={[
                  [dragState.lat, dragState.lng],
                  [dragState.snapLat, dragState.snapLng],
                ]}
                pathOptions={{
                  color: dragState.snapped ? "#1A73E8" : "#9AA0A6",
                  weight: 2,
                  dashArray: "4 4",
                  opacity: 0.9,
                }}
                interactive={false}
              />
              <CircleMarker
                center={[dragState.snapLat, dragState.snapLng]}
                radius={7}
                pathOptions={{
                  color: "#1A73E8",
                  fillColor: "#1A73E8",
                  fillOpacity: dragState.snapped ? 0.95 : 0.35,
                  weight: 2,
                }}
              />
            </>
          )}
          <CircleMarker
            center={[dragState.lat, dragState.lng]}
            radius={dragState.snapped ? 10 : 12}
            pathOptions={{
              color: dragState.snapped ? "#1A73E8" : "#EA4335",
              fillColor: "#fff",
              fillOpacity: 1,
              weight: 3,
            }}
          />
          {!dragState.snapped && (
            <CircleMarker
              center={[dragState.lat, dragState.lng]}
              radius={20}
              pathOptions={{
                color: "#EA4335",
                fillOpacity: 0.08,
                weight: 1,
                dashArray: "4 4",
              }}
            />
          )}
        </>
      )}
    </>
  );
}
