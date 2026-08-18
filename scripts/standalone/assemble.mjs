import fs from 'node:fs';

/**
 * Assemble le fichier unique.
 *
 * Entrées : le HTML rendu par le serveur (extrait.json), la feuille de style
 * qu'il sert, tous les fichiers en data URI, et le script d'interaction.
 * Sortie : un seul .html qui s'ouvre par double-clic, sans serveur.
 */

const OUT = process.env.V3D_BUILD_DIR || '.standalone-build';
const DEST = process.env.V3D_DEST || 'standalone/volume3d.html';
const X = JSON.parse(fs.readFileSync(`${OUT}/extrait.json`, 'utf8'));
const HERE = new URL('.', import.meta.url).pathname;
const APP = fs.readFileSync(`${HERE}app.js`, 'utf8');
const db = JSON.parse(fs.readFileSync('.data/db.json', 'utf8'));

const PROP = db.properties.find((p) => p.status === 'published');
const PLAN = db.plans[0];
const DOORS = db.planDoors;
const PHOTOS = db.photos.filter((p) => p.propertyId === PROP.id);

/* ------------------------------------------------- réécriture du HTML --- */

/** Remplace chaque adresse de fichier par son contenu embarqué. */
function inlineAssets(html) {
  let out = html;
  for (const [path, uri] of Object.entries(X.assets)) {
    out = out.split(`"${path}"`).join(`"${uri}"`);
    out = out.split(`'${path}'`).join(`'${uri}'`);
    out = out.split(`(${path})`).join(`(${uri})`);
  }
  return out;
}

/**
 * Les liens du site pointent vers des routes serveur. Ici il n'y a pas de
 * serveur : on les redirige vers l'écran correspondant.
 */
function rewriteLinks(html) {
  return html
    // liens internes vers un écran
    .replace(/href="\/"/g, 'href="#" data-goto="accueil"')
    .replace(/href="\/v\/[^"]*"/g, 'href="#" data-goto="visite"')
    .replace(/href="\/espace\/biens\/[^"]*"/g, 'href="#" data-goto="espace"')
    .replace(/href="\/espace\/biens"/g, 'href="#" data-goto="tableau"')
    .replace(/href="\/espace\/connexion"/g, 'href="#" data-goto="tableau"')
    .replace(/href="\/espace\/creation"/g, 'href="#" data-goto="tableau"')
    .replace(/href="\/espace\/compte"/g, 'href="#" data-goto="tableau"')
    .replace(/href="\/espace"/g, 'href="#" data-goto="tableau"')
    .replace(/href="\/admin[^"]*"/g, 'href="#" data-goto="tableau"')
    // le reste des routes serveur : neutralisées
    .replace(/action="[^"]*"/g, 'data-inert-form="1"')
    .replace(/<next-route-announcer[^>]*><\/next-route-announcer>/g, '');
}

/**
 * L'adresse du serveur de développement traverse le HTML (lien de la visite,
 * code d'intégration). Dans une démonstration elle n'a rien à faire là.
 */
function presentableUrls(html) {
  return html.replace(/https?:\/\/localhost:\d+/g, 'https://volume3d.fr');
}

/**
 * Un message du site ne vaut plus dans ce fichier : le tableau de bord annonce
 * que l'assistant est désactivé, faute de clé d'API — alors qu'ici il répond,
 * hors ligne, à partir de la fiche. On rétablit la vérité de ce fichier.
 */
function fixOfflineWording(html) {
  return html.replace(
    /L’assistant n’est pas activé sur cette installation[^<]*/g,
    'Dans cette démonstration hors ligne, l’assistant répond à partir de la fiche du logement. ' +
    'En ligne, il tourne sur l’API Claude et demande une clé.',
  );
}

function clean(html) {
  return fixOfflineWording(presentableUrls(rewriteLinks(inlineAssets(html))));
}

// La feuille de style cite elle aussi des fichiers — les polices notamment.
const CSS = inlineAssets(X.css);

const screens = {
  accueil: clean(X.screens.accueil),
  visite: clean(X.screens.visite),
  tableau: clean(X.screens.tableau),
  espace: clean(X.screens.espace),
};

/* ------------------------------------------------------------ données --- */

const facing = (imageYaw) => (imageYaw + 90) % 360;

const DEMO_ROOMS = [
  { id: 'salon', name: 'Salon', url: '/demo/salon.jpg', yaw: facing(219), pitch: -6,
    hotspots: [{ to: 'chambre', label: 'Chambre', yaw: facing(144), pitch: -4 }] },
  { id: 'chambre', name: 'Chambre', url: '/demo/chambre.jpg', yaw: facing(294), pitch: -6,
    hotspots: [
      { to: 'salon', label: 'Salon', yaw: facing(45), pitch: -4 },
      { to: 'salle-de-bain', label: 'Salle de bain', yaw: facing(352), pitch: -4 },
    ] },
  { id: 'salle-de-bain', name: 'Salle de bain', url: '/demo/salle-de-bain.jpg', yaw: facing(186), pitch: -16,
    hotspots: [{ to: 'chambre', label: 'Chambre', yaw: facing(300), pitch: -4 }] },
];

