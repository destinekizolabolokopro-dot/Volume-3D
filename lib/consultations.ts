import 'server-only';
import { randomId } from './ids';
import { getStore } from './store';
import type { Consultation, ConsultationTour } from './types';

/**
 * L'historique des consultations.
 *
 * Une consultation n'est enregistrée que si la personne a un compte. Sans
 * compte, le fil vit dans l'onglet et disparaît avec lui : c'est écrit sur la
 * page, et c'est préférable à un identifiant déposé dans un cookie pour
 * rattacher après coup des questions sur un divorce ou une garde à vue.
 *
 * Toutes les lectures passent par `accountId`. Aucune fonction de ce fichier
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
  accountId: string,
  domaine: string,
  premiereQuestion: string,
): Promise<Consultation> {
  const maintenant = new Date().toISOString();
  const consultation: Consultation = {
    id: randomId(),
    accountId,
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
  accountId: string,
): Promise<Consultation | null> {
  const consultation = await getStore().get('consultations', id);
  return consultation && consultation.accountId === accountId ? consultation : null;
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
export async function consultationsDuCompte(accountId: string): Promise<Consultation[]> {
  const fils = await getStore().list('consultations', { accountId });
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
export async function effacerConsultation(id: string, accountId: string): Promise<boolean> {
  const consultation = await consultationDuCompte(id, accountId);
  if (!consultation) return false;
  const store = getStore();
  await store.remove('consultationTours', { consultationId: id });
  await store.remove('consultations', { id });
  return true;
}
