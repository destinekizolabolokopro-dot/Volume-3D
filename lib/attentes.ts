import 'server-only';
import { randomId } from './ids';
import { getStore } from './store';
import type { Attente } from './types';

/**
 * Qui attend quelle branche.
 *
 * Une ligne par compte et par branche. Redemander n'ajoute rien et ne lève
 * pas : quelqu'un qui reclique sur « prévenez-moi » doit voir « c'est noté »,
 * pas une erreur, et pas non plus se retrouver compté deux fois dans le seul
 * chiffre qui décidera de ce qu'on construit ensuite.
 */
export async function estInscrit(compteId: string, branche: string): Promise<boolean> {
  const lignes = await getStore().list('attentes', { compteId, branche });
  return lignes.length > 0;
}

export async function sInscrire(compteId: string, branche: string): Promise<void> {
  if (await estInscrit(compteId, branche)) return;

  const ligne: Attente = {
    id: randomId(),
    compteId,
    branche,
    createdAt: new Date().toISOString(),
  };
  await getStore().insert('attentes', ligne);
}

export async function seRetirer(compteId: string, branche: string): Promise<void> {
  await getStore().remove('attentes', { compteId, branche });
}

/** Les branches qu'un compte attend, pour cocher les onglets qu'il a demandés. */
export async function attentesDuCompte(compteId: string): Promise<string[]> {
  const lignes = await getStore().list('attentes', { compteId });
  return lignes.map((ligne) => ligne.branche);
}
