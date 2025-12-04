// ===== CONFIGURATION SUPABASE =====
const SUPABASE_URL = 'https://zlxdjdtncejcmmohfooi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_o-b9PAhhEVm9KRYuOs8gkA_BeAisxz3';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Initialisation de la carte (Paris centrée)
const map = L.map('map').setView([48.8566, 2.3522], 13);

// Fond OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

// Stockage des points (utilisé comme cache local)
let caches = [];

// Variables pour le popup type
let pendingLat = null;
let pendingLng = null;
let pendingSource = null; // "manuel" ou "gps"

// ===== MODE ADMINISTRATEUR =====
const ADMIN_PASSWORD = 'admin123'; // Mot de passe admin
let isAdminMode = false;

// Vérifier le mode admin au démarrage (localStorage)
if (localStorage.getItem('adminMode') === 'true') {
  isAdminMode = true;
  updateAdminUI();
}

// ===== CHARGEMENT DES CACHES DEPUIS SUPABASE =====
async function loadCaches() {
  try {
    const { data, error } = await supabase
      .from('caches')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur chargement:', error);
      return;
    }

    const previousCount = caches.length;
    caches = data || [];
    
    // Afficher tous les marqueurs
    caches.forEach(pt => {
      const marker = L.marker([pt.lat, pt.lng]).addTo(map);
      attachDeleteHandler(marker, pt.lat, pt.lng, pt.id);

      // Popup amélioré
      let popup = `<div class="cache-popup">`;
      popup += `<div class="cache-popup-header">📍 Cache repérée</div>`;
      
      if (pt.type) {
        popup += `<div class="cache-popup-info">`;
        popup += `<div class="cache-popup-label">Type de cache</div>`;
        popup += `<div class="cache-popup-value">${pt.type}</div>`;
        popup += `</div>`;
      }
      
      if (pt.adresse) {
        popup += `<div class="cache-popup-info">`;
        popup += `<div class="cache-popup-label">📍 Localisation</div>`;
        popup += `<div class="cache-popup-value">${pt.adresse}</div>`;
        popup += `</div>`;
      }
      
      popup += `<button class="cache-popup-btn" onclick="openNavigation(${pt.lat}, ${pt.lng})">🧭 Lancer l'itinéraire</button>`;
      popup += `</div>`;
      
      marker.bindPopup(popup);
    });

    // Notification si nouvelle cache détectée
    if (previousCount > 0 && caches.length > previousCount) {
      const newCache = caches[0];
      showNotification(newCache.type || 'Cache', newCache.adresse || 'Nouvelle cache ajoutée');
    }

  } catch (err) {
    console.error('Erreur:', err);
  }
}

// Charger les caches au démarrage
loadCaches();

// Vérifier les nouvelles caches toutes les 30 secondes
setInterval(() => {
  loadCaches();
}, 30000);

// ===== SYSTÈME DE NOTIFICATIONS =====
function showNotification(title, message) {
  const notification = document.getElementById('notification');
  const notificationMessage = document.getElementById('notificationMessage');
  
  notificationMessage.textContent = message;
  notification.classList.remove('hidden');
  
  // Masquer automatiquement après 5 secondes
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 5000);
}

function closeNotification() {
  document.getElementById('notification').classList.add('hidden');
}

// ===== GESTION MODE ADMINISTRATEUR =====
function toggleAdminMode() {
  if (isAdminMode) {
    // Déconnexion admin
    isAdminMode = false;
    localStorage.removeItem('adminMode');
    updateAdminUI();
    alert('✅ Mode utilisateur activé');
  } else {
    // Demander le mot de passe
    document.getElementById('adminPopup').classList.remove('hidden');
  }
}

function validateAdminPassword() {
  const password = document.getElementById('adminPassword').value;
  
  if (password === ADMIN_PASSWORD) {
    isAdminMode = true;
    localStorage.setItem('adminMode', 'true');
    updateAdminUI();
    closeAdminPopup();
    alert('✅ Mode administrateur activé');
  } else {
    alert('❌ Mot de passe incorrect');
    document.getElementById('adminPassword').value = '';
  }
}

function closeAdminPopup() {
  document.getElementById('adminPopup').classList.add('hidden');
  document.getElementById('adminPassword').value = '';
}

function updateAdminUI() {
  const adminBtn = document.getElementById('btnAdminToggle');
  const adminOnlyButtons = document.querySelectorAll('.admin-only');
  
  if (isAdminMode) {
    adminBtn.textContent = '🔒 Mode Admin (ON)';
    adminBtn.classList.add('admin-active');
    adminOnlyButtons.forEach(btn => btn.style.display = 'block');
  } else {
    adminBtn.textContent = '🔓 Mode Admin';
    adminBtn.classList.remove('admin-active');
    adminOnlyButtons.forEach(btn => btn.style.display = 'none');
  }
}

