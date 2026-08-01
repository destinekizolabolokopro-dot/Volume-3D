'use client';

import { useState } from 'react';

/** Champ en lecture seule avec bouton « Copier » — pour les liens à envoyer aux propriétaires. */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

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
      <input id={`copy-${label ?? value}`} readOnly value={value} onFocus={(event) => event.target.select()} />
      <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
        {copied ? 'Copié ✓' : 'Copier'}
      </button>
    </div>
  );
}
