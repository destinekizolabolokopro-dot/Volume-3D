'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { estBrancheId } from '@/lib/branches';
import { compteCourant } from '@/lib/comptes';
import { seRetirer, sInscrire } from '@/lib/attentes';

/**
 * Demander à être prévenu de l'ouverture d'une branche, ou se retirer.
 *
 * Une seule action pour les deux sens : le formulaire dit ce qu'il veut dans
 * un champ caché. Deux actions symétriques auraient partagé la même
 * vérification de compte et le même contrôle de branche, et l'une des deux
 * aurait fini par les perdre.
 */
export async function basculerLAttente(formData: FormData): Promise<void> {
  const compte = await compteCourant();
  if (!compte) redirect('/entrer');

  const branche = formData.get('branche');
  if (!estBrancheId(branche)) redirect('/espace');

  if (formData.get('retirer') === '1') await seRetirer(compte.id, branche);
  else await sInscrire(compte.id, branche);

  /* `revalidatePath` SANS redirection, et c'est la nuance qui fait que le
     bouton a l'air de marcher. Rediriger vers la page qu'on quitte à peine,
     c'est une navigation aux yeux du routeur : il ressert alors le rendu qu'il
     a déjà en mémoire, et l'écran revient identique. On cliquait « prévenez-
     moi », la ligne s'écrivait, et rien ne bougeait — le pire des deux mondes.
     Sans redirection, l'invalidation seule refait la page courante. */
  revalidatePath(`/espace/branches/${branche}`);
}
