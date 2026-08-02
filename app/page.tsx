import { ContactForm } from '@/components/ContactForm';
import { LogoMark } from '@/components/Logo';
import { DemoTour } from '@/components/landing/DemoTour';
import { DemoVideo } from '@/components/landing/DemoVideo';
import { Reveal } from '@/components/landing/Reveal';
import { SiteNav } from '@/components/landing/SiteNav';
import { IconCheck, IconDot, RESULT_ICONS } from '@/components/landing/icons';
import {
  AGENCY_FEATURES,
  COMPARE,
  CONTACT_EMAIL,
  FAQ,
  HERO,
  OWNER_FEATURES,
  PRICE_PER_LISTING,
  RESULTS,
  STEPS,
} from '@/lib/content';
import './landing.css';

export default function HomePage() {
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
              'Visites virtuelles 360° pour propriétaires et conciergeries de locations saisonnières.',
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

      <SiteNav />

      <main id="contenu">
        {/* ---------------------------------------------------------- héros --- */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <p className="eyebrow">
                <i aria-hidden="true" />
                {HERO.eyebrow}
              </p>
              <h1>{HERO.headline}</h1>
              <p className="hero-sub">{HERO.lede}</p>

              <div className="hero-actions">
                <a className="btn btn-accent" href="#rendez-vous">
                  Demander un scan
                </a>
                <a className="btn btn-ghost" href="#demonstration">
                  Voir la vidéo
                </a>
              </div>

              <ul className="hero-facts">
                {HERO.facts.map((fact) => (
                  <li key={fact}>
                    <IconCheck />
                    {fact}
                  </li>
                ))}
              </ul>
            </div>

            {/* La démonstration est le premier argument : elle passe avant le
                discours, et c'est le viewer de production, pas une capture. */}
            <div className="frame">
              <div className="frame-bar">
                <span className="frame-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="frame-url">volume3d.fr/v/appartement-republique</span>
              </div>
              <div className="frame-body">
                <DemoTour />
              </div>
              <p className="frame-note">
                <span>
                  <strong>Exemple de visite livrée.</strong> Faites glisser pour regarder autour de vous.
                </span>
                <span>Salon · Chambre · Salle de bain</span>
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- démonstration --- */}
        <section className="sec sec-alt" id="demonstration">
          <div className="wrap">
            <Reveal className="sec-head center">
              <p className="kicker">Démonstration</p>
              <h2>Ce que voit votre voyageur</h2>
              <p>
                Il ouvre le lien, il regarde autour de lui, il passe dans la pièce d’à côté. Aucune
                application à installer, rien à créer de son côté. C’est exactement ce que vous enverrez.
              </p>
            </Reveal>

            <Reveal>
              <DemoVideo src="/demo/visite" poster="/demo/poster.jpg" />
              <p className="video-legend">
                <span>Visite de démonstration · 45 secondes · sans son</span>
                <span>Fonctionne sur téléphone, tablette et ordinateur, sans application</span>
              </p>
            </Reveal>
          </div>
        </section>

        {/* -------------------------------------------------------- résultats --- */}
        <section className="sec" id="resultats">
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
        <section className="sec sec-alt">
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
        <section className="sec" id="fonctionnement">
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
        <section className="sec sec-alt" id="tarifs">
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
                  Demander un scan
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
                  Demander un devis
                </a>
              </Reveal>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- questions --- */}
        <section className="sec">
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
                <h2>Faites scanner votre logement</h2>
                <p>
                  Dites-nous où il se trouve, on vous propose un créneau. Réponse sous 24 h, scan dans la
                  semaine.
                </p>
                <ul className="cta-list">
                  <li>
                    <IconCheck />
                    Aucun engagement, aucun paiement à la demande
                  </li>
                  <li>
                    <IconCheck />
                    On se déplace entre deux séjours si le logement est loué
                  </li>
                  <li>
                    <IconCheck />
                    Vos coordonnées servent uniquement à vous recontacter
                  </li>
                </ul>
              </div>

              <div className="cta-card">
                <ContactForm />
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
