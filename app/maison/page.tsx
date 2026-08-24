import type { Metadata } from 'next';
import { FreeTour } from '@/components/FreeTour';
import { LogoMark } from '@/components/Logo';
import { EntranceTour } from '@/components/landing/EntranceTour';
import { Reveal } from '@/components/landing/Reveal';
import { SiteNav } from '@/components/landing/SiteNav';
import { IconCheck } from '@/components/landing/icons';
import { CONTACT_EMAIL, PRICE_PER_LISTING } from '@/lib/content';
import { area } from '@/lib/journey-path';
import { roomArea } from '@/lib/plan';
import {
  MAISON_CAPTIONS,
  MAISON_CLOSING,
  MAISON_DOORS,
  MAISON_IDENTITY,
  MAISON_LISTING,
  MAISON_MASSING,
  MAISON_OPENING,
  MAISON_ROOMS,
} from '@/lib/maison';
import '../landing.css';
import './maison.css';

export const metadata: Metadata = {
  title: 'Une annonce entière, visite comprise — Volume3D',
  description:
    'Une maison de démonstration présentée comme une vraie annonce : la visite en tête, puis le prix, la capacité et les équipements. Le bien est fictif.',
};

/**
 * L'annonce de démonstration.
 *
 * L'accueil montre une visite ; cette page montre **une annonce**. La nuance
 * est tout le sujet : un propriétaire ne se demande pas si une visite 3D est
 * jolie, il se demande à quoi ressemblera *sa page* avec ça dedans, et ce que
 * le voyageur lira juste en dessous. Une visite posée dans le vide ne répond
 * pas à cette question. Une annonce complète — prix à la nuit, capacité,
 * équipements, règles — avec la visite en tête, y répond en un écran.
 *
 * D'où l'ordre : la visite d'abord, plein cadre, puis tout ce qu'une annonce
 * porte, dans l'ordre où on le lit. Et la mention du caractère fictif à trois
 * endroits — au-dessus de la visite, dans l'annonce, et au pied — parce que la
 * page imite volontairement une annonce réelle et qu'une imitation qui ne se
 * déclare pas est un faux.
 *
 * Il n'y a **ni note, ni avis, ni historique de réservation**, et c'est
 * délibéré. Une note en étoiles inventée est un faux document quelle que soit
 * la mention qui l'entoure — et c'est exactement la retouche qu'on reproche
 * aux annonces qu'on veut remplacer.
 */