// Fermer popup admin avec Entrée
document.addEventListener('DOMContentLoaded', () => {
  const adminPasswordInput = document.getElementById('adminPassword');
  if (adminPasswordInput) {
    adminPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') validateAdminPassword();
    });
  }
});

/* ---------------------------------------------------
   🔴 MODE SUPPRESSION DE MARQUEUR
--------------------------------------------------- */
let deleteMode = false;

document.getElementById("btnDelete").addEventListener("click", () => {
  if (!isAdminMode) {
    alert("⚠️ Action réservée aux administrateurs");
    return;
  }
  
  deleteMode = !deleteMode;

  if (deleteMode) {
    alert("Mode suppression activé : cliquez sur un marqueur pour le supprimer.");
    document.getElementById("btnDelete").style.opacity = "0.7";
  } else {
    document.getElementById("btnDelete").style.opacity = "1";
  }
});

function attachDeleteHandler(marker, lat, lng, cacheId) {
  marker.on("click", async () => {
    if (deleteMode) {
      map.removeLayer(marker);

      // Supprimer de Supabase
      if (cacheId) {
        const { error } = await supabase
          .from('caches')
          .delete()
          .eq('id', cacheId);
        
        if (error) console.error('Erreur suppression:', error);
      }

      caches = caches.filter(pt => pt.id !== cacheId);
    }
  });
}

/* ---------------------------------------------------
   🔵 REVERSE GEOCODING
--------------------------------------------------- */
async function getAddress(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.display_name || "Adresse inconnue";
  } catch {
    return "Adresse inconnue";
  }
}

/* ---------------------------------------------------
   🔵 CREATION MARQUEUR + POPUP
--------------------------------------------------- */
async function createMarker(lat, lng, meta) {
  // Sauvegarder dans Supabase
  const { data, error } = await supabase
    .from('caches')
    .insert([{
      lat: lat,
      lng: lng,
      type: meta.type || null,
      adresse: meta.adresse || null,
      autoGPS: meta.autoGPS || false,
      manuel: meta.manuel || false,
      recherche: meta.recherche || false
    }])
    .select();

  if (error) {
    console.error('Erreur ajout:', error);
    alert('Erreur lors de l\'ajout du cache');
    return;
  }

  const newCache = data[0];
  const marker = L.marker([lat, lng]).addTo(map);

  attachDeleteHandler(marker, lat, lng, newCache.id);

  // Popup amélioré
  let popupContent = `<div class="cache-popup">`;
  popupContent += `<div class="cache-popup-header">📍 Cache repérée</div>`;
  
  if (meta.type) {
    popupContent += `<div class="cache-popup-info">`;
    popupContent += `<div class="cache-popup-label">Type de cache</div>`;
    popupContent += `<div class="cache-popup-value">${meta.type}</div>`;
    popupContent += `</div>`;
  }
  
  if (meta.adresse) {
    popupContent += `<div class="cache-popup-info">`;
    popupContent += `<div class="cache-popup-label">📍 Localisation</div>`;
    popupContent += `<div class="cache-popup-value">${meta.adresse}</div>`;
    popupContent += `</div>`;
  }
  
  popupContent += `<button class="cache-popup-btn" onclick="openNavigation(${lat}, ${lng})">🧭 Lancer l'itinéraire</button>`;
  popupContent += `</div>`;

  marker.bindPopup(popupContent);

  caches.push(newCache);
}

/* ---------------------------------------------------
   🔵 VALIDATION POPUP TYPE
--------------------------------------------------- */
document.getElementById("validateType").addEventListener("click", async () => {

  const type = document.getElementById("cacheType").value;
  const lat = pendingLat;
  const lng = pendingLng;

  const address = await getAddress(lat, lng);

  const meta = {
    lat,
    lng,
    type,
    adresse: address,
    date: new Date().toISOString()
  };

  if (pendingSource === "gps") meta.autoGPS = true;
  if (pendingSource === "manuel") meta.manuel = true;
  if (pendingSource === "recherche") meta.recherche = true;

  createMarker(lat, lng, meta);

  document.getElementById("typePopup").classList.add("hidden");
});

document.getElementById("cancelType").addEventListener("click", () => {
  document.getElementById("typePopup").classList.add("hidden");
});

/* ---------------------------------------------------
   🔵 AJOUT MANUEL (CLIC SUR CARTE)
--------------------------------------------------- */
map.on('click', (e) => {
  if (deleteMode) return;

  pendingLat = e.latlng.lat;
  pendingLng = e.latlng.lng;
  pendingSource = "manuel";

  document.getElementById("typePopup").classList.remove("hidden");
});

