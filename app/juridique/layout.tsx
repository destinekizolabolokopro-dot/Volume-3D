import type { Metadata } from 'next';
import { MARQUE } from '@/lib/juridique/copie';
import './juridique.css';

export const metadata: Metadata = {
  title: {
    default: `${MARQUE.nom} — dix spécialités, pour les propriétaires et les professionnels`,
    template: `%s · ${MARQUE.nom}`,
  },
  description:
    'Bail, location courte durée, copropriété, achat-vente, travaux, urbanisme, voisinage, fiscalité, sinistres : posez votre question, elle va au bon spécialiste. Information juridique, pas consultation d’avocat.',
};

export default function JuridiqueLayout({ children }: { children: React.ReactNode }) {
  return <div className="jur">{children}</div>;
}