const TOUR_ROOMS = db.scenes
  .filter((s) => s.propertyId === PROP.id)
  .sort((a, b) => a.position - b.position)
  .map((s) => ({
    id: s.id,
    name: s.name,
    url: s.imageUrl,
    yaw: s.initialYaw ?? 0,
    pitch: s.initialPitch ?? 0,
    hotspots: db.hotspots
      .filter((h) => h.sceneId === s.id)
      .map((h) => ({ to: h.targetSceneId, label: h.label, yaw: h.yaw, pitch: h.pitch })),
  }));

const DATA = {
  demoRooms: DEMO_ROOMS,
  tourRooms: TOUR_ROOMS,
  plan: PLAN,
  doors: DOORS,
  photos: PHOTOS,
  property: { name: PROP.name, city: PROP.city, description: PROP.description },
};

/* ------------------------------------------------ styles complémentaires */

const EXTRA_CSS = `
/* --------------------------------------------------------- version fichier
   Ce qui n'existe que dans cette version : le sélecteur d'écran, les points
   de passage recalculés en JavaScript, et le bandeau d'avertissement.
   -------------------------------------------------------------------- */

body { padding-bottom: 84px; }

/* Une classe qui pose display:flex bat la règle [hidden] de la feuille par
   défaut du navigateur : sans ceci, un panneau « caché » reste affiché et
   intercepte les clics. */
.v3d-screen[hidden],
.v3d-pane[hidden],
.v3d-chat[hidden],
.v3d-chat-open[hidden] { display: none !important; }

.v3d-switch {
  position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
  z-index: 9000; display: flex; gap: 4px; padding: 5px;
  background: rgba(21, 31, 29, 0.94); border-radius: 100px;
  box-shadow: 0 8px 30px -8px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px); max-width: calc(100vw - 24px); overflow-x: auto;
}
.v3d-switch button {
  border: 0; background: transparent; color: var(--ink-on-dark-soft, #a9b6b3); cursor: pointer;
  font: 500 13px/1 var(--sans, system-ui); padding: 9px 15px; border-radius: 100px;
  white-space: nowrap; transition: background-color .15s ease, color .15s ease;
}
.v3d-switch button:hover { color: #fff; }
.v3d-switch button.on { background: #fff; color: var(--ink-strong, #14120f); }

.v3d-note {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9001;
  background: var(--accent, #0e6e66); color: #fff; font: 500 12.5px/1.45 var(--sans, system-ui);
  padding: 7px 16px; display: flex; gap: 12px; align-items: center; justify-content: center;
  text-align: center;
}
.v3d-note button {
  border: 1px solid rgba(255,255,255,.55); background: transparent; color: #fff;
  border-radius: 100px; font-size: 11px; padding: 2px 10px; cursor: pointer; flex: none;
}
body.v3d-noted { padding-top: 32px; }

/* Points de passage : mêmes proportions que sur le site, positionnés par le JS. */
.v3d-hotspot {
  position: absolute; transform: translate(-50%, -50%); z-index: 5;
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  background: transparent; border: 0; padding: 0; color: #fff;
  font: 500 13px/1 var(--sans, system-ui);
  text-shadow: 0 1px 6px rgba(0, 0, 0, .6);
}
.v3d-ring {
  width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center;
  background: rgba(255, 255, 255, .18); border: 1.5px solid rgba(255, 255, 255, .85);
  backdrop-filter: blur(3px); font-size: 15px;
  transition: transform .18s ease, background-color .18s ease;
}
.v3d-hotspot:hover .v3d-ring { transform: scale(1.12); background: rgba(255, 255, 255, .34); }
.v3d-label {
  background: rgba(21, 31, 29, .62); padding: 5px 11px; border-radius: 100px;
  backdrop-filter: blur(3px); white-space: nowrap;
}

[class*="PanoViewer_root"] { cursor: grab; }
[class*="PanoViewer_root"].v3d-drag { cursor: grabbing; }
[class*="PanoViewer_root"] canvas { width: 100%; height: 100%; display: block; }

.v3d-nogl { display: grid; place-items: center; color: var(--ink-faint, #726b60); font-size: 14px; }

/* La marche dans le volume. */
.v3d-plan { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--bg-sunk, #f0eee8); }
.v3d-plan-canvas { width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }
.v3d-plan-bar {
  position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 4;
  display: flex; gap: 7px; flex-wrap: wrap;
}
.v3d-plan-chip {
  border: 0; border-radius: 100px; padding: 7px 14px; cursor: pointer;
  font: 500 13px/1 var(--sans, system-ui);
  background: rgba(21, 31, 29, .62); color: #fff; backdrop-filter: blur(6px);
}
.v3d-plan-chip.on { background: #fff; color: var(--ink-strong, #14120f); }
.v3d-plan-name {
  position: absolute; top: 14px; left: 16px; z-index: 4; color: #fff;
  font: 600 15px/1 var(--sans, system-ui); text-shadow: 0 1px 8px rgba(0,0,0,.5);
}
.v3d-plan-hint {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 4;
  background: rgba(21, 31, 29, .55); color: #fff; padding: 9px 16px; border-radius: 100px;
  font: 500 13px/1 var(--sans, system-ui); pointer-events: none;
  transition: opacity .4s ease; backdrop-filter: blur(4px);
}

/* Onglets de format sur la page de visite. */
[class*="TourStage_tab"] { cursor: pointer; }

/* L'assistant. */
.v3d-chat-open {
  position: fixed; right: 18px; bottom: 84px; z-index: 8000;
  border: 0; border-radius: 100px; padding: 13px 20px; cursor: pointer;
  background: var(--ink-strong, #14120f); color: #fff; font: 500 14px/1 var(--sans, system-ui);
  box-shadow: 0 10px 34px -10px rgba(0,0,0,.5); display: flex; gap: 9px; align-items: center;
}
.v3d-chat {
  position: fixed; right: 18px; bottom: 84px; z-index: 8001; width: min(370px, calc(100vw - 32px));
  background: #fff; border: 1px solid var(--line, #e4e1d9); border-radius: 12px; overflow: hidden;
  box-shadow: 0 22px 60px -18px rgba(21, 31, 29,.42); display: flex; flex-direction: column;
  max-height: min(560px, calc(100vh - 130px));
}
.v3d-chat-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 13px 15px; border-bottom: 1px solid var(--line, #e4e1d9); background: var(--bg-alt, #f8f7f4);
}
.v3d-chat-head strong { font-size: 14.5px; color: var(--ink-strong, #14120f); }
.v3d-chat-head button { border: 0; background: transparent; font-size: 18px; cursor: pointer; color: var(--ink-muted, #544e46); line-height: 1; }
.v3d-chat-log { padding: 14px 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 11px; flex: 1; }
.v3d-msg { font-size: 14.5px; line-height: 1.55; max-width: 86%; padding: 9px 13px; border-radius: 12px; }
.v3d-msg-bot { background: var(--bg-sunk, #f0eee8); color: var(--ink, #272320); align-self: flex-start; border-bottom-left-radius: 3px; }
.v3d-msg-me { background: var(--accent, #0e6e66); color: #fff; align-self: flex-end; border-bottom-right-radius: 3px; }
.v3d-chat-sugg { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 15px 12px; }
.v3d-chat-sugg button {
  border: 1px solid var(--line-strong, #948d7f); background: #fff; border-radius: 100px; padding: 6px 12px;
  font: 400 12.5px/1 var(--sans, system-ui); cursor: pointer; color: var(--ink, #272320);
}
.v3d-chat-sugg button:hover { border-color: var(--accent, #0e6e66); color: var(--accent, #0e6e66); }
.v3d-chat-form { display: flex; gap: 8px; padding: 12px 15px; border-top: 1px solid var(--line, #e4e1d9); }
.v3d-chat-form input {
  flex: 1; min-width: 0; border: 1px solid var(--line-strong, #948d7f); border-radius: 8px; padding: 10px 12px;
  font: 400 14.5px/1.2 var(--sans, system-ui);
}
.v3d-chat-form button {
  border: 0; background: var(--ink-strong, #14120f); color: #fff; border-radius: 8px; padding: 0 16px;
  font: 500 14px/1 var(--sans, system-ui); cursor: pointer;
}
@media (max-width: 620px) {
  .v3d-chat, .v3d-chat-open { right: 12px; left: 12px; }
  .v3d-chat-open { justify-content: center; }
}
`;

