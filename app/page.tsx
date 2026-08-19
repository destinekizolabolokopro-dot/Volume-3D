import { BookingForm } from '@/components/BookingForm';
import { LogoMark } from '@/components/Logo';
import { EntranceTour } from '@/components/landing/EntranceTour';
import { Reveal } from '@/components/landing/Reveal';
import { SiteNav } from '@/components/landing/SiteNav';
import { IconCheck, IconDot, RESULT_ICONS } from '@/components/landing/icons';
import { bookedSlots, offeredDays } from '@/lib/booking';
import { area } from '@/lib/journey-path';
import { totalArea } from '@/lib/plan';
import {
  AGENCY_FEATURES,
  COMPARE,
  CONTACT_EMAIL,
  FAQ,
  OWNER_FEATURES,
  PRICE_PER_LISTING,
  RESULTS,
  STEPS,
} from '@/lib/content';
import {
  SHOWCASE_CAPTIONS,
  SHOWCASE_CLOSING,
  SHOWCASE_DOORS,
  SHOWCASE_IDENTITY,
  SHOWCASE_MASSING,
  SHOWCASE_OPENING,
  SHOWCASE_ROOMS,
} from '@/lib/showcase';
import { getStore } from '@/lib/store';
import './landing.css';

/* Les créneaux dépendent de l'heure et de ce qui est déjà pris : cette page ne
   peut pas être figée à la compilation. */
export const dynamic = 'force-dynamic';

/**
 * L'accueil.
 *
 * Un seul site, et il commence par la visite. Le visiteur n'arrive pas sur un
 * argumentaire qui décrit le produit : il arrive **dedans**, il fait défiler,
 * la porte s'ouvre, il traverse le logement, et les mesures apparaissent au fur
 * et à mesure. Le discours vient après, quand il sait déjà de quoi on parle.
 *
 * Le reste de la page suit l'ordre d'une conversation de démarchage : ce qu'il
 * vient de voir, ce que ça change chez lui, comment ça se passe, combien, et
 * enfin le rendez-vous. Rien n'est en dessous du rendez-vous.
 */
