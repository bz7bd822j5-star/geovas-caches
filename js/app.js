import { getAllCaches, upsertCache, bulkUpsert, clearCaches } from "./db.js";
import { postCache, pullSince } from "./api.js";
import { initMap, renderMarkers, centerOn, getMap, invalidateMapSize } from "./map.js";

const listEl = document.getElementById("cacheList");
const statusEl = document.getElementById("status");
const btnGps = document.getElementById("btnGps");
const btnRefresh = document.getElementById("btnRefresh");
const btnExport = document.getElementById("btnExport");
const btnReset = document.getElementById("btnReset");
const btnToggleList = document.getElementById("btnToggleList");
const listPanel = document.getElementById("listPanel");

const LAST_SYNC_KEY = "geovas_lastSync";
const SEED_URL = "data/caches_public.json";

function setStatus(message, cachesCount = null) {
  const lastSync = localStorage.getItem(LAST_SYNC_KEY) || "-";
  const countText = cachesCount !== null ? `${cachesCount} cache(s)` : "-";
  statusEl.textContent = `${message} | ${countText} | lastSync: ${lastSync}`;
}

function renderList(caches) {
  listEl.innerHTML = "";
  const sorted = [...caches].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  sorted.forEach((cache) => {
    const item = document.createElement("li");
    item.className = "cache-item";
    item.innerHTML = `
      <strong>${cache.type}</strong>
      <span>${cache.lat.toFixed(5)}, ${cache.lng.toFixed(5)} | ${cache.updated_at}</span>
    `;
    item.addEventListener("click", () => centerOn(cache.lat, cache.lng, 16));
    listEl.appendChild(item);
  });
  renderMarkers(sorted);
  setStatus("Pret.", sorted.length);
}

async function refreshUI() {
  const caches = await getAllCaches();
  renderList(caches);
}

async function bootstrapSeedIfEmpty() {
  const caches = await getAllCaches();
  if (caches.length > 0) return;
  try {
    const response = await fetch(SEED_URL);
    if (!response.ok) throw new Error("Seed fetch failed");
    const seed = await response.json();
    if (Array.isArray(seed) && seed.length > 0) {
      await bulkUpsert(seed);
    }
  } catch (error) {
    setStatus("Seed indisponible.");
  }
}

async function handleMapClick(e) {
  const type = window.prompt("Type de cache ?");
  if (!type) return;
  const adresse = window.prompt("Adresse (optionnel)") || "";
  const note = window.prompt("Note (optionnel)") || "";

  const now = new Date().toISOString();
  const cache = {
    id: crypto.randomUUID(),
    lat: e.latlng.lat,
    lng: e.latlng.lng,
    type,
    adresse,
    note,
    created_at: now,
    updated_at: now,
    source: "local",
    sync_pending: true,
  };

  await upsertCache(cache);
  await refreshUI();

  try {
    await postCache(cache);
    cache.sync_pending = false;
    await upsertCache(cache);
    setStatus("Cache envoyee.");
  } catch (error) {
    setStatus("Sauvee localement. Sync en attente.");
  }
}

async function syncPendingCaches() {
  if (!navigator.onLine) return;
  const caches = await getAllCaches();
  const pending = caches.filter((cache) => cache.sync_pending);
  for (const cache of pending) {
    try {
      await postCache(cache);
      await upsertCache({ ...cache, sync_pending: false });
    } catch (error) {
      break;
    }
  }
}

async function pullAndMerge() {
  setStatus("Sync en cours...");
  const since = localStorage.getItem(LAST_SYNC_KEY);
  try {
    await syncPendingCaches();
    const result = await pullSince(since);
    if (result && result.ok && Array.isArray(result.data)) {
      if (result.data.length > 0) {
        await bulkUpsert(result.data);
        const maxUpdated = result.data.reduce(
          (max, item) => (item.updated_at > max ? item.updated_at : max),
          result.data[0].updated_at
        );
        localStorage.setItem(LAST_SYNC_KEY, maxUpdated);
      } else {
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      }
      await refreshUI();
      setStatus("Sync terminee.");
    } else {
      setStatus("Sync invalide.");
    }
  } catch (error) {
    setStatus("Sync echouee.");
  }
}

async function exportCaches() {
  const caches = await getAllCaches();
  const blob = new Blob([JSON.stringify(caches, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "geovas_caches_export.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function resetCaches() {
  const confirmed = window.confirm("Supprimer tous les caches locaux ?");
  if (!confirmed) return;
  await clearCaches();
  await refreshUI();
  setStatus("Caches locaux supprimes.");
}

function locateGps() {
  if (!navigator.geolocation) {
    setStatus("Geolocalisation indisponible.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      centerOn(position.coords.latitude, position.coords.longitude, 15);
    },
    () => {
      setStatus("GPS refuse.");
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }
}

function initApp() {
  const map = initMap("map");
  map.on("click", handleMapClick);
  btnRefresh.addEventListener("click", pullAndMerge);
  btnExport.addEventListener("click", exportCaches);
  btnReset.addEventListener("click", resetCaches);
  btnGps.addEventListener("click", locateGps);
  btnToggleList.addEventListener("click", () => {
    listPanel.classList.toggle("is-collapsed");
    const isCollapsed = listPanel.classList.contains("is-collapsed");
    btnToggleList.textContent = isCollapsed ? "Liste ↑" : "Liste ↓";
    setTimeout(invalidateMapSize, 200);
  });

  bootstrapSeedIfEmpty()
    .then(refreshUI)
    .then(pullAndMerge);
  setInterval(pullAndMerge, 10000);
  registerServiceWorker();

  window.addEventListener("online", pullAndMerge);

  let resizeTimer;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(invalidateMapSize, 200);
  });
}

initApp();
