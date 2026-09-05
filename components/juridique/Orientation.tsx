'use client';

import { useState } from 'react';

/**
 * Le champ unique de la page d'accueil.
 *
 * Il ne répond pas à la question : il dit où elle va, et pourquoi. Les mots
 * retenus sont affichés — « j'ai vu licenciement, employeur » — parce qu'un
 * aiguillage qui se trompe en silence est plus agaçant qu'un menu, alors qu'un
 * aiguillage qui montre son raisonnement se corrige d'un clic.
 */

interface Piste {
  id: string;
  label: string;
  resume: string;
  indices: string[];
}

interface Verdict {
  domaine: string | null;
  certitude: 'sure' | 'hesitante' | 'nulle';
  pistes: Piste[];
}

function lien(id: string, question: string): string {
  return `/juridique/${id}?q=${encodeURIComponent(question)}`;
}

export function Orientation() {
  const [question, setQuestion] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState('');

  async function chercher(event: React.FormEvent) {
    event.preventDefault();
    const propre = question.trim();
    if (propre.length < 8 || pending) {
      if (propre.length < 8) setErreur('Écrivez votre situation en une phrase au moins.');
      return;
    }

    setPending(true);
    setErreur('');
    setVerdict(null);

    try {
      const reponse = await fetch('/api/juridique/aiguillage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: propre }),
      });
      const corps = (await reponse.json()) as Verdict & { error?: string };
      if (!reponse.ok) throw new Error(corps.error ?? 'Aiguillage impossible.');
      setVerdict(corps);
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : 'Aiguillage impossible.');
    } finally {
      setPending(false);
    }
  }

  const retenu = verdict?.pistes.find((piste) => piste.id === verdict.domaine) ?? verdict?.pistes[0];
  const autres = verdict?.pistes.filter((piste) => piste.id !== retenu?.id) ?? [];

  return (
    <form className="jur-ask" onSubmit={chercher}>
      <label className="sr-only" htmlFor="question">
        Votre situation
      </label>
      <textarea
        id="question"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Décrivez votre situation en quelques mots. Par exemple : mon propriétaire refuse de me rendre le dépôt de garantie deux mois après mon départ."
        maxLength={2000}
      />

      <div className="jur-ask-foot">
        <p>Aucune inscription n’est demandée pour poser une question.</p>
        <button className="btn btn-accent" type="submit" disabled={pending}>
          {pending ? 'Recherche…' : 'Trouver le spécialiste'}
        </button>
      </div>

      {erreur && <p className="jur-erreur" style={{ marginTop: 14, marginBottom: 0 }}>{erreur}</p>}

      {verdict && verdict.certitude === 'nulle' && (
        <div className="jur-verdict">
          <h3>Je n’ai pas reconnu de spécialité</h3>
          <p>
            Votre question ne contient pas encore de quoi la ranger. Précisez ce qui s’est passé et
            avec qui — un employeur, un propriétaire, une administration, un vendeur —, ou choisissez
            directement une spécialité dans la liste ci-dessous.
          </p>
        </div>
      )}

      {verdict && retenu && verdict.certitude !== 'nulle' && (
        <div className="jur-verdict">
          <h3>{retenu.label}</h3>
          <p>{retenu.resume}</p>

          {retenu.indices.length > 0 && (
            <>
              <p style={{ marginBottom: 6 }}>Ce que j’ai retenu de votre question :</p>
              <ul className="jur-indices">
                {retenu.indices.map((indice) => (
                  <li key={indice}>{indice}</li>
                ))}
              </ul>
            </>
          )}

          <a className="btn btn-accent" href={lien(retenu.id, question.trim())}>
            Poser la question à ce spécialiste
          </a>

          {autres.length > 0 && (
            <p className="jur-autres">
              Ce n’est pas ça ?{' '}
              {autres.map((piste) => (
                <a key={piste.id} href={lien(piste.id, question.trim())}>
                  {piste.label}
                </a>
              ))}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