export default async function HomePage() {
  const taken = bookedSlots(await getStore().list('appointments'));
  const days = offeredDays(new Date(), taken);

  return (
    <div className="lp" id="haut">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ProfessionalService',
            name: 'Volume3D',
            description:
              'Visites virtuelles 3D pour propriétaires et conciergeries de locations saisonnières.',
            areaServed: { '@type': 'Country', name: 'France' },
            email: CONTACT_EMAIL,
            priceRange: PRICE_PER_LISTING,
            mainEntity: FAQ.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }),
        }}
      />

      <SiteNav darkUntil="#visite" />

      <main id="contenu">
        {/* ---------------------------------------------------------- entrée --- */}
        <div id="visite">
          <EntranceTour
            rooms={SHOWCASE_ROOMS}
            doors={SHOWCASE_DOORS}
            massing={SHOWCASE_MASSING}
            opening={SHOWCASE_OPENING}
            captions={SHOWCASE_CAPTIONS}
            closing={SHOWCASE_CLOSING}
            skipTo="#apres"
            disclaimer={SHOWCASE_IDENTITY.disclaimer}
          />
        </div>

        {/* ------------------------------------------- ce qu’on vient de voir --- */}
        <section className="sec" id="apres">
          <div className="wrap">
            <Reveal className="sec-head">
              <p className="kicker">Ce que vous venez de faire</p>
              <h2>Vous avez visité un logement sans y être allé</h2>
              <p>
                Vous n’avez rien installé, rien ouvert, rien cliqué. Vous avez fait défiler une page. Vos
                voyageurs feront exactement la même chose, depuis leur téléphone, avant de réserver — et
                ils sauront à quoi ressemblent vos {area(totalArea(SHOWCASE_ROOMS))} avant de vous
                écrire.
              </p>
            </Reveal>

            <Reveal className="after-grid">
              <article className="after-card">
                <h3>La visite guidée</h3>
                <p>
                  Celle que vous venez de voir. Elle raconte le logement dans un ordre choisi, avec les
                  mesures aux bons endroits. C’est ce qu’on met en tête d’annonce.
                </p>
                <p className="after-note">Vous y êtes.</p>
              </article>

              <article className="after-card after-card-lead">
                <h3>La visite libre</h3>
                <p>
                  La même géométrie, mais c’est le voyageur qui conduit : il tourne la tête, il avance, il
                  passe d’une pièce à l’autre à son rythme. C’est le lien que vous lui envoyez.
                </p>
                <a className="btn btn-accent" href="/demonstration">
                  Essayer la visite libre
                </a>
              </article>

              <article className="after-card">
                <h3>Et chez vous&nbsp;?</h3>
                <p>
                  On relève votre logement sur place en une vingtaine de minutes. Le volume vient de vos
                  murs, pas d’un modèle générique : les distances sont les vôtres.
                </p>
                <a className="after-link" href="#rendez-vous">
                  Prendre trente minutes pour en parler →
                </a>
              </article>
            </Reveal>

            <p className="after-mention">{SHOWCASE_IDENTITY.disclaimer}</p>
          </div>
        </section>

        {/* -------------------------------------------------------- résultats --- */}
        <section className="sec sec-alt" id="resultats">
          <div className="wrap">
            <Reveal className="sec-head">
              <p className="kicker">Ce que ça change pour vous</p>
              <h2>Moins de questions, plus de réservations</h2>
              <p>
                Une visite ne rend pas le logement plus beau : elle enlève le doute. C’est le doute qui
                fait hésiter, écrire, comparer — et parfois annuler.
              </p>
            </Reveal>

            <div className="cards">
              {RESULTS.map((result, index) => {
                const Icon = RESULT_ICONS[result.icon];
                return (
                  <Reveal as="article" className="card" key={result.title} delay={index * 60}>
                    <span className="card-icon">
                      <Icon />
                    </span>
                    <h3>{result.title}</h3>
                    <p>{result.desc}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- avant / après --- */}
        <section className="sec">
          <div className="wrap">
            <Reveal className="sec-head center">
              <p className="kicker">Comparaison</p>
              <h2>Le même logement, vu de deux façons</h2>
            </Reveal>

            <Reveal className="compare">
              <div className="compare-col">
                <h3>{COMPARE.before.title}</h3>
                <ul>
                  {COMPARE.before.items.map((item) => (
                    <li key={item}>
                      <IconDot />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="compare-col" data-good="1">
                <h3>{COMPARE.after.title}</h3>
                <ul>
                  {COMPARE.after.items.map((item) => (
                    <li key={item}>
                      <IconCheck />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ----------------------------------------------------- fonctionnement --- */}
        <section className="sec sec-alt" id="fonctionnement">
          <div className="wrap">
            <Reveal className="sec-head">
              <p className="kicker">Comment ça se passe</p>
              <h2>Trois étapes, une seule de votre côté</h2>
              <p>
                Vous n’achetez pas de matériel, vous n’installez rien, vous ne manipulez aucun logiciel.
                Vous ouvrez la porte, on s’occupe du reste.
              </p>
            </Reveal>

            <ol className="steps">
              {STEPS.map((step, index) => (
                <Reveal as="li" className="step" key={step.n} delay={index * 70}>
                  <span className="step-n">Étape {step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------------ tarifs --- */}
        <section className="sec" id="tarifs">
          <div className="wrap">
            <Reveal className="sec-head center">
              <p className="kicker">Tarifs</p>
              <h2>Payé une fois. Le lien reste en ligne.</h2>
              <p>Pas d’abonnement, pas de frais d’hébergement, pas d’engagement.</p>
            </Reveal>

            <div className="plans">
              <Reveal as="article" className="plan">
                <div className="plan-top">
                  <h3 className="plan-name">Un logement</h3>
                  <span className="plan-flag">Le plus demandé</span>
                </div>
                <p className="plan-price">
                  <strong>{PRICE_PER_LISTING}</strong>
                  <span>par logement, une fois</span>
                </p>
                <p>Pour un propriétaire qui loue un ou deux biens.</p>
                <ul>
                  {OWNER_FEATURES.map((feature) => (
                    <li key={feature}>
                      <IconCheck />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a className="btn btn-accent btn-block" href="#rendez-vous">
                  Prendre rendez-vous
                </a>
              </Reveal>

              <Reveal as="article" className="plan" delay={80}>
                <div className="plan-top">
                  <h3 className="plan-name">Plusieurs logements</h3>
                </div>
                <p className="plan-price">
                  <strong>Sur devis</strong>
                </p>
                <p>Pour les conciergeries et les propriétaires multi-biens.</p>
                <ul>
                  {AGENCY_FEATURES.map((feature) => (
                    <li key={feature}>
                      <IconCheck />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a className="btn btn-ghost btn-block" href="#rendez-vous">
                  En parler trente minutes
                </a>
              </Reveal>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- questions --- */}
        <section className="sec sec-alt">
          <div className="wrap">
            <Reveal className="sec-head center">
              <p className="kicker">Questions fréquentes</p>
              <h2>Ce qu’on nous demande le plus</h2>
            </Reveal>

            <div className="faq">
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>
                    {item.q}
                    <i aria-hidden="true" />
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ prise de RDV --- */}
        <section className="cta-band" id="rendez-vous">
          <div className="wrap">
            <div className="cta-grid">
              <div>
                <p className="kicker">Rendez-vous</p>
                <h2>Trente minutes, et vous saurez si ça vaut le coup</h2>
                <p>
                  Choisissez un créneau, laissez un numéro. Je vous appelle à l’heure dite, on regarde
                  votre logement ensemble et je vous dis franchement ce que ça donnerait. Si ce n’est pas
                  pour vous, je vous le dirai aussi.
                </p>
                <ul className="cta-list">
                  <li>
                    <IconCheck />
                    Trente minutes, sans engagement et sans paiement
                  </li>
                  <li>
                    <IconCheck />
                    Par téléphone ou en visio, comme vous préférez
                  </li>
                  <li>
                    <IconCheck />
                    Vos coordonnées servent à ce rendez-vous, à rien d’autre
                  </li>
                </ul>
              </div>

              <div className="cta-card">
                <BookingForm days={days} />
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