/* ---------------------------------------------------
   🔵 GPS AUTOMATIQUE AU CHARGEMENT
--------------------------------------------------- */
if ("geolocation" in navigator) {
  navigator.geolocation.getCurrentPosition(async pos => {

    pendingLat = pos.coords.latitude;
    pendingLng = pos.coords.longitude;
    pendingSource = "gps";

    map.setView([pendingLat, pendingLng], 17);

    document.getElementById("typePopup").classList.remove("hidden");

  }, () => console.warn("GPS refusé ou indisponible"));
}

/* ---------------------------------------------------
   🔵 BOUTON GPS MANUEL
--------------------------------------------------- */
document.getElementById("btnGPS").addEventListener("click", () => {
  navigator.geolocation.getCurrentPosition(pos => {

    pendingLat = pos.coords.latitude;
    pendingLng = pos.coords.longitude;
    pendingSource = "gps";

    map.setView([pendingLat, pendingLng], 17);

    document.getElementById("typePopup").classList.remove("hidden");

  }, () => alert("Impossible de récupérer la localisation"));
});

/* ---------------------------------------------------
   🔵 RECHERCHE D’ADRESSE
--------------------------------------------------- */
async function searchAddress() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) return;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    const results = await response.json();

    if (results.length === 0) {
      alert("Adresse introuvable.");
      return;
    }

    const { lat, lon } = results[0];

    map.setView([lat, lon], 17);

    // Ouvrir le popup pour choisir le type
    pendingLat = parseFloat(lat);
    pendingLng = parseFloat(lon);
    pendingSource = "recherche";
    document.getElementById("typePopup").classList.remove("hidden");

  } catch {
    alert("Erreur lors de la recherche");
  }
}

document.getElementById("searchBtn").addEventListener("click", searchAddress);
document.getElementById("searchInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchAddress();
});

/* ---------------------------------------------------
   🔵 AUTOCOMPLÉTION ADRESSE (Nominatim)
--------------------------------------------------- */

const autocompleteList = document.getElementById("autocompleteList");

document.getElementById("searchInput").addEventListener("input", async () => {
  const query = document.getElementById("searchInput").value.trim();

  if (query.length < 3) {
    autocompleteList.classList.add("hidden");
    return;
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;

  try {
    const res = await fetch(url);
    const results = await res.json();

    autocompleteList.innerHTML = "";
    autocompleteList.classList.remove("hidden");

    results.forEach(item => {
      const li = document.createElement("li");
      li.textContent = item.display_name;

      li.addEventListener("click", () => {
        document.getElementById("searchInput").value = item.display_name;
        autocompleteList.classList.add("hidden");

        map.setView([item.lat, item.lon], 17);

        // Ouvrir le popup pour choisir le type
        pendingLat = parseFloat(item.lat);
        pendingLng = parseFloat(item.lon);
        pendingSource = "recherche";
        document.getElementById("typePopup").classList.remove("hidden");
      });

      autocompleteList.appendChild(li);
    });

  } catch (err) {
    autocompleteList.classList.add("hidden");
  }
});

/* Masquer si clic ailleurs */
document.addEventListener("click", (e) => {
  if (!e.target.closest("#topSearch")) {
    autocompleteList.classList.add("hidden");
  }
});

/* ---------------------------------------------------
   🔵 EXPORT JSON
--------------------------------------------------- */
document.getElementById("btnExport").addEventListener("click", async () => {
  if (!isAdminMode) {
    alert("⚠️ Action réservée aux administrateurs");
    return;
  }
  
  // Recharger les données depuis Supabase pour être sûr d'avoir tout
  const { data, error } = await supabase
    .from('caches')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    alert('❌ Erreur lors de l\'export');
    return;
  }

  const exportData = data || caches;
  const jsonData = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonData], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `caches_vas_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  
  alert('✅ Export réussi !');
});

/* ---------------------------------------------------
   🔵 RESET
--------------------------------------------------- */
document.getElementById("btnClear").addEventListener("click", async () => {
  if (!isAdminMode) {
    alert("⚠️ Action réservée aux administrateurs");
    return;
  }
  
  if (confirm("⚠️ ATTENTION : Effacer tous les points de la base de données partagée ?\n\nCette action est irréversible !")) {
    // Supprimer tous les caches de Supabase
    const { error } = await supabase
      .from('caches')
      .delete()
      .neq('id', 0); // Supprime tout (condition toujours vraie)

    if (error) {
      console.error('Erreur reset:', error);
      alert('❌ Erreur lors de la suppression');
    } else {
      caches = [];
      alert('✅ Base de données réinitialisée');
      location.reload();
    }
  }
});

/* ---------------------------------------------------
   🔵 NAVIGATION GPS
--------------------------------------------------- */
function openNavigation(lat, lng) {
  // Détection du système d'exploitation
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  let url;
  
  if (isIOS) {
    // Apple Plans sur iOS
    url = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  } else if (isAndroid) {
    // Google Maps sur Android
    url = `google.navigation:q=${lat},${lng}`;
  } else {
    // Google Maps web pour desktop
    url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }

  window.open(url, '_blank');
}