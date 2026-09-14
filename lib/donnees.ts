import 'server-only';
import { consultationsDuCompte, toursDeConsultation } from './consultations';
import { getStore } from './store';
import type { CompteJuridique } from './types';

/**
 * Les deux droits qu'on exerce sans demander la permission : emporter ses
 * données, et les faire disparaître.
 *
 * Les articles 17 et 20 du RGPD les accordent à tout le monde, et la plupart
 * des services les enterrent derrière un formulaire de contact et un délai
 * d'un mois. Ils sont ici deux boutons, pour une raison simple : un droit
 * qu'il faut réclamer par courriel est un droit que presque personne
 * n'exerce, et le rendre facile ne coûte rien à qui n'a rien à cacher.
 *
 * Les deux opérations sont écrites ici plutôt que dans l'action du formulaire,
 * parce qu'elles décrivent la forme réelle de la base : quand une table
 * s'ajoutera, c'est ce fichier qu'il faudra relire, et la politique de
 * confidentialité avec lui.
 */

/** Ce qu'un compte emporte : tout ce que la base sait de lui, et rien d'autre. */
export interface Export {
  exporteLe: string;
  compte: {
    nom: string;
    email: string;
    formule: string;
    creeLe: string;
    adresseConfirmeeLe: string;
  };
  consultations: {
    specialite: string;
    titre: string;
    ouverteLe: string;
    derniereActiviteLe: string;
    messages: { qui: string; texte: string; document: string; le: string }[];
  }[];
  courriersRediges: { modele: string; le: string }[];
}

/**
 * Rassemble tout ce que ce site détient sur un compte.
 *
 * Le format est du JSON, comme l'article 20 le demande — « structuré,
 * couramment utilisé et lisible par machine » —, mais les clés sont en
 * français et en toutes lettres : le texte doit se lire aussi bien par la
 * personne que par la machine, et « adresseConfirmeeLe » se comprend là où
 * « verified_at » demande de deviner.
 *
 * Les empreintes — mot de passe, jetons — ne sont PAS exportées. Ce ne sont
 * pas des données sur la personne : ce sont des secrets du serveur, et les
 * poser dans un fichier qui va transiter par une boîte mail serait la seule
 * chose vraiment dangereuse que ce bouton pourrait faire.
 */
export async function exporterLeCompte(compte: CompteJuridique): Promise<Export> {
  const fils = await consultationsDuCompte(compte.id);

  const consultations = [];
  for (const fil of fils) {
    const tours = await toursDeConsultation(fil.id);
    consultations.push({
      specialite: fil.domaine,
      titre: fil.titre,
      ouverteLe: fil.createdAt,
      derniereActiviteLe: fil.updatedAt,
      messages: tours.map((tour) => ({
        qui: tour.role === 'user' ? 'vous' : 'l’assistant',
        texte: tour.content,
        document: tour.piece,
        le: tour.createdAt,
      })),
    });
  }

  const courriers = await getStore().list('documentsRediges', { compteId: compte.id });

  return {
    exporteLe: new Date().toISOString(),
    compte: {
      nom: compte.nom,
      email: compte.email,
      formule: compte.abonnement,
      creeLe: compte.createdAt,
      adresseConfirmeeLe: compte.emailVerifieA || '',
    },
    consultations,
    courriersRediges: courriers.map((c) => ({ modele: c.modele, le: c.createdAt })),
  };
}

/**
 * Efface un compte et tout ce qui s'y rattache.
 *
 * L'effacement est RÉEL : la ligne du compte disparaît, elle n'est pas marquée
 * « supprimée ». Un compte marqué reste un compte — on garde l'adresse, la
 * date, le nom —, et l'article 17 parle d'effacement, pas de mise en sommeil.
 *
 * L'ordre compte. Les messages partent avant les fils, et les fils avant le
 * compte : à l'inverse, une panne au milieu laisserait des messages
 * orphelins que plus rien ne rattache à personne, donc plus rien ne permet
 * d'effacer. Ici, une panne au milieu laisse un compte encore entier, qu'un
 * second clic finira d'effacer.
 */
export async function effacerLeCompte(compteId: string): Promise<void> {
  const store = getStore();

  const fils = await consultationsDuCompte(compteId);
  for (const fil of fils) {
    await store.remove('consultationTours', { consultationId: fil.id });
  }
  await store.remove('consultations', { compteId });
  await store.remove('documentsRediges', { compteId });
  await store.remove('jetonsCompte', { compteId });
  await store.remove('attentes', { compteId });
  await store.remove('comptesJuridiques', { id: compteId });
}
