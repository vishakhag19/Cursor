import { useEffect, useRef, useState } from "react";
import { Marker, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import {
  closestPointOnPolyline,
  nearestRoadPoint,
  rebuildEditedRoute,
} from "../api/routing";

function handleIcon(dragging = false, selected = false) {
  const size = dragging || selected ? 22 : 18;
  const selectedClass = selected ? "is-selected" : "";
  return L.divIcon({
    className: "atlas-drag-handle",
    html: `<div class="drag-handle-core ${dragging ? "is-dragging" : ""} ${selectedClass}" style="width:${size}px;height:${size}px"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const HANDLE_ICON_CACHE = new Map();
function getHandleIcon(dragging = false, selected = false) {
  const key = `${dragging ? 1 : 0}-${selected ? 1 : 0}`;
  let icon = HANDLE_ICON_CACHE.get(key);
  if (!icon) {
    icon = handleIcon(dragging, selected);
    HANDLE_ICON_CACHE.set(key, icon);
  }
  return icon;
}

const VIA_DELETE_ICON = L.divIcon({
  className: "atlas-via-delete",
  html: `<button type="button" class="via-map-delete" title="Remove this point" aria-label="Remove this point">
      <span aria-hidden="true">×</span>
    </button>`,
  iconSize: [28, 28],
  iconAnchor: [-6, 28],
});

function viaDeleteIcon() {
  return VIA_DELETE_ICON;
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
  onDeleteVia,
  onSelectVia,
  selectedViaId = null,
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
    document.removeEventListener("touchmove", L.moveTouch, L.touchOpts);
    document.removeEventListener("touchend", L.up);
    document.removeEventListener("touchcancel", L.up);
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
    if (map.touchZoom?.enable) map.touchZoom.enable();
    map.getContainer().classList.remove("is-route-dragging");
    clearDocListeners();
  }

  useEffect(() => {
    if (!enabled) endDragVisual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, map]);

  useEffect(() => {
    const el = map.getContainer();
    if (enabled) el.classList.add("is-route-edit");
    else el.classList.remove("is-route-edit");
    return () => el.classList.remove("is-route-edit");
  }, [enabled, map]);

  useEffect(
    () => () => {
      clearTimeout(snapTimer.current);
      previewSeq.current += 1;
      clearDocListeners();
      map.dragging.enable();
      if (map.touchZoom?.enable) map.touchZoom.enable();
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
        { skipSnap: true },
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
    if (map.touchZoom?.enable) map.touchZoom.enable();
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

  function eventToLatLng(ev) {
    const src =
      ev?.touches?.[0] ||
      ev?.changedTouches?.[0] ||
      (ev?.clientX != null ? ev : null);
    if (!src) return null;
    try {
      if (ev.touches || ev.changedTouches) {
        const rect = map.getContainer().getBoundingClientRect();
        return map.containerPointToLatLng(
          L.point(src.clientX - rect.left, src.clientY - rect.top),
        );
      }
      return map.mouseEventToLatLng(ev);
    } catch {
      const rect = map.getContainer().getBoundingClientRect();
      return map.containerPointToLatLng(
        L.point(src.clientX - rect.left, src.clientY - rect.top),
      );
    }
  }

  function bindDocListeners(session) {
    clearDocListeners();
    const startedAt = performance.now();
    let seenPressed = false;
    const origin = dragRef.current
      ? map.latLngToContainerPoint([dragRef.current.lat, dragRef.current.lng])
      : null;
    const DRAG_PX = 8;

    const onMove = (ev) => {
      if (session !== dragSession.current) return;
      if (!dragRef.current?.active) return;

      // Mouse: detect button release if pointerup was missed.
      // Touch / pen pointer events keep buttons === 1 while down.
      if (ev.pointerType === "mouse" || ev.type === "mousemove") {
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
      }

      if (ev.cancelable && (ev.touches || ev.pointerType === "touch")) {
        ev.preventDefault();
      }

      const latlng = eventToLatLng(ev);
      if (!latlng) return;
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

    const touchOpts = { passive: false };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, touchOpts);
    document.addEventListener("touchend", onUp);
    document.addEventListener("touchcancel", onUp);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("mouseup", onUp, true);
    listenersRef.current = {
      move: onMove,
      moveMouse: onMove,
      moveTouch: onMove,
      touchOpts,
      up: onUp,
    };
  }

  function beginPolylineDrag(latlng, segmentIndex, originalEvent) {
    if (!enabled || !originRef.current || !destinationRef.current) return;
    const session = ++dragSession.current;
    previewSeq.current += 1;
    // Stop map pan immediately — Leaflet may already be mid-drag on mousedown.
    if (map.dragging.enabled()) {
      map.dragging.disable();
      map.dragging._draggable?.finishDrag?.();
    }
    if (map.touchZoom?.disable) map.touchZoom.disable();
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

  function beginViaDrag(via, latlng, originalEvent) {
    if (!enabled) return;
    const session = ++dragSession.current;
    previewSeq.current += 1;
    if (map.dragging.enabled()) {
      map.dragging.disable();
      map.dragging._draggable?.finishDrag?.();
    }
    if (map.touchZoom?.disable) map.touchZoom.disable();
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
    if (originalEvent?.pointerId != null) {
      try {
        map.getContainer().setPointerCapture?.(originalEvent.pointerId);
      } catch {
        /* ignore */
      }
    }
  }

  function handleHitStart(e) {
    L.DomEvent.stop(e);
    const oe = e.originalEvent;
    if (oe?.touches?.length > 1) return; // ignore multi-touch pinch
    const closest = closestPointOnPolyline(
      { lat: e.latlng.lat, lng: e.latlng.lng },
      geometry,
    );
    beginPolylineDrag(e.latlng, closest?.segmentIndex ?? 0, oe);
  }

  if (!enabled || !geometry?.length) return null;

  const displayGeometry =
    dragState?.previewGeometry?.length > 0
      ? dragState.previewGeometry
      : geometry;

  return (
    <>
      {/* Wide invisible hit target above other route panes so drag beats map pan */}
      <Polyline
        positions={geometry}
        pane="routeEditHit"
        pathOptions={{ color: "#000", weight: 44, opacity: 0 }}
        eventHandlers={{
          mousedown: handleHitStart,
          touchstart: handleHitStart,
        }}
      />

      {dragState?.previewGeometry?.length > 0 && (
        <Polyline
          positions={geometry}
          pane="routeEdit"
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
        pane="routeEdit"
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
          icon={getHandleIcon(
            dragState?.viaId === via.id,
            selectedViaId === via.id,
          )}
          eventHandlers={{
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              onSelectVia?.(via.id);
            },
            contextmenu: (e) => {
              L.DomEvent.stopPropagation(e);
              L.DomEvent.preventDefault(e);
              onSelectVia?.(via.id);
              onDeleteVia?.(via.id);
            },
            mousedown: (e) => {
              L.DomEvent.stop(e);
              onSelectVia?.(via.id);
              beginViaDrag(via, e.latlng, e.originalEvent);
            },
            touchstart: (e) => {
              L.DomEvent.stop(e);
              onSelectVia?.(via.id);
              beginViaDrag(via, e.latlng, e.originalEvent);
            },
          }}
          zIndexOffset={2000}
        />
      ))}

      {selectedViaId &&
        vias
          .filter((v) => v.id === selectedViaId)
          .map((via) => (
            <Marker
              key={`del-${via.id}`}
              position={[via.lat, via.lng]}
              icon={viaDeleteIcon()}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  L.DomEvent.preventDefault(e);
                  onDeleteVia?.(via.id);
                },
                mousedown: (e) => {
                  L.DomEvent.stop(e);
                },
              }}
              zIndexOffset={3000}
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
                pane="routeEdit"
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
                pane="routeEdit"
                pathOptions={{
                  color: "#1A73E8",
                  fillColor: "#1A73E8",
                  fillOpacity: dragState.snapped ? 0.95 : 0.35,
                  weight: 2,
                }}
                interactive={false}
              />
            </>
          )}
          <CircleMarker
            center={[dragState.lat, dragState.lng]}
            radius={dragState.snapped ? 10 : 12}
            pane="routeEdit"
            pathOptions={{
              color: dragState.snapped ? "#1A73E8" : "#EA4335",
              fillColor: "#fff",
              fillOpacity: 1,
              weight: 3,
            }}
            interactive={false}
          />
          {!dragState.snapped && (
            <CircleMarker
              center={[dragState.lat, dragState.lng]}
              radius={20}
              pane="routeEdit"
              pathOptions={{
                color: "#EA4335",
                fillOpacity: 0.08,
                weight: 1,
                dashArray: "4 4",
              }}
              interactive={false}
            />
          )}
        </>
      )}
    </>
  );
}
