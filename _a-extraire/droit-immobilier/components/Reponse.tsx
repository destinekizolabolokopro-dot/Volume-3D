import type { ReactNode } from 'react';
import { Repli } from '@/components/Repli';
import { type Bloc, separer } from '@/lib/mise-en-forme';

/**
 * Une réponse du spécialiste, sur deux niveaux.
 *
 * Ce qui se lit sans rien connaître au droit est visible : la réponse, ce
 * qu'il y a à faire, le délai. Ce qui porte la règle exacte, les articles et
 * le vocabulaire du métier est replié derrière un bouton.
 *
 * Ce n'est pas une mise en page, c'est le produit. Quelqu'un dont le locataire
 * est parti sans payer veut savoir ce qu'il peut faire ce soir ; l'article 22
 * de la loi de 1989 ne lui sert qu'au moment où il écrit son courrier, ou
 * quand il ne nous croit pas. Les deux publics sont réels, ils ne sont pas
 * dans la même phrase, et les servir tous les deux en même temps revenait à
 * noyer le premier pour rassurer le second.
 *
 * Le découpage est dans `lib/mise-en-forme.ts`, où il se teste sans
 * navigateur. Ici, rien d'autre que du rendu, et aucune insertion de HTML
 * brut : le texte vient d'un modèle, il traverse React comme du texte.
 */
export function Reponse({
  texte,
  /** Ce qui rejoint le détail replié — les textes cités, par exemple. */
  complement,
}: {
  texte: string;
  complement?: ReactNode;
}) {
  const { clair, detail } = separer(texte);

  /* Pas de marqueur : une réponse courte, ou une consultation d'avant ce
     découpage. Elle reste entière, et c'est le repli générique qui décide si
     elle est assez longue pour être coupée. */
  if (detail.length === 0) {
    return (
      <>
        <Repli hauteur={420} quoi="la réponse">
          {rendre(clair)}
        </Repli>
        {complement}
      </>
    );
  }

  return (
    <>
      {rendre(clair)}
      <Repli
        hauteur={0}
        libelle="Voir le détail juridique"
        libelleReplie="Masquer le détail"
        quoi="le détail juridique"
      >
        {rendre(detail)}
        {complement}
      </Repli>
    </>
  );
}

function rendre(blocs: Bloc[]) {
  return blocs.map((bloc, index) => {
    if (bloc.type === 'titre') {
      return (
        <p className="jur-intertitre" key={index}>
          {bloc.texte}
        </p>
      );
    }
    if (bloc.type === 'liste') {
      return (
        <ul className="jur-liste" key={index}>
          {bloc.points.map((point, rang) => (
            <li key={rang}>{point}</li>
          ))}
        </ul>
      );
    }
    return <p key={index}>{bloc.texte}</p>;
  });
}
