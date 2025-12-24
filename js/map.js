let map;
let layerCachesCluster;
let layerVendors;
const VENDOR_TYPES = new Set(["marrons", "fruits_legumes", "eau"]);

export function initMap(targetId) {
  map = L.map(targetId).setView([48.8566, 2.3522], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
  layerCachesCluster = L.markerClusterGroup();
  map.addLayer(layerCachesCluster);
  layerVendors = L.layerGroup().addTo(map);
  return map;
}

function getVendorLabel(type) {
  if (type === "marrons") return "Vendeur de marrons";
  if (type === "fruits_legumes") return "Vendeur fruits/légumes";
  if (type === "eau") return "Vendeur d’eau";
  return type;
}

const cartIcon = L.divIcon({
  className: "cart-icon",
  html: "🛒",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export function renderMarkers(caches) {
  if (!map) return;
  layerCachesCluster.clearLayers();
  layerVendors.clearLayers();
  caches.forEach((cache) => {
    const isVendor = VENDOR_TYPES.has(cache.type);
    const marker = L.marker([cache.lat, cache.lng], isVendor ? { icon: cartIcon } : {});
    const title = isVendor ? getVendorLabel(cache.type) : cache.type;
    const popup = `<strong>${title}</strong><br/>${cache.note || ""}`;
    marker.bindPopup(popup);
    if (isVendor) {
      marker.addTo(layerVendors);
    } else {
      marker.addTo(layerCachesCluster);
    }
  });
}

export function centerOn(lat, lng, zoom = 15) {
  if (!map) return;
  map.setView([lat, lng], zoom, { animate: true });
}

export function getMap() {
  return map;
}

export function invalidateMapSize() {
  if (!map) return;
  map.invalidateSize();
}
