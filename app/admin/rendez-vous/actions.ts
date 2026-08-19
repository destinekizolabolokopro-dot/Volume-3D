'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/require-auth';
import { getStore } from '@/lib/store';

const ALLOWED = new Set(['demande', 'confirme', 'annule']);

/**
 * Change l'état d'un rendez-vous.
 *
 * Annuler libère le créneau — `bookedSlots` ignore les annulés — donc cette
 * action a un effet visible côté public : un créneau annulé redevient
 * réservable dans la minute.
 */
export async function setAppointmentStatus(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !ALLOWED.has(status)) return;

  await getStore().update('appointments', id, { status });
  revalidatePath('/admin/rendez-vous');
  revalidatePath('/');
}
