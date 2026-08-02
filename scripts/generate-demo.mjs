/**
 * Prépare les panoramas de la démonstration publique.
 *
 * La démonstration ne doit dépendre ni de la base de données ni du logement
 * d'un client : ce sont des fichiers fixes, versionnés avec le code, identiques
 * sur toutes les installations.
 *
 * Ce sont de vraies photographies 360°, pas des images de synthèse. Une première
 * version dessinait les pièces au canevas ; le rendu restait une illustration, et
 * une illustration ne démontre pas un service qui vend du réalisme. Les sources
 * viennent de Poly Haven, en CC0 (domaine public, usage commercial autorisé,
 * attribution non requise — elle est faite dans le README par correction).
 *
 * À remplacer par les panoramas d'un vrai logement dès qu'un premier scan est
 * livré : il suffit de déposer trois fichiers et d'ajuster `lib/demo.ts`.
 *
 * Utilisation :
 *   node scripts/generate-demo.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = fileURLToPath(new URL('../public/demo/', import.meta.url));

/**
 * Les trois pièces de la visite de démonstration.
 *
 * `id` sert de nom de fichier et de clé dans `lib/demo.ts`, `source` est
 * l'identifiant Poly Haven.
 */
const ROOMS = [
  { id: 'salon', source: 'lythwood_lounge' },
  { id: 'chambre', source: 'hotel_room' },
  { id: 'salle-de-bain', source: 'modern_bathroom' },
];

/**
 * 4096 × 2048 : c'est l'ordre de grandeur de ce que sort une caméra 360 grand
 * public, et le point où l'on cesse de voir la différence dans un viewer à 75°
 * de champ. Au-delà, on ne paie plus que du temps de chargement.
 */
const WIDTH = 4096;

const fetchJson = (url) => JSON.parse(execFileSync('curl', ['-sS', '--max-time', '60', url], { encoding: 'utf8' }));

await mkdir(OUT, { recursive: true });

for (const room of ROOMS) {
  const files = fetchJson(`https://api.polyhaven.com/files/${room.source}`);
  // Poly Haven publie une version déjà tonemappée en JPEG : inutile de traiter
  // du HDR pour un fond de sphère affiché en sRGB.
  const url = files.tonemapped.url;
  const original = execFileSync('curl', ['-sS', '--max-time', '600', url], {
    encoding: 'buffer',
    maxBuffer: 256 * 1024 * 1024,
  });

  const prepared = await sharp(original)
    .resize(WIDTH, WIDTH / 2, { fit: 'fill' })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toBuffer();

  await writeFile(new URL(`${room.id}.jpg`, new URL('file://' + OUT)), prepared);
  console.log(`${room.id}.jpg — ${Math.round(prepared.length / 1024)} ko (source : ${room.source})`);
}
