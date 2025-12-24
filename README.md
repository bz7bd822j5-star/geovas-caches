# GeoVAS

PWA locale-first avec synchronisation via Google Apps Script + Google Sheet.

## Google Sheet
1. Creez une Google Sheet.
2. Ajoutez un onglet nomme `caches`.
3. Ajoutez les en-tetes en ligne 1 :
   `id | lat | lng | type | adresse | note | created_at | updated_at | source`

## Apps Script
1. Dans la Sheet: Extensions > Apps Script.
2. Collez le contenu de `apps-script/Code.gs`.
3. Verifiez que le token est identique dans `apps-script/Code.gs` et `js/api.js`.
4. Deployer en tant que Web App:
   - Executer en tant que: Moi
   - Acces: Anyone
5. Copiez l'URL de deploiement dans `js/api.js` (API_URL).

## GitHub Pages
1. Poussez le dossier `geovas/` sur un repo GitHub.
2. Activez GitHub Pages (branche principale / dossier racine).
3. L'application est accessible via l'URL fournie par Pages.

## Icons
Les icons fournies sont des placeholders 1x1. Remplacez par des PNG 192x192 et 512x512.

## Tests manuels
- Carte chargee (Leaflet + OpenStreetMap).
- Clic sur la carte = creation cache + marqueur + liste.
- Bouton Actualiser = sync pull.
- Sync auto toutes les 10s.
- Export telecharge `geovas_caches_export.json`.
- Reset vide les caches locaux.
- GPS recentre la carte.
- Offline: app et caches locaux restent accessibles.
- Offline: les tuiles OSM restent visibles pour les zones deja chargees.
- Reconnexion: les caches ajoutes hors-ligne se synchronisent automatiquement.

## Notes de mise a jour
Voir `notes.md` pour le detail des modifications recentes.
