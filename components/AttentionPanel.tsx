import { formatDuration, insight, summarize, type RoomAttention } from '@/lib/attention';
import type { PlanRoom, Scene } from '@/lib/types';

/**
 * Ce que les voyageurs regardent, dans le tableau de bord.
 *
 * Un graphique ne dit pas quoi faire. La phrase du haut porte donc la
 * conclusion, et les barres ne servent qu'à la vérifier. Tant que le nombre de
 * visites ne permet pas de conclure, on le dit au lieu d'afficher une tendance
 * tirée de trois visiteurs.
 */
export function AttentionPanel({
  rows,
  rooms,
}: {
  rows: RoomAttention[];
  rooms: Array<Pick<Scene, 'id' | 'name'> | Pick<PlanRoom, 'id' | 'name'>>;
}) {
  const summary = summarize(rows, rooms);
  const message = insight(summary);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Ce que vos voyageurs regardent</h2>
        <small>Temps passé par pièce, sur toutes vos visites</small>
      </div>

      {summary.rooms.length === 0 ? (
        <div className="empty">
          <strong>Aucune mesure pour l’instant</strong>
          Dès qu’un voyageur ouvrira une de vos visites, vous verrez ici quelles pièces retiennent
          l’attention et laquelle décroche.
        </div>
      ) : (
        <>
          {message && (
            <p style={{ margin: '0 0 20px', fontSize: 15, lineHeight: 1.55 }}>
              {summary.thin ? <span className="muted">{message}</span> : message}
            </p>
          )}

          <div className="stack-sm">
            {summary.rooms.map((room) => (
              <div key={room.roomId}>
                <div className="row row-between" style={{ marginBottom: 5 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{room.name}</span>
                  <span className="tiny">
                    {formatDuration(room.average)} en moyenne · {Math.round(room.reach * 100)} % des visites
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: 'var(--bg-sunk)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.max(2, Math.round(room.share * 100))}%`,
                      background: 'var(--accent)',
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="tiny" style={{ marginTop: 18 }}>
            {summary.visits} visite{summary.visits > 1 ? 's' : ''} mesurée
            {summary.visits > 1 ? 's' : ''} · {formatDuration(summary.totalSeconds)} au total. Aucune donnée
            personnelle n’est enregistrée : ni identifiant, ni cookie, ni adresse. Seules des durées, cumulées
            par pièce et par jour.
          </p>
        </>
      )}
    </section>
  );
}
