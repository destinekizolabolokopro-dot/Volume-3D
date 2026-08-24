import type { Metadata } from 'next';
import { LogoMark } from '@/components/Logo';
import { EntranceTour } from '@/components/landing/EntranceTour';
import { Reveal } from '@/components/landing/Reveal';
import { SiteNav } from '@/components/landing/SiteNav';
import { IconCheck } from '@/components/landing/icons';
import { CONTACT_EMAIL, PRICE_PER_LISTING } from '@/lib/content';
import { area } from '@/lib/journey-path';
import { roomArea } from '@/lib/plan';
import {
  VILLA_CAPTIONS,
  VILLA_CLOSING,
  VILLA_DOORS,
  VILLA_IDENTITY,
  VILLA_LISTING,
  VILLA_MASSING,
  VILLA_OPENING,
  VILLA_ROOMS,
} from '@/lib/villa';
import '../landing.css';
import '../maison/maison.css';

export const metadata: Metadata = {
  title: 'Une villa de 190 m², visitée au défilement — Volume3D',
  description:
    'Une villa de démonstration présentée comme une vraie annonce : la visite en tête, puis le prix, la capacité et les équipements. Le bien est fictif.',
};

/**
 * L'annonce de la villa.
 *
 * Elle ne porte **que** la visite au défilement. Pas de visite libre à la
 * souris, pas de panorama : un visiteur qui découvre le produit doit avoir une
 * seule chose à faire, et cette chose doit être celle qu'il fait déjà — faire
 * défiler une page. Tout le reste se propose ensuite, une fois qu'il sait de
 * quoi on parle.
 *
 * Le décor, lui, est le plus grand des trois, et c'est délibéré : c'est sur un
 * volume de cette taille qu'on voit ce qu'une visite apporte et qu'une galerie
 * de photographies ne donne pas — qu'on peut aller d'un bout à l'autre sans
 * repasser au même endroit.
 */
export default function VillaPage() {
  const rooms = [...VILLA_ROOMS].sort((a, b) => roomArea(b) - roomArea(a));
  const total = VILLA_LISTING.nightly * VILLA_LISTING.minimumNights + VILLA_LISTING.cleaning;

  return (
    <div className="lp" id="haut">
      <a className="skip-link" href="#annonce">
        Aller à l’annonce
      </a>

      <SiteNav darkUntil="#visite" />

      <main id="contenu">
        <div id="visite">
          <EntranceTour
            rooms={VILLA_ROOMS}
            doors={VILLA_DOORS}
            massing={VILLA_MASSING}
            opening={VILLA_OPENING}
            captions={VILLA_CAPTIONS}
            closing={VILLA_CLOSING}
            skipTo="#annonce"
            disclaimer={VILLA_IDENTITY.disclaimer}
            dehors="jardin"
            piscine
          />
        </div>

        <section className="sec" id="annonce">
          <div className="wrap">
            <p className="fiction" role="note">
              <strong>Bien fictif.</strong> Cette page imite une annonce de location pour montrer ce
              qu’une visite Volume3D y change. La villa, son nom et son prix sont inventés : elle
              n’est ni à louer, ni à visiter.
            </p>

            <Reveal className="listing-head">
              <div>
                <p className="kicker">{VILLA_IDENTITY.city}</p>
                <h1 className="listing-title">{VILLA_IDENTITY.name}</h1>
                <p className="listing-lede">
                  {VILLA_LISTING.surface} de plain-pied autour d’une galerie centrale. Un séjour
                  traversant de {area(60.48)} sur 10,80 m, trois chambres dont une suite avec sa
                  salle d’eau, et trois baies qui donnent sur la même terrasse. Vous venez de la
                  traverser.
                </p>
                <ul className="listing-facts">
                  {[...VILLA_LISTING.facts, { label: 'Surface', value: VILLA_LISTING.surface }].map((fact) => (
                    <li key={fact.label}>
                      <strong>{fact.value}</strong>
                      <span>{fact.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <aside className="listing-price" aria-label="Tarif du séjour">
                <p className="listing-amount">
                  <strong>{VILLA_LISTING.nightly}&nbsp;€</strong>
                  <span>par nuit</span>
                </p>
                <dl className="listing-bill">
                  <div>
                    <dt>
                      {VILLA_LISTING.nightly}&nbsp;€ × {VILLA_LISTING.minimumNights} nuits
                    </dt>
                    <dd>{VILLA_LISTING.nightly * VILLA_LISTING.minimumNights}&nbsp;€</dd>
                  </div>
                  <div>
                    <dt>Frais de ménage</dt>
                    <dd>{VILLA_LISTING.cleaning}&nbsp;€</dd>
                  </div>
                  <div className="listing-total">
                    <dt>Séjour de {VILLA_LISTING.minimumNights} nuits</dt>
                    <dd>{total}&nbsp;€</dd>
                  </div>
                </dl>
                <p className="listing-note">
                  Prix d’exemple, sur un bien qui n’existe pas. Rien ne se réserve depuis cette page.
                </p>
              </aside>
            </Reveal>
          </div>
        </section>

        <section className="sec sec-alt">
          <div className="wrap">
            <Reveal className="sec-head">
              <h2>Pièce par pièce</h2>
              <p>
                Chaque surface est calculée sur le polygone de la pièce, pas recopiée d’une annonce.
                Sur cent quatre-vingt-dix mètres carrés, c’est la seule façon d’être cru.
              </p>
            </Reveal>

            <Reveal className="demo-rooms">
              {rooms.map((room) => (
                <article className="demo-room" key={room.id}>
                  <h3>{room.name}</h3>
                  <p className="demo-area">{area(roomArea(room))}</p>
                  <p>{VILLA_CAPTIONS[room.id]?.text}</p>
                </article>
              ))}
            </Reveal>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <Reveal className="sec-head">
              <h2>Ce que contient la villa</h2>
              <p>
                La liste qu’un voyageur parcourt en diagonale avant de réserver. Avec la visite
                au-dessus, elle cesse d’être une liste de promesses : chaque ligne se vérifie d’un
                coup d’œil dans le volume.
              </p>
            </Reveal>

            <Reveal className="kit-grid">
              {VILLA_LISTING.equipment.map((group) => (
                <article className="kit" key={group.group}>
                  <h3>{group.group}</h3>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item}>
                        <IconCheck />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </Reveal>

            <Reveal className="rules">
              <h3>Règles du logement</h3>
              <ul>
                {VILLA_LISTING.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </Reveal>

            <p className="demo-mention">{VILLA_IDENTITY.disclaimer}</p>
          </div>
        </section>

        <section className="cta-band">
          <div className="wrap">
            <div className="cta-grid">
              <div>
                <p className="kicker">Et chez vous</p>
                <h2>La même page, avec vos murs</h2>
                <p>
                  On relève votre logement sur place, et vous recevez ce lien-là.{' '}
                  {PRICE_PER_LISTING} par logement, payé une fois, sans abonnement — ça, c’est le
                  vrai prix, et il n’a rien à voir avec les {VILLA_LISTING.nightly} € par nuit de
                  l’annonce ci-dessus.
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
