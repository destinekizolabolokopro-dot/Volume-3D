'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ChatWidget.module.css';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Combien de personnes peut accueillir le logement ?',
  'Y a-t-il une chambre séparée ?',
  'Comment est la luminosité ?',
];

/**
 * Assistant de la visite : répond aux questions du voyageur sur ce logement,
 * à partir de ce que le propriétaire a renseigné.
 */
export function ChatWidget({ slug, propertyName }: { slug: string; propertyName: string }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, pending]);

  async function ask(question: string) {
    const cleaned = question.trim();
    if (!cleaned || pending) return;

    const next: Turn[] = [...turns, { role: 'user', content: cleaned }];
    setTurns(next);
    setDraft('');
    setPending(true);
    setError('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, messages: next }),
      });
      const body = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Réponse impossible.');
      setTurns([...next, { role: 'assistant', content: body.answer ?? '' }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Réponse impossible.');
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={styles.launcher} onClick={() => setOpen(true)}>
        <span className={styles.launcherDot} aria-hidden="true" />
        Une question sur ce logement ?
      </button>
    );
  }

  return (
    <div className={styles.panel} role="dialog" aria-label="Assistant de la visite">
      <header className={styles.head}>
        <div>
          <strong>Une question ?</strong>
          <span className={styles.sub}>À propos de {propertyName}</span>
        </div>
        <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Fermer">
          ✕
        </button>
      </header>

      <div className={styles.thread} ref={scrollRef}>
        {turns.length === 0 && (
          <>
            <div className={`${styles.bubble} ${styles.fromBot}`}>
              Bonjour ! Posez-moi vos questions sur ce logement, je réponds à partir des informations
              fournies par le propriétaire.
            </div>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" className={styles.chip} onClick={() => ask(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </>
        )}

        {turns.map((turn, index) => (
          <div
            key={index}
            className={`${styles.bubble} ${turn.role === 'user' ? styles.fromUser : styles.fromBot}`}
          >
            {turn.content}
          </div>
        ))}

        {pending && (
          <div className={`${styles.bubble} ${styles.fromBot} ${styles.typing}`}>
            <i /> <i /> <i />
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}
      </div>

      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Votre question…"
          maxLength={500}
          aria-label="Votre question"
        />
        <button type="submit" disabled={pending || draft.trim() === ''} aria-label="Envoyer">
          →
        </button>
      </form>

      <p className={styles.note}>
        Réponses générées à partir de la fiche du logement. En cas de doute, contactez le propriétaire.
      </p>
    </div>
  );
}
