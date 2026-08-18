'use client';

/**
 * Mesure de l'attention, côté visiteur.
 *
 * Une horloge par pièce, qui ne tourne que pendant que la pièce est affichée
 * **et** que l'onglet est au premier plan. Un onglet laissé ouvert derrière une
 * autre fenêtre ne compte pas : sans cette précaution, la « pièce la plus
 * regardée » serait simplement celle sur laquelle on part déjeuner.
 *
 * L'envoi part une seule fois, au moment où la page disparaît, par
 * `sendBeacon` — la seule voie qui survit à la fermeture d'un onglet. Rien
 * n'est envoyé pendant la visite : ni requête à chaque changement de pièce, ni
 * battement régulier.
 *
 * Ce qui part tient en une phrase : le nom de la visite, et une durée par
 * pièce. Pas d'identifiant, pas de cookie, rien qui désigne une personne.
 */

/** En dessous, ce n'est pas de l'attention : c'est un passage. */
const MIN_SECONDS = 2;

export class AttentionTracker {
  private readonly seconds = new Map<string, number>();
  private current = '';
  private since = 0;
  private sent = false;
  private detach: Array<() => void> = [];

  constructor(private readonly slug: string) {}

  /** Branche les écouteurs. Rend la fonction de débranchement. */
  start(): () => void {
    if (typeof document === 'undefined') return () => {};

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        this.pause();
        // La page peut ne jamais revenir : c'est le moment d'envoyer.
        this.flush();
      } else {
        this.resume();
      }
    };
    const onHide = () => {
      this.pause();
      this.flush();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    this.detach = [
      () => document.removeEventListener('visibilitychange', onVisibility),
      () => window.removeEventListener('pagehide', onHide),
    ];

    return () => {
      this.pause();
      this.flush();
      for (const off of this.detach) off();
      this.detach = [];
    };
  }

  /** Le visiteur regarde cette pièce. Ferme le compte de la précédente. */
  enter(roomId: string): void {
    if (roomId === this.current) return;
    this.pause();
    this.current = roomId;
    this.since = roomId ? Date.now() : 0;
  }

  /** Arrête l'horloge sans changer de pièce. */
  private pause(): void {
    if (!this.current || !this.since) return;
    const elapsed = (Date.now() - this.since) / 1000;
    this.seconds.set(this.current, (this.seconds.get(this.current) ?? 0) + elapsed);
    this.since = 0;
  }

  private resume(): void {
    if (this.current && !this.since) this.since = Date.now();
  }

  /** Ce qui serait envoyé maintenant. Exposé pour les tests et le débogage. */
  snapshot(): Array<{ roomId: string; seconds: number }> {
    const out: Array<{ roomId: string; seconds: number }> = [];
    for (const [roomId, seconds] of this.seconds) {
      const rounded = Math.round(seconds);
      if (rounded >= MIN_SECONDS) out.push({ roomId, seconds: rounded });
    }
    return out;
  }

  /** Envoie une fois, puis plus jamais. */
  private flush(): void {
    if (this.sent) return;
    const rooms = this.snapshot();
    if (rooms.length === 0) return;
    this.sent = true;

    const body = JSON.stringify({ slug: this.slug, rooms });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/attention', new Blob([body], { type: 'application/json' }));
        return;
      }
    } catch {
      // Certains navigateurs refusent un Blob typé : on retombe sur fetch.
    }
    // `keepalive` permet à la requête de survivre au déchargement de la page.
    void fetch('/api/attention', { method: 'POST', body, keepalive: true }).catch(() => {});
  }
}