/* ---------------------------------------------------------- assemblage --- */

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Volume3D — visites virtuelles pour propriétaires</title>
<meta name="description" content="On scanne votre logement en vingt minutes. Vos voyageurs le visitent avant de réserver." />
<style>
${CSS}
${EXTRA_CSS}
</style>
</head>
<body>

<div class="v3d-note" id="v3d-note">
  <span>Version de démonstration en un seul fichier — tout fonctionne hors ligne, rien n’est enregistré.</span>
  <button type="button" onclick="document.getElementById('v3d-note').remove();document.body.classList.remove('v3d-noted')">Fermer</button>
</div>

<div class="v3d-screen" id="ec-accueil">${screens.accueil}</div>
<div class="v3d-screen" id="ec-visite" hidden>${screens.visite}</div>
<div class="v3d-screen" id="ec-tableau" hidden>${screens.tableau}</div>
<div class="v3d-screen" id="ec-espace" hidden>${screens.espace}</div>

<nav class="v3d-switch" aria-label="Écrans de la démonstration">
  <button type="button" data-screen="accueil" class="on">Accueil</button>
  <button type="button" data-screen="visite">La visite</button>
  <button type="button" data-screen="tableau">Tableau de bord</button>
  <button type="button" data-screen="espace">Fiche d’un bien</button>
</nav>

<script>
window.V3D_ASSETS = ${JSON.stringify(X.assets)};
window.V3D_DATA = ${JSON.stringify(DATA)};
document.body.classList.add('v3d-noted');
</script>
<script>
${APP}
</script>
<script>
${fs.readFileSync(`${HERE}wire.js`, 'utf8')}
</script>
</body>
</html>
`;

fs.writeFileSync(DEST, html);
console.log(DEST, Math.round(html.length / 1024), 'Ko');
