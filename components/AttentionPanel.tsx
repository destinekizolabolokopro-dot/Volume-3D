import { Empty, Meter, Section } from '@/components/pro/Pro';
import { formatDuration, insight, summarize, type RoomAttention } from '@/lib/attention';
import type { PlanRoom, Scene } from '@/lib/types';

/**
 * Ce que les voyageurs regardent, dans le tableau de bord.
 *
 * Un graphique ne dit pas quoi faire. La phrase du haut porte donc la
 * conclusion, et les barres ne servent qu'à la vérifier. Tant que le nombre de
 * visites ne permet pas de conclure, on le dit au lieu d'afficher une tendance
 * tirée de trois visiteurs — et les barres passent en gris pour que l'œil ne
 * leur accorde pas une autorité que le chiffre n'a pas.
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
    <Section title="Ce que vos voyageurs regardent" note="temps passé par pièce, sur toutes vos visites">
      {summary.rooms.length === 0 ? (
        <Empty title="Aucune mesure pour l’instant">
          Dès qu’un voyageur ouvrira une de vos visites, vous verrez ici quelles pièces retiennent
          l’attention et laquelle décroche.
        </Empty>
      ) : (
        <div className="pro-panel">
          {message && <p className="pro-lede" data-tone={summary.thin ? 'soft' : undefined}>{message}</p>}

          {summary.rooms.map((room) => (
            <Meter
              key={room.roomId}
              label={room.name}
              /*
               * La barre porte la part du temps total ; l'intitulé doit donc
               * commencer par elle. Il commençait par la moyenne par ouverture,
               * et l'œil rapportait la barre à ce chiffre-là : un salon vu cinq
               * secondes par tout le monde tirait une barre presque aussi
               * longue qu'un séjour vu dix-neuf secondes par un quart des
               * visiteurs, ce qui donnait l'impression d'un graphique faux. Il
               * ne l'était pas — il mesurait autre chose que ce qu'on lisait à
               * côté.
               */
              note={`${Math.round(room.share * 100)} % du temps · ${formatDuration(room.average)} par ouverture · ${Math.round(room.reach * 100)} % des visites`}
              share={room.share}
              tone={summary.thin ? 'soft' : undefined}
            />
          ))}

          <p className="pro-foot">
            {summary.visits} visite{summary.visits > 1 ? 's' : ''} mesurée
            {summary.visits > 1 ? 's' : ''} · {formatDuration(summary.totalSeconds)} au total. Aucune donnée
            personnelle n’est enregistrée : ni identifiant, ni cookie, ni adresse. Seules des durées, cumulées
            par pièce et par jour.
          </p>
        </div>
      )}
    </Section>
  );
}
