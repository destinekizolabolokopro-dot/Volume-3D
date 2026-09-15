import 'server-only';
import { randomId } from '../ids';
import { getStore } from '../store';
import type { Consultation, ConsultationTour } from '../types';

/**
 * L'historique des consultations.
 *
 * Une consultation n'est enregistrée que si la personne a un compte. Sans
 * compte, le fil vit dans l'onglet et disparaît avec lui : c'est écrit sur la
 * page, et c'est préférable à un identifiant déposé dans un cookie pour
 * rattacher après coup des questions sur un divorce ou une garde à vue.
 *
 * Toutes les lectures passent par `compteId`. Aucune fonction de ce fichier
 * ne renvoie une consultation sans vérifier à qui elle appartient : c'est la
 * seule barrière entre deux comptes, elle doit donc être unique et non
 * contournable.
 */

const TITRE_MAX = 120;

function titrer(question: string): string {
  const propre = question.replace(/\s+/g, ' ').trim();
  return propre.length > TITRE_MAX ? `${propre.slice(0, TITRE_MAX - 1)}…` : propre;
}

export async function ouvrirConsultation(
  compteId: string,
  domaine: string,
  premiereQuestion: string,
): Promise<Consultation> {
  const maintenant = new Date().toISOString();
  const consultation: Consultation = {
    id: randomId(),
    compteId,
    domaine,
    titre: titrer(premiereQuestion),
    createdAt: maintenant,
    updatedAt: maintenant,
  };
  await getStore().insert('consultations', consultation);
  return consultation;
}

/** La consultation, seulement si elle appartient bien à ce compte. */
export async function consultationDuCompte(
  id: string,
  compteId: string,
): Promise<Consultation | null> {
  const consultation = await getStore().get('consultations', id);
  return consultation && consultation.compteId === compteId ? consultation : null;
}

export async function ajouterTour(
  consultation: Consultation,
  tour: { role: 'user' | 'assistant'; content: string; piece?: string },
): Promise<ConsultationTour> {
  const store = getStore();
  const ligne: ConsultationTour = {
    id: randomId(),
    consultationId: consultation.id,
    role: tour.role,
    content: tour.content,
    piece: tour.piece ?? '',
    createdAt: new Date().toISOString(),
  };
  await store.insert('consultationTours', ligne);
  await store.update('consultations', consultation.id, { updatedAt: ligne.createdAt });
  return ligne;
}

/** Les fils du compte, du plus récemment actif au plus ancien. */
export async function consultationsDuCompte(compteId: string): Promise<Consultation[]> {
  const fils = await getStore().list('consultations', { compteId });
  return fils.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Les messages d'un fil, dans l'ordre où ils ont été écrits. */
export async function toursDeConsultation(consultationId: string): Promise<ConsultationTour[]> {
  const tours = await getStore().list('consultationTours', { consultationId });
  return tours.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Efface un fil et tous ses messages. Le compte doit être le sien — la
 * vérification est refaite ici et ne se délègue pas à l'appelant.
 */
export async function effacerConsultation(id: string, compteId: string): Promise<boolean> {
  const consultation = await consultationDuCompte(id, compteId);
  if (!consultation) return false;
  const store = getStore();
  await store.remove('consultationTours', { consultationId: id });
  await store.remove('consultations', { id });
  return true;
}

/**
 * Le nombre de questions posées ce mois-ci par un compte.
 *
 * Il est recalculé à la demande plutôt que tenu dans un compteur : un
 * compteur peut dériver de la réalité — une consultation effacée, une
 * écriture perdue — et il faudrait alors décider laquelle des deux valeurs
 * fait foi. Ici la question est comptée là où elle est écrite, et effacer une
 * consultation rend vraiment ses questions.
 *
 * Le filtrage se fait en mémoire : la couche de stockage ne sait comparer que
 * des égalités, et à cette échelle un compte n'a pas assez de messages pour
 * que cela se voie. Si cela devait changer, c'est ici qu'on ajouterait un
 * index par mois.
 */
export async function questionsDuMois(compteId: string, maintenant = new Date()): Promise<number> {
  const debut = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1)).toISOString();
  const store = getStore();
  const fils = await store.list('consultations', { compteId });
  if (fils.length === 0) return 0;

  /* Les messages sont lus FIL PAR FIL. La nuance décide de la justesse du
     compte : une liste renvoie au plus mille lignes côté Postgres, si bien
     que demander tous les messages du site pour n'en garder que les siens
     revenait, passé le millier, à sous-compter sans que rien ne le signale. */
  const parFil = await Promise.all(
    fils.map((fil) => store.list('consultationTours', { consultationId: fil.id, role: 'user' })),
  );
  return parFil.flat().filter((tour) => tour.createdAt >= debut).length;
}
