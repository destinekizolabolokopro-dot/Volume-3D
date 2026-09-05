import type { Metadata } from 'next';
import './juridique.css';

export const metadata: Metadata = {
  title: {
    default: 'Assistant juridique — treize spécialités du droit français',
    template: '%s · Assistant juridique',
  },
  description:
    'Posez votre question en français : elle est orientée vers le spécialiste compétent — logement, travail, famille, consommation, succession, étrangers, pénal, fiscal. Information juridique, pas consultation d’avocat.',
};

export default function JuridiqueLayout({ children }: { children: React.ReactNode }) {
  return <div className="jur">{children}</div>;
}
