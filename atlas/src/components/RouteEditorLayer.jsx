import { useEffect, useRef, useState, Fragment } from "react";
import { Marker, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import {
  closestPointOnPolyline,
  nearestRoadPoint,
  rebuildEditedRoute,
} from "../api/routing";

function isCoarsePointer() {
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/** Pixel hit slop for route line / via handles (larger on touch). */
function hitPixels() {
  // Keep the line hit modest so pinch-zoom near the route isn’t stolen.
  return isCoarsePointer() ? 22 : 18;
}

function viaHitPixels() {
  return isCoarsePointer() ? 30 : 22;
}

function viaDeleteIcon() {
  return L.divIcon({
    className: "atlas-via-delete",
    html: `<button type="button" class="via-map-delete" aria-label="Remove reshape point">×</button>`,
    iconSize: [28, 28],
    // Tightly above-right of the vertex (was farther out at [-6, 44]).
    iconAnchor: [2, 32],
  });
}

const VIA_DELETE_ICON = viaDeleteIcon();

function isTouchLikeEvent(e) {
  return (
    e?.pointerType === "touch" ||
    e?.type === "touchstart" ||
    e?.type === "touchmove" ||
    e?.type === "touchend" ||
    Boolean(e?.touches)
  );
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
 * Instant rubber-band path that follows the finger/cursor while OSRM
 * preview catches up — keeps drag feeling glued to the pointer.
 */
function buildLocalPreview(geometry, lat, lng, segmentIndex, viaId, vias) {
  if (!geometry?.length) return [[lat, lng]];

  let seg = segmentIndex;
  if (viaId) {
    const via = vias?.find((v) => v.id === viaId);
    const closest = closestPointOnPolyline(
      via ? { lat: via.lat, lng: via.lng } : { lat, lng },
      geometry,
    );
    seg = closest?.segmentIndex ?? seg ?? 0;
  }

  const maxSeg = Math.max(0, geometry.length - 2);
  const i = Math.max(0, Math.min(seg ?? 0, maxSeg));
  return [...geometry.slice(0, i + 1), [lat, lng], ...geometry.slice(i + 1)];
}

/**
 * Drag-to-reshape the active route (edit mode only).
 * Local rubber-band follows the pointer immediately; dashed OSRM preview
 * refines to roads, then commit snaps permanently.
 */
export default function RouteEditorLayer({
  enabled,
  origin,
  destination,
  stopPins = null,
  vias = [],
  geometry,
  /** Other route geometries — don't steal clicks that belong to an alternate. */
  alternateGeometries = [],
  travelMode = "driving",
  onPreview,
  onSuppressMapClick = null,
  onCommitVia,
  onMoveVia,
  onDeleteVia = null,
  onSelectVia,
  selectedViaId = null,
  onError,
}) {
  const map = useMap();
  const [dragState, setDragState] = useState(null);
  const dragRef = useRef(null);
  const snapTimer = useRef(null);
  const moveRaf = useRef(null);
  const previewSeq = useRef(0);
  const dragSession = useRef(0);
  const listenersRef = useRef(null);
  const geometryRef = useRef(geometry);
  const viasRef = useRef(vias);
  const originRef = useRef(origin);
  const destinationRef = useRef(destination);
  const stopPinsRef = useRef(stopPins);
  const alternateGeometriesRef = useRef(alternateGeometries);
  const travelModeRef = useRef(travelMode);
  const onSelectViaRef = useRef(onSelectVia);
  const onSuppressMapClickRef = useRef(onSuppressMapClick);
  const beginPolylineDragRef = useRef(null);
  const beginViaDragRef = useRef(null);

  geometryRef.current = geometry;
  viasRef.current = vias;
  originRef.current = origin;
  destinationRef.current = destination;
  alternateGeometriesRef.current = alternateGeometries;
  stopPinsRef.current = stopPins;
  travelModeRef.current = travelMode;
  onSelectViaRef.current = onSelectVia;
  onSuppressMapClickRef.current = onSuppressMapClick;

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
    if (L.secondFinger) {
      document.removeEventListener("pointerdown", L.secondFinger, true);
      document.removeEventListener("touchstart", L.secondFinger, true);
    }
    window.removeEventListener("pointerup", L.up, true);
    window.removeEventListener("mouseup", L.up, true);
    listenersRef.current = null;
  }

  function endDragVisual() {
    clearTimeout(snapTimer.current);
    if (moveRaf.current != null) {
      cancelAnimationFrame(moveRaf.current);
      moveRaf.current = null;
    }
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
      if (moveRaf.current != null) cancelAnimationFrame(moveRaf.current);
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
    // Local rubber-band already follows the pointer; OSRM can lag a bit.
    snapTimer.current = setTimeout(() => {
      runPreview(lat, lng, segmentIndex, viaId, session);
    }, 160);
  }

  async function finishDrag(session, { cancel = false } = {}) {
    if (session !== dragSession.current) return;
    clearTimeout(snapTimer.current);
    if (moveRaf.current != null) {
      cancelAnimationFrame(moveRaf.current);
      moveRaf.current = null;
    }
    const state = dragRef.current;
    // Invalidate in-flight previews so they cannot resurrect the cursor.
    previewSeq.current += 1;

    const holdGeom =
      !cancel &&
      state?.movedEnough &&
      (state.previewGeometry?.length > 0
        ? state.previewGeometry
        : state.localPreviewGeometry?.length > 0
          ? state.localPreviewGeometry
          : null);

    map.dragging.enable();
    if (map.touchZoom?.enable) map.touchZoom.enable();
    map.getContainer().classList.remove("is-route-dragging");
    clearDocListeners();

    if (cancel || !state?.active || !state.movedEnough) {
      dragRef.current = null;
      setDragState(null);
      onPreview?.(null);
      return;
    }

    // Suppress the synthetic map click that follows pointer-up before async snap.
    onSuppressMapClickRef.current?.();

    // Keep the last preview visible until commit lands (avoids snap-back lag).
    if (holdGeom) {
      const holding = {
        active: false,
        committing: true,
        session,
        lat: state.snapLat ?? state.lat,
        lng: state.snapLng ?? state.lng,
        snapLat: state.snapLat,
        snapLng: state.snapLng,
        snapped: Boolean(state.snapped),
        previewGeometry: holdGeom,
        localPreviewGeometry: null,
        previewDistance: state.previewDistance,
        previewDuration: state.previewDuration,
        segmentIndex: state.segmentIndex,
        viaId: state.viaId || null,
        movedEnough: true,
      };
      dragRef.current = holding;
      setDragState(holding);
      if (state.previewDuration != null) onPreview?.(holding);
    } else {
      dragRef.current = null;
      setDragState(null);
      onPreview?.(null);
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
    } finally {
      if (session === dragSession.current) {
        dragRef.current = null;
        setDragState(null);
        onPreview?.(null);
      }
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
    // Touch needs a larger slop so tiny finger jitter / zoom setup doesn’t commit.
    const DRAG_PX = isCoarsePointer() ? 18 : 8;

    const onMove = (ev) => {
      if (session !== dragSession.current) return;
      if (!dragRef.current?.active) return;

      // Second finger → pinch zoom; abort reshape and let the map take over.
      if (
        (ev.touches && ev.touches.length > 1) ||
        (ev.pointerType === "touch" &&
          ev.isPrimary === false &&
          ev.type === "pointerdown")
      ) {
        finishDrag(session, { cancel: true });
        return;
      }

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
        if (dx * dx + dy * dy >= DRAG_PX * DRAG_PX) {
          movedEnough = true;
          // Arm click-suppress as soon as reshape is real — before pointer-up.
          onSuppressMapClickRef.current?.();
        }
      }

      const localPreviewGeometry = movedEnough
        ? buildLocalPreview(
            geometryRef.current,
            lat,
            lng,
            dragRef.current.segmentIndex,
            dragRef.current.viaId || null,
            viasRef.current,
          )
        : null;

      dragRef.current = {
        ...dragRef.current,
        lat,
        lng,
        snapped: false,
        movedEnough,
        localPreviewGeometry,
        // Drop stale road preview until the next OSRM result arrives.
        previewGeometry: null,
        previewDistance: null,
        previewDuration: null,
      };

      if (moveRaf.current == null) {
        moveRaf.current = requestAnimationFrame(() => {
          moveRaf.current = null;
          const s = dragRef.current;
          if (!s?.active || session !== dragSession.current) return;
          setDragState((prev) =>
            prev
              ? {
                  ...prev,
                  lat: s.lat,
                  lng: s.lng,
                  snapped: false,
                  movedEnough: s.movedEnough,
                  localPreviewGeometry: s.localPreviewGeometry,
                  previewGeometry: s.previewGeometry,
                  previewDistance: s.previewDistance,
                  previewDuration: s.previewDuration,
                }
              : prev,
          );
          if (s.movedEnough) {
            schedulePreview(
              s.lat,
              s.lng,
              s.segmentIndex,
              s.viaId || null,
              session,
            );
          }
        });
      }
    };

    let finished = false;
    function onUp() {
      if (finished) return;
      finished = true;
      finishDrag(session);
    }

    function onSecondFinger(ev) {
      if (session !== dragSession.current) return;
      if (!dragRef.current?.active) return;
      const multi =
        (ev.touches && ev.touches.length > 1) ||
        (ev.type === "pointerdown" &&
          ev.pointerType === "touch" &&
          ev.isPrimary === false);
      if (!multi) return;
      finishDrag(session, { cancel: true });
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
    document.addEventListener("pointerdown", onSecondFinger, true);
    document.addEventListener("touchstart", onSecondFinger, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("mouseup", onUp, true);
    listenersRef.current = {
      move: onMove,
      moveMouse: onMove,
      moveTouch: onMove,
      touchOpts,
      up: onUp,
      secondFinger: onSecondFinger,
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

  beginPolylineDragRef.current = beginPolylineDrag;
  beginViaDragRef.current = beginViaDrag;

  /**
   * Leaflet only bridges mouse events to vector layers — not touch/pointer.
   * On phones, claim the gesture only after a clear single-finger drag so
   * pinch-zoom / pan near the route aren’t stolen on finger-down.
   */
  useEffect(() => {
    if (!enabled || !geometry?.length) return undefined;

    const container = map.getContainer();
    let pending = null;
    let pendingCleanups = [];

    function clearPending() {
      for (const off of pendingCleanups) off();
      pendingCleanups = [];
      pending = null;
    }

    function clientToLatLng(clientX, clientY) {
      const rect = container.getBoundingClientRect();
      return map.containerPointToLatLng(
        L.point(clientX - rect.left, clientY - rect.top),
      );
    }

    function claimDrag(kind, payload, event) {
      if (event?.cancelable) event.preventDefault();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
      if (kind === "via") {
        onSelectViaRef.current?.(payload.via.id);
        beginViaDragRef.current?.(
          payload.via,
          L.latLng(payload.via.lat, payload.via.lng),
          event,
        );
      } else {
        beginPolylineDragRef.current?.(
          L.latLng(payload.lat, payload.lng),
          payload.segmentIndex ?? 0,
          event,
        );
      }
    }

    function armPending(kind, payload, startEvent, clientX, clientY) {
      clearPending();
      const touch = isTouchLikeEvent(startEvent);
      // Desktop line: claim immediately. Via: wait for move vs tap so a
      // click can select and show × without starting a drag.
      if (!touch && kind !== "via") {
        claimDrag(kind, payload, startEvent);
        return;
      }

      // Touch / via: wait for intentional movement before stealing zoom/pan.
      const pointerId = startEvent.pointerId;
      pending = {
        kind,
        payload,
        x: clientX,
        y: clientY,
        pointerId,
      };
      const CLAIM_PX = kind === "via" ? 10 : 16;

      const onMove = (ev) => {
        if (!pending) return;
        if (ev.touches && ev.touches.length > 1) {
          clearPending();
          return;
        }
        if (
          pointerId != null &&
          ev.pointerId != null &&
          ev.pointerId !== pointerId
        ) {
          return;
        }
        const x = ev.clientX ?? ev.touches?.[0]?.clientX;
        const y = ev.clientY ?? ev.touches?.[0]?.clientY;
        if (x == null || y == null) return;
        const dx = x - pending.x;
        const dy = y - pending.y;
        if (dx * dx + dy * dy < CLAIM_PX * CLAIM_PX) return;

        const { kind: k, payload: p } = pending;
        clearPending();
        claimDrag(k, p, ev);
      };

      const onUp = (ev) => {
        if (!pending) return;
        // Tap on a via selects it without reshaping.
        if (
          pending.kind === "via" &&
          (pointerId == null ||
            ev.pointerId == null ||
            ev.pointerId === pointerId)
        ) {
          onSelectViaRef.current?.(pending.payload.via.id);
        }
        clearPending();
      };

      const onSecondFinger = (ev) => {
        if (!pending) return;
        const multi =
          (ev.touches && ev.touches.length > 1) ||
          (ev.type === "pointerdown" &&
            ev.pointerType === "touch" &&
            (pointerId == null || ev.pointerId !== pointerId));
        if (multi) clearPending();
      };

      const moveOpts = { capture: true, passive: true };
      const claimOpts = { capture: true, passive: false };
      document.addEventListener("pointermove", onMove, claimOpts);
      document.addEventListener("touchmove", onMove, claimOpts);
      document.addEventListener("pointerup", onUp, moveOpts);
      document.addEventListener("pointercancel", onUp, moveOpts);
      document.addEventListener("touchend", onUp, moveOpts);
      document.addEventListener("touchcancel", onUp, moveOpts);
      document.addEventListener("pointerdown", onSecondFinger, moveOpts);
      document.addEventListener("touchstart", onSecondFinger, moveOpts);
      pendingCleanups = [
        () => document.removeEventListener("pointermove", onMove, claimOpts),
        () => document.removeEventListener("touchmove", onMove, claimOpts),
        () => document.removeEventListener("pointerup", onUp, moveOpts),
        () => document.removeEventListener("pointercancel", onUp, moveOpts),
        () => document.removeEventListener("touchend", onUp, moveOpts),
        () => document.removeEventListener("touchcancel", onUp, moveOpts),
        () =>
          document.removeEventListener("pointerdown", onSecondFinger, moveOpts),
        () =>
          document.removeEventListener("touchstart", onSecondFinger, moveOpts),
      ];
    }

    function onPointerDown(e) {
      if (!enabled || dragRef.current?.active || pending) return;
      // Prefer pointer events; ignore redundant touchstart when PointerEvent exists.
      if (e.type === "touchstart" && typeof window.PointerEvent === "function") {
        return;
      }
      if (e.pointerType === "mouse" && e.button != null && e.button !== 0) {
        return;
      }
      if (e.isPrimary === false) return;
      if (e.touches && e.touches.length > 1) return;

      const target = e.target;
      if (
        target?.closest?.(
          ".leaflet-control, .via-map-delete, .atlas-via-delete, button, a, input, textarea",
        )
      ) {
        return;
      }
      // Stop pins own the gesture unless a via is under the press (checked below).
      const onPinChrome = Boolean(
        target?.closest?.(".leaflet-marker-icon, .atlas-pin"),
      );

      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY;
      if (clientX == null || clientY == null) return;

      const latlng = clientToLatLng(clientX, clientY);
      const pt = map.latLngToContainerPoint(latlng);

      // Prefer vias over coinciding stop pins so × selection works on mid-stops.
      const viasNow = viasRef.current;
      let bestVia = null;
      let bestViaDist = Infinity;
      for (const via of viasNow) {
        const vp = map.latLngToContainerPoint([via.lat, via.lng]);
        const d = Math.hypot(vp.x - pt.x, vp.y - pt.y);
        if (d < bestViaDist) {
          bestViaDist = d;
          bestVia = via;
        }
      }
      if (bestVia && bestViaDist <= viaHitPixels()) {
        armPending("via", { via: bestVia }, e, clientX, clientY);
        return;
      }

      if (onPinChrome) return;

      // Bail when the press is on a stop pin (anchor is tip of teardrop).
      const PIN_HIT_PX = 28;
      const pins =
        stopPinsRef.current?.length > 0
          ? stopPinsRef.current
          : [originRef.current, destinationRef.current];
      for (const stop of pins) {
        if (stop?.lat == null || stop?.lng == null) continue;
        if (stop.isCurrentLocation) continue;
        const sp = map.latLngToContainerPoint([stop.lat, stop.lng]);
        if (Math.hypot(sp.x - pt.x, sp.y - pt.y) <= PIN_HIT_PX) {
          return;
        }
      }

      const geom = geometryRef.current;
      const closest = closestPointOnPolyline(
        { lat: latlng.lat, lng: latlng.lng },
        geom,
      );
      if (!closest) return;
      const closestPt = map.latLngToContainerPoint([closest.lat, closest.lng]);
      const selectedDist = Math.hypot(closestPt.x - pt.x, closestPt.y - pt.y);
      if (selectedDist > hitPixels()) {
        return;
      }

      // If an alternate is closer, let MapView's hit polyline select it.
      let altDist = Infinity;
      for (const altGeom of alternateGeometriesRef.current || []) {
        const altClosest = closestPointOnPolyline(
          { lat: latlng.lat, lng: latlng.lng },
          altGeom,
        );
        if (!altClosest) continue;
        const ap = map.latLngToContainerPoint([
          altClosest.lat,
          altClosest.lng,
        ]);
        const d = Math.hypot(ap.x - pt.x, ap.y - pt.y);
        if (d < altDist) altDist = d;
      }
      if (altDist + 2 < selectedDist) {
        return;
      }

      armPending(
        "line",
        { lat: closest.lat, lng: closest.lng, segmentIndex: closest.segmentIndex },
        e,
        clientX,
        clientY,
      );
    }

    const opts = { capture: true, passive: true };
    container.addEventListener("pointerdown", onPointerDown, opts);
    container.addEventListener("touchstart", onPointerDown, opts);
    return () => {
      clearPending();
      container.removeEventListener("pointerdown", onPointerDown, opts);
      container.removeEventListener("touchstart", onPointerDown, opts);
    };
  }, [enabled, map, geometry]);

  if (!enabled || !geometry?.length) return null;

  const displayGeometry =
    dragState?.previewGeometry?.length > 0
      ? dragState.previewGeometry
      : dragState?.localPreviewGeometry?.length > 0
        ? dragState.localPreviewGeometry
        : geometry;

  const isDragging = Boolean(dragState?.active);
  const isCommitting = Boolean(dragState?.committing);

  return (
    <>
      {/* Visual-width guide for hit testing (events handled on map container) */}
      <Polyline
        positions={geometry}
        pane="routeEditHit"
        pathOptions={{ color: "#000", weight: 44, opacity: 0.01 }}
        interactive={false}
      />

      {(dragState?.previewGeometry?.length > 0 ||
        dragState?.localPreviewGeometry?.length > 0) && (
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
          color: isDragging || isCommitting ? "#F9AB00" : "#1A73E8",
          weight: 6,
          opacity: 0.95,
          dashArray: isDragging || isCommitting ? "10 8" : null,
          lineJoin: "round",
          lineCap: "round",
        }}
        interactive={false}
      />

      {/* Persistent vector points for reshape vias — tap to select + delete.
          Not stop pins; small vertices on the route. */}
      {vias.map((via) => {
        const draggingThis = dragState?.viaId === via.id && dragState?.active;
        if (draggingThis) return null;
        const selected = selectedViaId === via.id;
        return (
          <Fragment key={via.id}>
            <CircleMarker
              center={[via.lat, via.lng]}
              radius={selected ? 6 : 5}
              pane="routeEdit"
              interactive={false}
              pathOptions={{
                color: "#5f6368",
                fillColor: "#fff",
                fillOpacity: 1,
                weight: selected ? 3 : 2.5,
              }}
            />
            {selected ? (
              <Marker
                position={[via.lat, via.lng]}
                icon={VIA_DELETE_ICON}
                interactive
                zIndexOffset={4000}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e.originalEvent);
                    L.DomEvent.preventDefault(e.originalEvent);
                    onDeleteVia?.(via.id);
                    onSelectVia?.(null);
                  },
                }}
              />
            ) : null}
          </Fragment>
        );
      })}

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
                radius={5}
                pane="routeEdit"
                pathOptions={{
                  color: "#5f6368",
                  fillColor: "#fff",
                  fillOpacity: 1,
                  weight: 2.5,
                }}
                interactive={false}
              />
            </>
          )}
          {!dragState.snapped && (
            <CircleMarker
              center={[dragState.lat, dragState.lng]}
              radius={6}
              pane="routeEdit"
              pathOptions={{
                color: "#9AA0A6",
                fillColor: "#fff",
                fillOpacity: 1,
                weight: 2,
              }}
              interactive={false}
            />
          )}
        </>
      )}
    </>
  );
}