export default function MaisonPage() {
  const rooms = [...MAISON_ROOMS].sort((a, b) => roomArea(b) - roomArea(a));
  const total = MAISON_LISTING.nightly * MAISON_LISTING.minimumNights + MAISON_LISTING.cleaning;

  return (
    <div className="lp" id="haut">
      <a className="skip-link" href="#annonce">
        Aller à l’annonce
      </a>

      <SiteNav darkUntil="#visite" />

      <main id="contenu">
        <div id="visite">
          <EntranceTour
            rooms={MAISON_ROOMS}
            doors={MAISON_DOORS}
            massing={MAISON_MASSING}
            opening={MAISON_OPENING}
            captions={MAISON_CAPTIONS}
            closing={MAISON_CLOSING}
            skipTo="#annonce"
            disclaimer={MAISON_IDENTITY.disclaimer}
            dehors="jardin"
          />
        </div>

        {/* ------------------------------------------------------- l’annonce --- */}
        <section className="sec" id="annonce">
          <div className="wrap">
            <p className="fiction" role="note">
              <strong>Bien fictif.</strong> Cette page imite une annonce de location pour montrer ce
              qu’une visite Volume3D y change. La maison, son nom et son prix sont inventés : elle
              n’est ni à louer, ni à visiter.
            </p>

            <Reveal className="listing-head">
              <div>
                <p className="kicker">{MAISON_IDENTITY.city}</p>
                <h1 className="listing-title">{MAISON_IDENTITY.name}</h1>
                <p className="listing-lede">
                  Une maison de plain-pied de {area(MAISON_IDENTITY.area)}, ouverte sur un jardin par
                  une baie de 3,60 m. Deux chambres, une salle de bain de {area(10.92)}, et un couloir
                  qui dessert tout sans une seule marche. Vous venez de la traverser.
                </p>
                <ul className="listing-facts">
                  {MAISON_LISTING.facts.map((fact) => (
                    <li key={fact.label}>
                      <strong>{fact.value}</strong>
                      <span>{fact.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <aside className="listing-price" aria-label="Tarif du séjour">
                <p className="listing-amount">
                  <strong>{MAISON_LISTING.nightly}&nbsp;€</strong>
                  <span>par nuit</span>
                </p>
                <dl className="listing-bill">
                  <div>
                    <dt>
                      {MAISON_LISTING.nightly}&nbsp;€ × {MAISON_LISTING.minimumNights} nuits
                    </dt>
                    <dd>{MAISON_LISTING.nightly * MAISON_LISTING.minimumNights}&nbsp;€</dd>
                  </div>
                  <div>
                    <dt>Frais de ménage</dt>
                    <dd>{MAISON_LISTING.cleaning}&nbsp;€</dd>
                  </div>
                  <div className="listing-total">
                    <dt>Séjour de {MAISON_LISTING.minimumNights} nuits</dt>
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

        {/* ------------------------------------------------- pièce par pièce --- */}
        <section className="sec sec-alt">
          <div className="wrap">
            <Reveal className="sec-head">
              <h2>Pièce par pièce</h2>
              <p>
                Chaque surface est calculée sur le polygone de la pièce, pas recopiée d’une annonce.
                C’est ce que change un relevé : le voyageur peut vérifier ce qu’il lit, et il vérifie.
              </p>
            </Reveal>

            <Reveal className="demo-rooms">
              {rooms.map((room) => (
                <article className="demo-room" key={room.id}>
                  <h3>{room.name}</h3>
                  <p className="demo-area">{area(roomArea(room))}</p>
                  <p>{MAISON_CAPTIONS[room.id]?.text}</p>
                </article>
              ))}
            </Reveal>
          </div>
        </section>

        {/* -------------------------------------------------- ce qu’il y a --- */}
        <section className="sec">
          <div className="wrap">
            <Reveal className="sec-head">
              <h2>Ce que contient la maison</h2>
              <p>
                La liste qu’un voyageur parcourt en diagonale avant de réserver. Avec la visite
                au-dessus, elle cesse d’être une liste de promesses : chaque ligne se vérifie d’un
                coup d’œil dans le volume.
              </p>
            </Reveal>

            <Reveal className="kit-grid">
              {MAISON_LISTING.equipment.map((group) => (
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
                {MAISON_LISTING.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------ visite libre --- */}
        <section className="sec sec-alt">
          <div className="wrap">
            <Reveal className="sec-head">
              <p className="kicker">Et si le voyageur veut vérifier lui-même</p>
              <h2>La même maison, mais c’est lui qui conduit</h2>
              <p>
                Glissez pour regarder autour de vous, avancez pour changer de pièce. C’est le second
                lien qu’un propriétaire reçoit, et celui que ses voyageurs ouvrent quand ils veulent
                voir un angle que la visite guidée n’a pas montré.
              </p>
            </Reveal>

            <FreeTour
              rooms={MAISON_ROOMS}
              doors={MAISON_DOORS}
              massing={MAISON_MASSING}
              startRoomId="sejour"
            />

            <p className="demo-mention">{MAISON_IDENTITY.disclaimer}</p>
          </div>
        </section>

        <section className="cta-band">
          <div className="wrap">
            <div className="cta-grid">
              <div>
                <p className="kicker">Et chez vous</p>
                <h2>La même page, avec vos murs</h2>
                <p>
                  On relève votre logement sur place en une vingtaine de minutes, et vous recevez les
                  deux liens : la visite guidée et la visite libre. {PRICE_PER_LISTING} par logement,
                  payé une fois, sans abonnement — ça, c’est le vrai prix, et il n’a rien à voir avec
                  les 149 € par nuit de l’annonce ci-dessus.
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
