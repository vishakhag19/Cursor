import { useCallback, useEffect, useRef, useState } from "react";

const GEO_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 10000,
  // Prefer a recently known / browser-provided fix so recenter works
  // even when a fresh high-accuracy reading is unavailable.
  maximumAge: 120000,
};

const GEO_WATCH_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 15000,
};

/**
 * Continuously tracks the user's position when permission is granted.
 */
export default function useGeolocation({ autoStart = true } = {}) {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | locating | ready | denied | unavailable | error
  const [error, setError] = useState(null);
  const watchId = useRef(null);
  const centeredOnce = useRef(false);
  const locationRef = useRef(null);

  const applyPosition = useCallback((pos) => {
    const next = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      timestamp: pos.timestamp,
    };
    locationRef.current = next;
    setLocation(next);
    setStatus("ready");
    setError(null);
  }, []);

  const applyError = useCallback((err) => {
    if (err?.code === 1) {
      setStatus("denied");
      setError("Location permission denied");
    } else if (err?.code === 2) {
      setStatus("unavailable");
      setError("Location unavailable");
    } else if (err?.code === 3) {
      setStatus("error");
      setError("Location request timed out");
    } else {
      setStatus("error");
      setError(err?.message || "Could not get your location");
    }
  }, []);

  const stopWatching = useCallback(() => {
    if (watchId.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      setError("Geolocation is not supported in this browser");
      return;
    }
    stopWatching();
    setStatus((s) => (s === "ready" ? s : "locating"));
    watchId.current = navigator.geolocation.watchPosition(
      applyPosition,
      (err) => {
        // Keep last known fix when a watch update fails.
        if (!locationRef.current) applyError(err);
      },
      GEO_WATCH_OPTIONS,
    );
  }, [applyPosition, applyError, stopWatching]);

  const refresh = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      setError("Geolocation is not supported in this browser");
      // Still usable if we already have a fix from elsewhere.
      if (locationRef.current) {
        return Promise.resolve(locationRef.current);
      }
      return Promise.reject(new Error("unavailable"));
    }
    setStatus((s) => (s === "ready" ? s : "locating"));
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          applyPosition(pos);
          startWatching();
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          // Recenter should still work from the last known / magic base fix.
          const known = locationRef.current;
          if (known?.lat != null && known?.lng != null) {
            setStatus("ready");
            startWatching();
            resolve(known);
            return;
          }
          applyError(err);
          reject(err);
        },
        GEO_OPTIONS,
      );
    });
  }, [applyPosition, applyError, startWatching]);

  useEffect(() => {
    if (!autoStart) return undefined;
    refresh().catch(() => {});
    return () => stopWatching();
  }, [autoStart, refresh, stopWatching]);

  const takeCenteredOnce = useCallback(() => {
    if (centeredOnce.current) return false;
    centeredOnce.current = true;
    return true;
  }, []);

  return {
    location,
    status,
    error,
    refresh,
    startWatching,
    stopWatching,
    takeCenteredOnce,
  };
}

export function toCurrentLocationPlace(location) {
  if (!location) return null;
  return {
    id: "current-location",
    name: "Your location",
    display_name: "Current location",
    lat: location.lat,
    lng: location.lng,
    accuracy: location.accuracy,
    isCurrentLocation: true,
    type: "current",
  };
}
