import { formatArea } from './floorplan-svg.ts';
import { orderedRooms, roomArea, totalArea } from './plan.ts';
import type { FloorPlan, Property, PropertyFact } from './types';

/**
 * L'annonce, écrite à partir du dossier.
 *
 * Le propriétaire a envoyé son plan et rempli sa fiche. Il a donc déjà, sans
 * le savoir, tout ce qu'il faut pour rédiger son annonce — la surface mesurée,
 * le nom des pièces, les équipements, le quartier. Ce module assemble ces
 * éléments en un texte qu'il peut coller sur Airbnb, Booking ou son propre
 * site.
 *
 * Deux principes, les mêmes que partout ailleurs dans ce projet :
 *
 * 1. **Rien n'est inventé.** Chaque phrase vient d'une réponse confirmée par le
 *    propriétaire ou d'une mesure prise sur le plan. Une annonce qui promet un
 *    balcon absent se paie en commentaires à une étoile.
 * 2. **Aucun modèle n'est appelé.** Le texte est assemblé par des règles. Il
 *    fonctionne donc sans clé d'API, hors ligne, et il donne deux fois le même
 *    résultat pour le même dossier — ce qu'un propriétaire attend d'un outil.
 *
 * Le résultat n'est pas de la grande littérature, et il ne prétend pas l'être :
 * c'est un premier jet exact que le propriétaire retouche à sa voix.
 */

/** Airbnb coupe le titre d'une annonce à 50 caractères. */
export const TITLE_LIMIT = 50;

export interface ListingDraft {
  /** Titre de l'annonce, dans la limite d'Airbnb. */
  title: string;
  /** Une phrase, pour un aperçu ou une méta-description. */
  summary: string;
  /** Le texte de l'annonce, en paragraphes séparés par une ligne vide. */
  description: string;
  /** Points forts, à puces. */
  highlights: string[];
  /** Message à envoyer au voyageur avec le lien de la visite. */
  travellerMessage: string;
  /** Ce qui manque pour faire mieux, nommé précisément. */
  missing: string[];
}

/** Réponse confirmée par le propriétaire, ou rien. */
function owned(facts: PropertyFact[], key: string): string {
  const fact = facts.find((entry) => entry.key === key && entry.source === 'proprietaire');
  return fact?.value.trim() ?? '';
}

/** Les valeurs d'une question à choix multiple. */
function ownedList(facts: PropertyFact[], key: string): string[] {
  const value = owned(facts, key);
  return value ? value.split(',').map((part) => part.trim()).filter(Boolean) : [];
}

const BEDROOM = /chambre/i;
const SERVICE = /(salle|wc|toilette|dégagement|degagement|couloir|entrée|entree|placard|rangement|cellier|buanderie|local|technique)/i;
/** Ce qu'on ne cite pas dans une annonce : personne ne réserve pour un couloir. */
const CIRCULATION = /(dégagement|degagement|couloir|entrée|entree|placard|rangement|gaine|local|technique)/i;

/**
 * Typologie française : T1, T2, T3…
 *
 * La règle d'usage compte les pièces principales — le séjour et les chambres —
 * et laisse de côté cuisine, salle d'eau et dégagements. Un studio de 25 m²
 * avec une chambre séparée est un T2, pas un T1.
 */
export function typology(plan: FloorPlan | null): string {
  if (!plan || plan.rooms.length === 0) return '';
  const bedrooms = plan.rooms.filter((room) => BEDROOM.test(room.name)).length;
  const living = plan.rooms.filter((room) => !BEDROOM.test(room.name) && !SERVICE.test(room.name)).length;
  const main = bedrooms + Math.min(1, living);
  if (main <= 0) return '';
  return `T${main}`;
}

/** Nombre de chambres relevées sur le plan. */
export function bedroomCount(plan: FloorPlan | null): number {
  return plan ? plan.rooms.filter((room) => BEDROOM.test(room.name)).length : 0;
}

/** Ville seule, quand le propriétaire a écrit « Le Marais, Paris 3e ». */
function shortPlace(address: string): string {
  const first = address.split(/[,·—-]/)[0]?.trim() ?? '';
  return first.length > 2 && first.length <= 24 ? first : address.trim();
}

