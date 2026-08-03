'use client';

import { useState } from 'react';

/**
 * Champ en lecture seule avec bouton « Copier » — pour les liens à envoyer aux
 * propriétaires.
 *
 * `label` ne sert qu'à distinguer deux champs dans le DOM ; `name` est le nom
 * lisible, celui qu'un lecteur d'écran annonce. Sans lui, l'utilisateur entend
 * « zone de texte » puis « Copier », sans savoir ce qu'il copie.
 */
export function CopyField({ value, label, name }: { value: string; label?: string; name?: string }) {
  const [copied, setCopied] = useState(false);
  const described = name ?? 'le lien';

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Presse-papiers refusé (http non sécurisé, permission) : on sélectionne
      // le texte pour que l'utilisateur puisse copier à la main.
      const input = document.getElementById(`copy-${label ?? value}`) as HTMLInputElement | null;
      input?.select();
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="link-box">
      <input
        id={`copy-${label ?? value}`}
        aria-label={described}
        readOnly
        value={value}
        onFocus={(event) => event.target.select()}
      />
      <button type="button" className="btn btn-ghost btn-sm" onClick={copy} aria-label={`Copier ${described}`}>
        {copied ? 'Copié ✓' : 'Copier'}
      </button>
    </div>
  );
}
