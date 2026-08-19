import type { Metadata } from 'next';
import { FreeTour } from '@/components/FreeTour';
import { LogoMark } from '@/components/Logo';
import { SiteNav } from '@/components/landing/SiteNav';
import { CONTACT_EMAIL, PRICE_PER_LISTING } from '@/lib/content';
import { area } from '@/lib/journey-path';
import { roomArea, totalArea } from '@/lib/plan';
import {
  SHOWCASE_CAPTIONS,
  SHOWCASE_DOORS,
  SHOWCASE_IDENTITY,
  SHOWCASE_MASSING,
  SHOWCASE_ROOMS,
} from '@/lib/showcase';
import '../landing.css';

export const metadata: Metadata = {
  title: 'La visite, comme la voit votre voyageur — Volume3D',
  description:
    'Parcourez librement un logement reconstruit à partir de son plan : chaque pièce, chaque distance, telles qu’elles sont.',
};

/**
 * La démonstration : ce que reçoit le voyageur.
 *
 * L'accueil raconte le logement ; ici, on le rend. C'est le lien qu'un
 * propriétaire enverra à ses voyageurs, et donc le seul argument qui compte —
 * d'où le choix de ne rien mettre au-dessus de la visite, pas même un titre.
 * Le discours vient après, une fois qu'on a tourné la tête.
 */
export default function DemonstrationPage() {
  const rooms = [...SHOWCASE_ROOMS].sort((a, b) => roomArea(b) - roomArea(a));

  return (
    <div className="lp" id="haut">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>

      <SiteNav />

      <main id="contenu">
        <section className="demo-stage">
          <div className="wrap">
            <p className="kicker">Démonstration · {SHOWCASE_IDENTITY.city}</p>
            <h1 className="demo-title">Vous conduisez la visite</h1>
            <p className="demo-lead">
              Glissez pour regarder autour de vous, avancez pour changer de pièce. C’est exactement le
              lien que vos voyageurs recevront : rien à installer, rien à créer, il s’ouvre et il
              marche.
            </p>

            <FreeTour
              rooms={SHOWCASE_ROOMS}
              doors={SHOWCASE_DOORS}
              massing={SHOWCASE_MASSING}
              startRoomId="sejour"
            />

            <p className="demo-mention">{SHOWCASE_IDENTITY.disclaimer}</p>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker">Ce que contient ce logement</p>
              <h2>
                {SHOWCASE_IDENTITY.rooms} pièces, {area(totalArea(SHOWCASE_ROOMS))}
              </h2>
              <p>
                Chaque surface ci-dessous est calculée sur le polygone de la pièce, pas recopiée d’une
                annonce. C’est ce que change un relevé : le voyageur peut vérifier ce qu’il lit.
              </p>
            </div>

            <div className="demo-rooms">
              {rooms.map((room) => (
                <article className="demo-room" key={room.id}>
                  <h3>{room.name}</h3>
                  <p className="demo-area">{area(roomArea(room))}</p>
                  <p>{SHOWCASE_CAPTIONS[room.id]?.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="cta-band">
          <div className="wrap">
            <div className="cta-grid">
              <div>
                <p className="kicker">Et chez vous</p>
                <h2>Le même lien, avec vos murs</h2>
                <p>
                  On relève votre logement sur place en une vingtaine de minutes, et vous recevez ce
                  lien-là. {PRICE_PER_LISTING} par logement, payé une fois, sans abonnement.
                </p>
              </div>
              <div>
                <p className="demo-actions">
                  <a className="btn btn-accent" href="/#rendez-vous">
                    Prendre rendez-vous
                  </a>
                  <a className="btn btn-on-dark" href="/">
                    Revenir à l’accueil
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-inner">
          <span className="brand">
            <LogoMark size={20} />
            <span className="brand-name">
              Volume<span>3D</span>
            </span>
          </span>
          <span>
            France entière · <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </span>
          <a href="/espace">Espace client</a>
        </div>
      </footer>
    </div>
  );
}
