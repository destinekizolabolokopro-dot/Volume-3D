'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { compteCourant } from '@/lib/juridique/comptes';
import { effacerConsultation } from '@/lib/juridique/consultations';

/**
 * Effacer une consultation.
 *
 * Sans confirmation intermédiaire, et c'est assumé : le bouton porte le mot
 * « Effacer », l'action est immédiate, et une personne qui vient de poser des
 * questions sur son divorce ou sa garde à vue doit pouvoir les faire
 * disparaître d'un geste, pas en traversant une boîte de dialogue.
 */
export async function effacer(formData: FormData): Promise<void> {
  const compte = await compteCourant();
  if (!compte) redirect('/espace/connexion');

  const id = String(formData.get('id') ?? '');
  if (id) await effacerConsultation(id, compte.id);

  revalidatePath('/juridique/dossiers');
  redirect('/juridique/dossiers');
}
