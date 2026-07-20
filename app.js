(() => {
  const NOMINATIM = "https://nominatim.openstreetmap.org";
  const OSRM = "https://router.project-osrm.org";
  const STORAGE_KEY = "atlas.savedRoutes.v1";
  const DEFAULT_CENTER = [37.7749, -122.4194];
  const DEFAULT_ZOOM = 13;

  const state = {
    mode: "explore",
    searchMarker: null,
    dirFrom: null,
    dirTo: null,
    dirMarkers: { from: null, to: null },
    dirLine: null,
    waypoints: [],
    createMarkers: [],
    createLine: null,
    createGeometry: null,
    createStats: null,
    activeSuggestTarget: null,
    ctxLatLng: null,
  };

  const els = {
    app: document.getElementById("app"),
    panel: document.getElementById("panel"),
    togglePanel: document.getElementById("toggle-panel"),
    expandPanel: document.getElementById("expand-panel"),
    modeTabs: [...document.querySelectorAll(".mode-tab")],
    modePanels: [...document.querySelectorAll("[data-mode-panel]")],
    exploreForm: document.getElementById("explore-form"),
    exploreQuery: document.getElementById("explore-query"),
    exploreClear: document.getElementById("explore-clear"),
    exploreSuggestions: document.getElementById("explore-suggestions"),
    placeCard: document.getElementById("place-card"),
    directionsForm: document.getElementById("directions-form"),
    dirFrom: document.getElementById("dir-from"),
    dirTo: document.getElementById("dir-to"),
    dirSwap: document.getElementById("dir-swap"),
    dirSuggestions: document.getElementById("dir-suggestions"),
    dirSummary: document.getElementById("dir-summary"),
    routeName: document.getElementById("route-name"),
    waypointCount: document.getElementById("waypoint-count"),
    waypointList: document.getElementById("waypoint-list"),
    undoStop: document.getElementById("undo-stop"),
    clearStops: document.getElementById("clear-stops"),
    buildRoute: document.getElementById("build-route"),
    saveRoute: document.getElementById("save-route"),
    createSummary: document.getElementById("create-summary"),
    savedList: document.getElementById("saved-list"),
    emptySaved: document.getElementById("empty-saved"),
    mapStatus: document.getElementById("map-status"),
    locateMe: document.getElementById("locate-me"),
    contextMenu: document.getElementById("context-menu"),
  };

  const map = L.map("map", {
    zoomControl: false,
    attributionControl: true,
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  let statusTimer = null;
  function showStatus(message, ms = 2800) {
    els.mapStatus.hidden = false;
    els.mapStatus.textContent = message;
    clearTimeout(statusTimer);
    if (ms > 0) {
      statusTimer = setTimeout(() => {
        els.mapStatus.hidden = true;
      }, ms);
    }
  }

  function hideStatus() {
    els.mapStatus.hidden = true;
    clearTimeout(statusTimer);
  }

  function pinIcon(kind, label) {
    return L.divIcon({
      className: "pin-label",
      html: `<div class="pin-bubble ${kind}"><span>${label}</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
  }

  async function geocode(query) {
    const url = new URL(`${NOMINATIM}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("Search failed");
    return res.json();
  }

  async function reverseGeocode(lat, lng) {
    const url = new URL(`${NOMINATIM}/reverse`);
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lng);
    url.searchParams.set("format", "json");
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("Reverse geocode failed");
    return res.json();
  }

  async function routeDriving(coords) {
    // coords: [{lat, lng}, ...]
    const path = coords.map((c) => `${c.lng},${c.lat}`).join(";");
    const url = `${OSRM}/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Routing failed");
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) {
      throw new Error(data.message || "No route found");
    }
    return data.routes[0];
  }

  function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
  }

  function formatDuration(seconds) {
    const m = Math.round(seconds / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem ? `${h} hr ${rem} min` : `${h} hr`;
  }

  function placeLabel(item) {
    const name =
      item.name ||
      item.display_name?.split(",")[0] ||
      "Selected place";
    return {
      title: name,
      subtitle: item.display_name || `${item.lat?.toFixed?.(5)}, ${item.lon?.toFixed?.(5)}`,
      lat: Number(item.lat),
      lng: Number(item.lon ?? item.lng),
    };
  }

  function debounce(fn, wait = 280) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function renderSuggestions(container, results, onPick) {
    container.innerHTML = "";
    if (!results.length) {
      container.hidden = true;
      return;
    }
    results.forEach((item) => {
      const place = placeLabel(item);
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = `<span class="place-title"></span><span class="place-sub"></span>`;
      btn.querySelector(".place-title").textContent = place.title;
      btn.querySelector(".place-sub").textContent = place.subtitle;
      btn.addEventListener("click", () => onPick(place));
      li.appendChild(btn);
      container.appendChild(li);
    });
    container.hidden = false;
  }

  function setMode(mode) {
    state.mode = mode;
    els.modeTabs.forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    els.modePanels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.modePanel === mode);
    });
    hideContextMenu();

    if (mode === "create") {
      showStatus("Create route: click the map to add stops", 3500);
      map.getContainer().style.cursor = "crosshair";
    } else {
      map.getContainer().style.cursor = "";
    }
  }

  function setExplorePlace(place) {
    if (state.searchMarker) {
      map.removeLayer(state.searchMarker);
    }
    state.searchMarker = L.marker([place.lat, place.lng], {
      icon: pinIcon("search", "★"),
      title: place.title,
    }).addTo(map);
    map.setView([place.lat, place.lng], Math.max(map.getZoom(), 15));
    els.placeCard.hidden = false;
    els.placeCard.innerHTML = `<h2></h2><p></p>`;
    els.placeCard.querySelector("h2").textContent = place.title;
    els.placeCard.querySelector("p").textContent = place.subtitle;
    els.exploreQuery.value = place.title;
    els.exploreClear.hidden = false;
    els.exploreSuggestions.hidden = true;
  }

  async function updateDirections() {
    if (!state.dirFrom || !state.dirTo) return;
    showStatus("Finding the best route…", 0);
    try {
      const route = await routeDriving([state.dirFrom, state.dirTo]);
      if (state.dirLine) map.removeLayer(state.dirLine);
      const latlngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      state.dirLine = L.polyline(latlngs, {
        color: "#1a73e8",
        weight: 6,
        opacity: 0.9,
        lineJoin: "round",
      }).addTo(map);
      map.fitBounds(state.dirLine.getBounds(), { padding: [48, 48] });
      els.dirSummary.hidden = false;
      els.dirSummary.innerHTML = `<strong>${formatDuration(route.duration)} · ${formatDistance(route.distance)}</strong><span>Fastest driving route via OpenStreetMap roads</span>`;
      hideStatus();
    } catch (err) {
      showStatus(err.message || "Could not find a route");
    }
  }

  function setDirPoint(which, place) {
    state[which === "from" ? "dirFrom" : "dirTo"] = place;
    els[which === "from" ? "dirFrom" : "dirTo"].value = place.title;

    const existing = state.dirMarkers[which];
    if (existing) map.removeLayer(existing);
    state.dirMarkers[which] = L.marker([place.lat, place.lng], {
      icon: pinIcon(which === "from" ? "start" : "end", which === "from" ? "A" : "B"),
      title: place.title,
      draggable: true,
    }).addTo(map);

    state.dirMarkers[which].on("dragend", async (e) => {
      const { lat, lng } = e.target.getLatLng();
      try {
        const rev = await reverseGeocode(lat, lng);
        const place2 = placeLabel({ ...rev, lat, lon: lng });
        setDirPoint(which, place2);
        updateDirections();
      } catch {
        setDirPoint(which, { title: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, subtitle: "Dropped pin", lat, lng });
        updateDirections();
      }
    });

    if (state.dirFrom && state.dirTo) updateDirections();
    else map.setView([place.lat, place.lng], Math.max(map.getZoom(), 14));
  }

  function refreshWaypointUI() {
    const n = state.waypoints.length;
    els.waypointCount.textContent = `${n} stop${n === 1 ? "" : "s"}`;
    els.undoStop.disabled = n === 0;
    els.clearStops.disabled = n === 0;
    els.buildRoute.disabled = n < 2;
    els.saveRoute.disabled = !state.createGeometry;

    els.waypointList.innerHTML = "";
    state.waypoints.forEach((wp, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="idx">${i + 1}</span><span class="label"></span><button class="remove" type="button" aria-label="Remove stop">×</button>`;
      li.querySelector(".label").textContent = wp.title;
      li.querySelector(".remove").addEventListener("click", () => removeWaypoint(i));
      els.waypointList.appendChild(li);
    });
  }

  function syncCreateMarkers() {
    state.createMarkers.forEach((m) => map.removeLayer(m));
    state.createMarkers = state.waypoints.map((wp, i) => {
      const kind = i === 0 ? "start" : i === state.waypoints.length - 1 && state.waypoints.length > 1 ? "end" : "stop";
      const label = String(i + 1);
      const marker = L.marker([wp.lat, wp.lng], {
        icon: pinIcon(kind, label),
        draggable: true,
        title: wp.title,
      }).addTo(map);

      marker.on("dragend", async (e) => {
        const { lat, lng } = e.target.getLatLng();
        try {
          const rev = await reverseGeocode(lat, lng);
          state.waypoints[i] = placeLabel({ ...rev, lat, lon: lng });
        } catch {
          state.waypoints[i] = {
            title: `Stop ${i + 1}`,
            subtitle: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            lat,
            lng,
          };
        }
        state.createGeometry = null;
        state.createStats = null;
        els.createSummary.hidden = true;
        els.saveRoute.disabled = true;
        if (state.createLine) {
          map.removeLayer(state.createLine);
          state.createLine = null;
        }
        refreshWaypointUI();
        syncCreateMarkers();
      });
      return marker;
    });
  }

  async function addWaypoint(latlng, prefilled) {
    let place = prefilled;
    if (!place) {
      try {
        const rev = await reverseGeocode(latlng.lat, latlng.lng);
        place = placeLabel({ ...rev, lat: latlng.lat, lon: latlng.lng });
      } catch {
        place = {
          title: `Stop ${state.waypoints.length + 1}`,
          subtitle: `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`,
          lat: latlng.lat,
          lng: latlng.lng,
        };
      }
    }
    state.waypoints.push(place);
    state.createGeometry = null;
    state.createStats = null;
    els.createSummary.hidden = true;
    if (state.createLine) {
      map.removeLayer(state.createLine);
      state.createLine = null;
    }
    refreshWaypointUI();
    syncCreateMarkers();
  }

  function removeWaypoint(index) {
    state.waypoints.splice(index, 1);
    state.createGeometry = null;
    state.createStats = null;
    els.createSummary.hidden = true;
    if (state.createLine) {
      map.removeLayer(state.createLine);
      state.createLine = null;
    }
    refreshWaypointUI();
    syncCreateMarkers();
  }

  function clearWaypoints() {
    state.waypoints = [];
    state.createGeometry = null;
    state.createStats = null;
    els.createSummary.hidden = true;
    els.saveRoute.disabled = true;
    if (state.createLine) {
      map.removeLayer(state.createLine);
      state.createLine = null;
    }
    state.createMarkers.forEach((m) => map.removeLayer(m));
    state.createMarkers = [];
    refreshWaypointUI();
  }

  async function buildCustomRoute() {
    if (state.waypoints.length < 2) return;
    showStatus("Building your route…", 0);
    try {
      const route = await routeDriving(state.waypoints);
      if (state.createLine) map.removeLayer(state.createLine);
      const latlngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      state.createLine = L.polyline(latlngs, {
        color: "#0b57d0",
        weight: 7,
        opacity: 0.92,
        lineJoin: "round",
      }).addTo(map);
      state.createGeometry = route.geometry;
      state.createStats = {
        distance: route.distance,
        duration: route.duration,
      };
      map.fitBounds(state.createLine.getBounds(), { padding: [56, 56] });
      els.createSummary.hidden = false;
      els.createSummary.innerHTML = `<strong>${formatDuration(route.duration)} · ${formatDistance(route.distance)}</strong><span>${state.waypoints.length} stops · road-snapped custom route</span>`;
      els.saveRoute.disabled = false;
      hideStatus();
      showStatus("Route ready — you can save it", 2500);
    } catch (err) {
      showStatus(err.message || "Could not build route");
    }
  }

  function loadSavedRoutes() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function persistSavedRoutes(routes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  }

  function renderSavedRoutes() {
    const routes = loadSavedRoutes();
    els.savedList.innerHTML = "";
    els.emptySaved.hidden = routes.length > 0;
    routes.forEach((route) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="saved-meta">
          <strong></strong>
          <span></span>
        </div>
        <div class="saved-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-act="load">Open</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="delete">Delete</button>
        </div>`;
      li.querySelector("strong").textContent = route.name;
      li.querySelector("span").textContent = `${route.waypoints.length} stops · ${formatDistance(route.distance)} · ${formatDuration(route.duration)}`;
      li.querySelector('[data-act="load"]').addEventListener("click", () => openSavedRoute(route));
      li.querySelector('[data-act="delete"]').addEventListener("click", () => {
        const next = loadSavedRoutes().filter((r) => r.id !== route.id);
        persistSavedRoutes(next);
        renderSavedRoutes();
      });
      els.savedList.appendChild(li);
    });
  }

  function saveCurrentRoute() {
    if (!state.createGeometry || !state.createStats || state.waypoints.length < 2) return;
    const name = (els.routeName.value || "").trim() || `My route ${new Date().toLocaleDateString()}`;
    const routes = loadSavedRoutes();
    const entry = {
      id: `route_${Date.now()}`,
      name,
      waypoints: state.waypoints.map((w) => ({ ...w })),
      geometry: state.createGeometry,
      distance: state.createStats.distance,
      duration: state.createStats.duration,
      createdAt: new Date().toISOString(),
    };
    routes.unshift(entry);
    persistSavedRoutes(routes.slice(0, 40));
    els.routeName.value = name;
    renderSavedRoutes();
    showStatus(`Saved “${name}”`, 2500);
  }

  function openSavedRoute(route) {
    setMode("create");
    clearWaypoints();
    state.waypoints = route.waypoints.map((w) => ({ ...w }));
    els.routeName.value = route.name;
    refreshWaypointUI();
    syncCreateMarkers();
    if (state.createLine) map.removeLayer(state.createLine);
    const latlngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    state.createLine = L.polyline(latlngs, {
      color: "#0b57d0",
      weight: 7,
      opacity: 0.92,
      lineJoin: "round",
    }).addTo(map);
    state.createGeometry = route.geometry;
    state.createStats = { distance: route.distance, duration: route.duration };
    els.createSummary.hidden = false;
    els.createSummary.innerHTML = `<strong>${formatDuration(route.duration)} · ${formatDistance(route.distance)}</strong><span>${route.waypoints.length} stops · saved custom route</span>`;
    els.saveRoute.disabled = false;
    map.fitBounds(state.createLine.getBounds(), { padding: [56, 56] });
    showStatus(`Opened “${route.name}”`, 2200);
  }

  function hideContextMenu() {
    els.contextMenu.hidden = true;
    state.ctxLatLng = null;
  }

  function showContextMenu(latlng, containerPoint) {
    state.ctxLatLng = latlng;
    els.contextMenu.hidden = false;
    const shell = els.contextMenu.parentElement.getBoundingClientRect();
    const x = Math.min(containerPoint.x, shell.width - 220);
    const y = Math.min(containerPoint.y, shell.height - 140);
    els.contextMenu.style.left = `${Math.max(8, x)}px`;
    els.contextMenu.style.top = `${Math.max(8, y)}px`;
  }

  // --- Event wiring ---
  els.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
  });

  els.togglePanel.addEventListener("click", () => {
    els.app.classList.add("panel-collapsed");
    els.expandPanel.hidden = false;
    setTimeout(() => map.invalidateSize(), 200);
  });

  els.expandPanel.addEventListener("click", () => {
    els.app.classList.remove("panel-collapsed");
    els.expandPanel.hidden = true;
    setTimeout(() => map.invalidateSize(), 200);
  });

  const runExploreSuggest = debounce(async () => {
    const q = els.exploreQuery.value.trim();
    els.exploreClear.hidden = !q;
    if (q.length < 2) {
      els.exploreSuggestions.hidden = true;
      return;
    }
    try {
      const results = await geocode(q);
      renderSuggestions(els.exploreSuggestions, results, setExplorePlace);
    } catch {
      showStatus("Search unavailable right now");
    }
  });

  els.exploreQuery.addEventListener("input", runExploreSuggest);
  els.exploreClear.addEventListener("click", () => {
    els.exploreQuery.value = "";
    els.exploreClear.hidden = true;
    els.exploreSuggestions.hidden = true;
    els.placeCard.hidden = true;
    if (state.searchMarker) {
      map.removeLayer(state.searchMarker);
      state.searchMarker = null;
    }
  });

  els.exploreForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = els.exploreQuery.value.trim();
    if (!q) return;
    try {
      const results = await geocode(q);
      if (!results.length) {
        showStatus("No places found");
        return;
      }
      setExplorePlace(placeLabel(results[0]));
    } catch {
      showStatus("Search failed");
    }
  });

  function wireDirSuggest(input, which) {
    const run = debounce(async () => {
      const q = input.value.trim();
      state.activeSuggestTarget = which;
      if (q.length < 2) {
        els.dirSuggestions.hidden = true;
        return;
      }
      try {
        const results = await geocode(q);
        renderSuggestions(els.dirSuggestions, results, (place) => {
          setDirPoint(which, place);
          els.dirSuggestions.hidden = true;
        });
      } catch {
        showStatus("Search unavailable");
      }
    });
    input.addEventListener("input", run);
    input.addEventListener("focus", () => {
      state.activeSuggestTarget = which;
    });
  }

  wireDirSuggest(els.dirFrom, "from");
  wireDirSuggest(els.dirTo, "to");

  els.directionsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fromQ = els.dirFrom.value.trim();
    const toQ = els.dirTo.value.trim();
    if (!fromQ || !toQ) {
      showStatus("Enter a start and destination");
      return;
    }
    try {
      showStatus("Looking up places…", 0);
      const [fromResults, toResults] = await Promise.all([geocode(fromQ), geocode(toQ)]);
      if (!fromResults.length || !toResults.length) {
        showStatus("Could not find one of those places");
        return;
      }
      setDirPoint("from", placeLabel(fromResults[0]));
      setDirPoint("to", placeLabel(toResults[0]));
    } catch {
      showStatus("Directions search failed");
    }
  });

  els.dirSwap.addEventListener("click", () => {
    const a = state.dirFrom;
    const b = state.dirTo;
    const aVal = els.dirFrom.value;
    const bVal = els.dirTo.value;
    els.dirFrom.value = bVal;
    els.dirTo.value = aVal;
    if (a && b) {
      setDirPoint("from", b);
      setDirPoint("to", a);
    }
  });

  els.undoStop.addEventListener("click", () => {
    if (!state.waypoints.length) return;
    removeWaypoint(state.waypoints.length - 1);
  });

  els.clearStops.addEventListener("click", () => {
    clearWaypoints();
    showStatus("Stops cleared");
  });

  els.buildRoute.addEventListener("click", buildCustomRoute);
  els.saveRoute.addEventListener("click", saveCurrentRoute);

  els.locateMe.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showStatus("Geolocation not supported");
      return;
    }
    showStatus("Finding your location…", 0);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        map.setView([lat, lng], 15);
        L.circleMarker([lat, lng], {
          radius: 8,
          color: "#fff",
          weight: 2,
          fillColor: "#1a73e8",
          fillOpacity: 1,
        }).addTo(map);
        hideStatus();
      },
      () => showStatus("Could not get your location"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  map.on("click", async (e) => {
    hideContextMenu();
    if (state.mode === "create") {
      showStatus("Adding stop…", 0);
      await addWaypoint(e.latlng);
      hideStatus();
      return;
    }
    if (state.mode === "explore") {
      try {
        const rev = await reverseGeocode(e.latlng.lat, e.latlng.lng);
        setExplorePlace(placeLabel({ ...rev, lat: e.latlng.lat, lon: e.latlng.lng }));
      } catch {
        setExplorePlace({
          title: "Dropped pin",
          subtitle: `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`,
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        });
      }
    }
  });

  map.on("contextmenu", (e) => {
    L.DomEvent.preventDefault(e.originalEvent);
    showContextMenu(e.latlng, e.containerPoint);
  });

  map.on("movestart", hideContextMenu);

  els.contextMenu.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-ctx]");
    if (!btn || !state.ctxLatLng) return;
    const action = btn.dataset.ctx;
    const latlng = state.ctxLatLng;
    hideContextMenu();

    let place;
    try {
      const rev = await reverseGeocode(latlng.lat, latlng.lng);
      place = placeLabel({ ...rev, lat: latlng.lat, lon: latlng.lng });
    } catch {
      place = {
        title: "Dropped pin",
        subtitle: `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`,
        lat: latlng.lat,
        lng: latlng.lng,
      };
    }

    if (action === "start") {
      setMode("directions");
      setDirPoint("from", place);
    } else if (action === "end") {
      setMode("directions");
      setDirPoint("to", place);
    } else if (action === "add-stop") {
      setMode("create");
      await addWaypoint(latlng, place);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideContextMenu();
  });

  // Boot
  refreshWaypointUI();
  renderSavedRoutes();
  showStatus("Welcome to Atlas — try Create route", 3200);
})();
