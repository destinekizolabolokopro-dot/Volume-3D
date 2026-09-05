import type { Metadata } from 'next';
import './juridique.css';

export const metadata: Metadata = {
  title: {
    default: 'Assistant juridique immobilier — neuf spécialités, pour les propriétaires',
    template: '%s · Droit immobilier',
  },
  description:
    'Bail, location courte durée, copropriété, achat-vente, travaux, urbanisme, voisinage, fiscalité, sinistres : posez votre question, elle va au bon spécialiste. Information juridique, pas consultation d’avocat.',
};

export default function JuridiqueLayout({ children }: { children: React.ReactNode }) {
  return <div className="jur">{children}</div>;
}
