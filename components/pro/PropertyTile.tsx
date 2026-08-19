import { Tag } from '@/components/pro/Pro';
import type { Journey } from '@/lib/journey';
import type { Property } from '@/lib/types';

/**
 * La carte d'un logement, dans une liste.
 *
 * Elle porte quatre informations et pas une de plus : le nom, où c'est, où en
 * est le dossier, et ce que la visite a rapporté. C'est ce qu'on cherche en
 * ouvrant la liste ; le reste est à un clic.
 *
 * L'avancement est rendu en six segments plutôt qu'en une barre continue. Une
 * barre dirait « deux tiers » sans jamais dire de quel tiers il s'agit — alors
 * qu'un segment éteint entre deux allumés désigne exactement l'étape qui manque,
 * et la légende la nomme.
 */
export function PropertyTile({
  property,
  href,
  journey,
  cover,
  note,
}: {
  property: Property;
  href: string;
  /** Avancement du dossier. Absent quand la page ne le calcule pas. */
  journey?: Journey;
  /** Une image du logement. Chez le propriétaire, c'est ce qui identifie le
   *  bien le plus vite ; côté back-office, la liste est trop longue pour ça. */
  cover?: string | null;
  /** Ce qui s'affiche à droite du pied. Par défaut, le propriétaire — ce que
   *  cherche le back-office. Le propriétaire, lui, se connaît déjà. */
  note?: string;
}) {
  const live = property.status === 'published';
  const city = property.city.trim();

  return (
    <a className="pro-tile" href={href} data-cover={cover !== undefined ? '1' : undefined}>
      {cover !== undefined && (
        <div className="pro-tile-cover">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" loading="lazy" />
          ) : (
            <span>Aucune image</span>
          )}
        </div>
      )}

      <div className="pro-tile-top">
        <div style={{ minWidth: 0 }}>
          <p className="pro-tile-name">{property.name || 'Logement sans nom'}</p>
          <p className="pro-tile-where" data-missing={city ? undefined : '1'}>
            {city || 'Ville à renseigner'}
          </p>
        </div>
        <Tag tone={live ? 'live' : 'draft'}>{live ? 'En ligne' : 'Brouillon'}</Tag>
      </div>

      {journey && (
        <>
          <div
            className="pro-steps"
            role="img"
            aria-label={`Dossier : ${journey.steps.filter((step) => step.state === 'done').length} étapes sur ${journey.steps.length}`}
          >
            {journey.steps.map((step) => (
              <span key={step.key} className="pro-step" data-state={step.state} />
            ))}
          </div>
          <p className="pro-steps-note">
            {journey.current ? `Reste à faire : ${journey.current.label.toLowerCase()}` : 'Dossier complet'}
          </p>
        </>
      )}

      <div className="pro-tile-foot">
        <span className="pro-tile-views">
          {property.views} vue{property.views > 1 ? 's' : ''}
        </span>
        <span>{note ?? property.ownerName ?? '—'}</span>
      </div>
    </a>
  );
}
