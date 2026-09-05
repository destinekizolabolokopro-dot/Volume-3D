import { decouper } from '@/lib/mise-en-forme';

/**
 * Une réponse du spécialiste, mise en forme.
 *
 * Le composant ne connaît que des blocs — le découpage est dans
 * `lib/mise-en-forme.ts`, où il se teste sans navigateur. Ici, rien d'autre
 * que du rendu, et aucune insertion de HTML brut : le texte vient d'un
 * modèle, il traverse React comme du texte.
 */
export function Reponse({ texte }: { texte: string }) {
  return (
    <>
      {decouper(texte).map((bloc, index) => {
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
      })}
    </>
  );
}
