import { useEffect, useRef, useState } from "react";
import { Marker, Polyline, CircleMarker, useMap } from "react-leaflet";
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
  const dragSession = useRef(0);
  const listenersRef = useRef(null);
  const geometryRef = useRef(geometry);
  const viasRef = useRef(vias);
  const originRef = useRef(origin);
  const destinationRef = useRef(destination);
  const travelModeRef = useRef(travelMode);

  geometryRef.current = geometry;
  viasRef.current = vias;
  originRef.current = origin;
  destinationRef.current = destination;
  travelModeRef.current = travelMode;

  function clearDocListeners() {
    const L = listenersRef.current;
    if (!L) return;
    document.removeEventListener("pointermove", L.move);
    document.removeEventListener("pointerup", L.up);
    document.removeEventListener("pointercancel", L.up);
    document.removeEventListener("mousemove", L.moveMouse);
    document.removeEventListener("mouseup", L.up);
    window.removeEventListener("pointerup", L.up, true);
    window.removeEventListener("mouseup", L.up, true);
    listenersRef.current = null;
  }

  function endDragVisual() {
    clearTimeout(snapTimer.current);
    previewSeq.current += 1;
    dragRef.current = null;
    setDragState(null);
    onPreview?.(null);
    map.dragging.enable();
    map.getContainer().classList.remove("is-route-dragging");
    clearDocListeners();
  }

  useEffect(() => {
    if (!enabled) endDragVisual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, map]);

  useEffect(
    () => () => {
      clearTimeout(snapTimer.current);
      previewSeq.current += 1;
      clearDocListeners();
      map.dragging.enable();
      map.getContainer().classList.remove("is-route-dragging");
    },
    [map],
  );

  async function runPreview(lat, lng, segmentIndex, viaId, session) {
    const originNow = originRef.current;
    const destinationNow = destinationRef.current;
    if (!originNow || !destinationNow) return;
    if (session !== dragSession.current) return;
    if (!dragRef.current?.active) return;

    const seq = ++previewSeq.current;
    try {
      const snapped = await nearestRoadPoint(
        lat,
        lng,
        travelModeRef.current,
      );
      if (session !== dragSession.current) return;
      if (seq !== previewSeq.current) return;
      if (!dragRef.current?.active) return;

      let nextVias;
      if (viaId) {
        nextVias = viasRef.current.map((v) =>
          v.id === viaId
            ? { ...v, lat: snapped.lat, lng: snapped.lng, name: snapped.name }
            : v,
        );
      } else {
        nextVias = orderedViasWithInsert(
          viasRef.current,
          geometryRef.current,
          segmentIndex,
          {
            id: "preview",
            lat: snapped.lat,
            lng: snapped.lng,
            name: snapped.name,
          },
        );
      }

      const route = await rebuildEditedRoute(
        originNow,
        nextVias.map((v) => ({ lat: v.lat, lng: v.lng })),
        destinationNow,
        travelModeRef.current,
      );
      if (session !== dragSession.current) return;
      if (seq !== previewSeq.current) return;
      if (!dragRef.current?.active) return;

      const next = {
        active: true,
        session,
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
      if (session !== dragSession.current) return;
      if (seq !== previewSeq.current) return;
      if (!dragRef.current?.active) return;
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

  function schedulePreview(lat, lng, segmentIndex, viaId, session) {
    clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      runPreview(lat, lng, segmentIndex, viaId, session);
    }, 100);
  }

  async function finishDrag(session, { cancel = false } = {}) {
    if (session !== dragSession.current) return;
    clearTimeout(snapTimer.current);
    const state = dragRef.current;
    // Invalidate any in-flight preview so it cannot re-stick to the cursor.
    previewSeq.current += 1;
    dragRef.current = null;
    setDragState(null);
    onPreview?.(null);
    map.dragging.enable();
    map.getContainer().classList.remove("is-route-dragging");
    clearDocListeners();

    if (cancel || !state?.active) return;

    // Require a real drag — a plain click must not create/move a via.
    if (!state.movedEnough) return;

    try {
      const snapped =
        state.snapped && state.snapLat != null && state.snapLng != null
          ? {
              lat: state.snapLat,
              lng: state.snapLng,
              name: state.name || "Via point",
              snapDistance: state.snapDistance || 0,
            }
          : await nearestRoadPoint(
              state.lat,
              state.lng,
              travelModeRef.current,
            );

      if (session !== dragSession.current) return;

      if (state.viaId) await onMoveVia?.(state.viaId, snapped);
      else await onCommitVia?.(snapped, state.segmentIndex);
    } catch (err) {
      onError?.(err.message || "No road nearby");
    }
  }

  function bindDocListeners(session) {
    clearDocListeners();
    const startedAt = performance.now();
    let seenPressed = false;
    const origin = dragRef.current
      ? map.latLngToContainerPoint([dragRef.current.lat, dragRef.current.lng])
      : null;
    const DRAG_PX = 10;

    const onMove = (ev) => {
      if (session !== dragSession.current) return;
      if (!dragRef.current?.active) return;
      if (typeof ev.buttons === "number") {
        if (ev.buttons > 0) seenPressed = true;
        if (
          seenPressed &&
          ev.buttons === 0 &&
          performance.now() - startedAt > 80
        ) {
          onUp();
          return;
        }
      }
      let latlng;
      try {
        latlng = map.mouseEventToLatLng(ev);
      } catch {
        const rect = map.getContainer().getBoundingClientRect();
        latlng = map.containerPointToLatLng(
          L.point(ev.clientX - rect.left, ev.clientY - rect.top),
        );
      }
      const { lat, lng } = latlng;

      let movedEnough = dragRef.current.movedEnough;
      if (!movedEnough && origin) {
        const cur = map.latLngToContainerPoint([lat, lng]);
        const dx = cur.x - origin.x;
        const dy = cur.y - origin.y;
        if (dx * dx + dy * dy >= DRAG_PX * DRAG_PX) movedEnough = true;
      }

      dragRef.current = {
        ...dragRef.current,
        lat,
        lng,
        snapped: false,
        movedEnough,
      };
      setDragState((prev) =>
        prev ? { ...prev, lat, lng, snapped: false, movedEnough } : prev,
      );

      if (movedEnough) {
        schedulePreview(
          lat,
          lng,
          dragRef.current.segmentIndex,
          dragRef.current.viaId || null,
          session,
        );
      }
    };

    let finished = false;
    function onUp() {
      if (finished) return;
      finished = true;
      finishDrag(session);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("mouseup", onUp, true);
    listenersRef.current = {
      move: onMove,
      moveMouse: onMove,
      up: onUp,
    };
  }

  function beginPolylineDrag(latlng, segmentIndex, originalEvent) {
    if (!enabled || !originRef.current || !destinationRef.current) return;
    const session = ++dragSession.current;
    previewSeq.current += 1;
    map.dragging.disable();
    map.getContainer().classList.add("is-route-dragging");
    const start = {
      active: true,
      session,
      lat: latlng.lat,
      lng: latlng.lng,
      snapped: false,
      segmentIndex,
      viaId: null,
      previewGeometry: null,
      movedEnough: false,
    };
    dragRef.current = start;
    setDragState(start);
    bindDocListeners(session);
    if (originalEvent?.pointerId != null) {
      try {
        map.getContainer().setPointerCapture?.(originalEvent.pointerId);
      } catch {
        /* ignore */
      }
    }
  }

  function beginViaDrag(via, latlng) {
    if (!enabled) return;
    const session = ++dragSession.current;
    previewSeq.current += 1;
    map.dragging.disable();
    map.getContainer().classList.add("is-route-dragging");
    const start = {
      active: true,
      session,
      lat: latlng.lat,
      lng: latlng.lng,
      snapped: false,
      segmentIndex: 0,
      viaId: via.id,
      previewGeometry: null,
      movedEnough: false,
    };
    dragRef.current = start;
    setDragState(start);
    bindDocListeners(session);
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
            beginPolylineDrag(
              e.latlng,
              closest?.segmentIndex ?? 0,
              e.originalEvent,
            );
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
              L.DomEvent.preventDefault(e);
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
