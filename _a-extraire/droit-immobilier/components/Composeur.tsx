'use client';

import { useRef, useState } from 'react';
import { MAX_PIECE_BYTES } from '@/lib/piece';

/**
 * Le champ où l'on écrit, et le seul endroit d'où part une question.
 *
 * Il tient son propre brouillon et sa propre pièce jointe : les remonter dans
 * la page obligerait chaque écran à les gérer, pour un état qui ne survit pas
 * à l'envoi.
 */

interface Props {
  onEnvoyer: (question: string, piece: File | null) => void;
  pending: boolean;
  /** Faux quand aucune clé d'API n'est configurée : le champ s'éteint. */
  actif: boolean;
  /** Change le pied : la consultation est-elle conservée ? */
  connecte: boolean;
  placeholder: string;
  action?: string;
  /** Variante d'accueil : plus haut, posé au milieu de la page. */
  grand?: boolean;
}

export function Composeur({
  onEnvoyer,
  pending,
  actif,
  connecte,
  placeholder,
  action = 'Envoyer',
  grand = false,
}: Props) {
  const [brouillon, setBrouillon] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [refus, setRefus] = useState('');
  const champ = useRef<HTMLInputElement>(null);

  function envoyer() {
    if (!actif || pending || !brouillon.trim()) return;
    onEnvoyer(brouillon, fichier);
    setBrouillon('');
    setFichier(null);
    if (champ.current) champ.current.value = '';
  }

  function choisirFichier(event: React.ChangeEvent<HTMLInputElement>) {
    const choisi = event.target.files?.[0] ?? null;
    if (choisi && choisi.size > MAX_PIECE_BYTES) {
      setRefus(`« ${choisi.name} » dépasse ${MAX_PIECE_BYTES / 1024 / 1024} Mo.`);
      event.target.value = '';
      return;
    }
    setRefus('');
    setFichier(choisi);
  }

  return (
    <form
      className={`jur-composer${grand ? ' jur-composer-grand' : ''}`}
      data-inactif={actif ? undefined : '1'}
      onSubmit={(event) => {
        event.preventDefault();
        envoyer();
      }}
    >
      <label className="sr-only" htmlFor="question">
        Votre question
      </label>
      <textarea
        id="question"
        value={brouillon}
        onChange={(event) => setBrouillon(event.target.value)}
        placeholder={actif ? placeholder : 'Assistant indisponible : aucune clé d’API n’est configurée sur ce site.'}
        maxLength={6000}
        disabled={!actif}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            envoyer();
          }
        }}
      />

      {refus && <p className="jur-refus">{refus}</p>}

      <div className="jur-composer-foot">
        <label className="jur-fichier">
          <input
            ref={champ}
            type="file"
            accept=".pdf,.txt,.md,.csv,image/jpeg,image/png,image/webp"
            disabled={!actif}
            onChange={choisirFichier}
          />
          <span aria-hidden="true">📎</span>
          {fichier ? fichier.name : 'Joindre un document'}
        </label>

        <p className="jur-hint">
          {connecte
            ? 'Consultation enregistrée dans vos dossiers. Le document joint, lui, n’est jamais conservé.'
            : 'Rien n’est conservé : en fermant cet onglet, le fil disparaît.'}
        </p>

        <button className="btn btn-accent" type="submit" disabled={!actif || pending || !brouillon.trim()}>
          {pending ? 'En cours…' : action}
        </button>
      </div>
    </form>
  );
}