/**
 * « à » suivi d'un nom de lieu, avec la contraction qui s'impose.
 *
 * « à Le Marais » saute aux yeux d'un propriétaire français et disqualifie le
 * texte entier. La règle tient en quatre cas.
 */
export function atPlace(place: string): string {
  const value = place.trim();
  if (!value) return '';
  if (/^les\s/i.test(value)) return `aux ${value.slice(4)}`;
  if (/^le\s/i.test(value)) return `au ${value.slice(3)}`;
  if (/^la\s/i.test(value)) return `à la ${value.slice(3)}`;
  if (/^l['’]/i.test(value)) return `à l’${value.slice(2)}`;
  return `à ${value}`;
}

/** Adjectif tiré de la réponse sur la lumière, quand elle apporte quelque chose. */
function brightness(facts: PropertyFact[]): string {
  const value = owned(facts, 'exposition').toLowerCase();
  if (value.includes('très lumineux')) return 'très lumineux';
  if (value.includes('lumineux')) return 'lumineux';
  return '';
}

/**
 * Compose le titre en restant sous la limite.
 *
 * On empile les mentions par ordre d'intérêt et on s'arrête avant de dépasser :
 * un titre tronqué par la plateforme au milieu d'un mot fait amateur.
 */
export function buildTitle(property: Property, plan: FloorPlan | null, facts: PropertyFact[]): string {
  const type = typology(plan);
  const area = plan ? Math.round(totalArea(plan.rooms)) : 0;
  const place = shortPlace(owned(facts, 'adresse') || property.city);
  const light = brightness(facts);

  const head = [type, light, area ? `${area} m²` : ''].filter(Boolean).join(' ');
  const candidates = [
    head && place ? `${head} — ${place}` : '',
    head || place,
    property.name,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.length <= TITLE_LIMIT) return candidate;
  }
  // Dernier recours : on coupe sur un mot entier plutôt qu'en plein milieu.
  const fallback = candidates[0] ?? property.name;
  const cut = fallback.slice(0, TITLE_LIMIT);
  const space = cut.lastIndexOf(' ');
  return (space > 20 ? cut.slice(0, space) : cut).trim();
}

/** Énumération française : « a, b et c ». */
function enumerate(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

const endWithStop = (text: string): string => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

/**
 * Rédige l'annonce.
 *
 * `tourUrl` n'apparaît que dans le message au voyageur, jamais dans le corps de
 * l'annonce : Airbnb filtre les liens externes des descriptions, et un lien
 * repéré peut coûter le signalement du compte.
 */
export function buildListing(
  property: Property,
  plan: FloorPlan | null,
  facts: PropertyFact[],
  tourUrl = '',
): ListingDraft {
  const rooms = plan ? orderedRooms(plan) : [];
  const area = plan ? totalArea(plan.rooms) : 0;
  const type = typology(plan);
  const bedrooms = bedroomCount(plan);

  const meuble = owned(facts, 'meuble');
  const couchages = owned(facts, 'couchages');
  const salleEau = owned(facts, 'salle-eau');
  const equipements = ownedList(facts, 'equipements');
  const adresse = owned(facts, 'adresse');
  const etage = owned(facts, 'etage');
  const proximite = owned(facts, 'proximite');
  const publics = ownedList(facts, 'public');
  const particularites = owned(facts, 'particularites');
  const light = brightness(facts);

  /* ------------------------------------------------------ le paragraphe 1 */

  const opening: string[] = [];
  const identity = [type, light].filter(Boolean).join(' ');
  if (identity && area) opening.push(`${identity} de ${formatArea(area)}`);
  else if (area) opening.push(`Logement de ${formatArea(area)}`);
  else if (identity) opening.push(identity.charAt(0).toUpperCase() + identity.slice(1));

  if (adresse) opening.push(atPlace(adresse));
  else if (property.city) opening.push(atPlace(property.city));
  if (etage) opening.push(etage.toLowerCase().startsWith('rez') ? etage.toLowerCase() : `${etage.toLowerCase()}`);

  let first = opening.join(', ');
  if (first) first = endWithStop(first.charAt(0).toUpperCase() + first.slice(1));

  /* ------------------------------------------------------ le paragraphe 2 */

  const layout: string[] = [];
  const shown = rooms.filter((room) => !CIRCULATION.test(room.name));
  if (shown.length > 0) {
    const named = shown.map((room) => `${room.name.toLowerCase()} (${formatArea(roomArea(room))})`);
    layout.push(`Le logement se compose de ${enumerate(named)}.`);
  }
  if (couchages) {
    const number = couchages.match(/\d+/)?.[0];
    layout.push(number ? `${number} personnes peuvent y dormir.` : endWithStop(couchages));
  }
  if (bedrooms > 0 && !couchages) {
    layout.push(bedrooms === 1 ? 'Une chambre séparée.' : `${bedrooms} chambres séparées.`);
  }
  if (meuble) layout.push(endWithStop(meuble));
  if (salleEau) {
    const map: Record<string, string> = {
      Douche: 'La salle d’eau est équipée d’une douche.',
      Baignoire: 'La salle de bain est équipée d’une baignoire.',
      'Les deux': 'La salle de bain dispose d’une douche et d’une baignoire.',
    };
    layout.push(map[salleEau] ?? endWithStop(salleEau));
  }

  /* ------------------------------------------------------ le paragraphe 3 */

  const comfort: string[] = [];
  if (equipements.length > 0) {
    // Les options du catalogue sont déjà bien orthographiées — « Wi-Fi »,
    // « Lave-vaisselle » — et le passage en minuscules les abîmait.
    comfort.push(`Équipements : ${enumerate(equipements)}.`);
  }
  // On ne touche pas à la casse du texte libre : « Métro Saint-Paul » et
  // « Place des Vosges » sont des noms propres, les abaisser fait négligé.
  if (proximite) comfort.push(`À moins de dix minutes à pied : ${proximite.replace(/\.$/, '')}.`);
  if (publics.length > 0) {
    comfort.push(`Le logement convient particulièrement aux ${enumerate(publics.map((p) => p.toLowerCase()))}.`);
  }
  if (particularites) comfort.push(endWithStop(particularites));

  const paragraphs = [first, layout.join(' '), comfort.join(' ')].filter((p) => p.trim().length > 0);
  const description = paragraphs.join('\n\n');

  /* ------------------------------------------------------------ le reste */

  const highlights: string[] = [];
  if (area) highlights.push(`${formatArea(area)} mesurés sur plan`);
  if (bedrooms > 0) highlights.push(bedrooms === 1 ? '1 chambre séparée' : `${bedrooms} chambres séparées`);
  if (couchages) highlights.push(`${couchages.match(/\d+/)?.[0] ?? couchages} couchages`);
  if (light) highlights.push(light.charAt(0).toUpperCase() + light.slice(1));
  for (const item of equipements) highlights.push(item);
  if (etage) highlights.push(etage);

  // « Ascenseur » figure souvent à la fois dans les équipements et dans la
  // réponse sur l'étage : une liste à puces qui se répète se lit mal.
  const seen = new Set<string>();
  const uniqueHighlights = highlights.filter((item) => {
    const key = item.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüç0-9]/g, '');
    if ([...seen].some((k) => k.includes(key) || key.includes(k))) return false;
    seen.add(key);
    return true;
  });

  const summary = first || `${property.name}${property.city ? ` — ${property.city}` : ''}.`;

  const message = [
    'Bonjour,',
    '',
    `Voici la visite virtuelle du logement : vous pouvez le parcourir pièce par pièce avant de réserver${
      tourUrl ? `.\n\n${tourUrl}` : '.'
    }`,
    '',
    'N’hésitez pas si vous avez la moindre question.',
  ].join('\n');

  /* ------------------------------------------------- ce qui manque encore */

  const missing: string[] = [];
  if (!plan) missing.push('Le plan du logement donnerait la surface et le détail des pièces.');
  if (!couchages) missing.push('Le nombre de couchages est la première question d’un voyageur.');
  if (!proximite) missing.push('Ce qu’il y a à dix minutes à pied fait souvent la différence.');
  if (equipements.length === 0) missing.push('Les équipements se filtrent sur Airbnb : sans eux, l’annonce sort moins.');
  if (!particularites) missing.push('Ce qui rend le logement différent des autres reste à écrire.');

  return {
    title: buildTitle(property, plan, facts),
    summary,
    description,
    highlights: uniqueHighlights,
    travellerMessage: message,
    missing,
  };
}
