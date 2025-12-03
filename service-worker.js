self.addEventListener("install", (event) => {
  console.log("Service Worker installé ✔");
});

self.addEventListener("fetch", (event) => {
  // Pour l'instant pas de mise en cache, mais indispensable pour activer la PWA
});