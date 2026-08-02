import { ContactForm } from '@/components/ContactForm';
import { HeroStage } from '@/components/HeroStage';
import { LogoMark } from '@/components/Logo';
import { Counter } from '@/components/landing/Counter';
import { Reveal } from '@/components/landing/Reveal';
import { SiteChrome } from '@/components/landing/SiteChrome';
import {
  AGENCY_FEATURES,
  CONTACT_EMAIL,
  FAQ,
  HERO,
  MANIFESTO,
  OWNER_FEATURES,
  PRICE_PER_LISTING,
  STEPS,
  VALUE_PROPS,
} from '@/lib/content';
import { getStore } from '@/lib/store';
import './landing.css';

export const dynamic = 'force-dynamic';

/**
 * Panorama du héros.
 *
 * On prend la première pièce d'un logement publié : le visiteur manipule donc
 * une vraie visite dès la première seconde. Sans logement en ligne, le héros
 * dessine sa propre scène (voir `HeroStage`) plutôt que d'afficher un placeholder.
 */
async function heroPanorama(): Promise<string | undefined> {
  try {
    const store = getStore();
    const slug = process.env.NEXT_PUBLIC_FEATURED_SLUG;
    const published = await store.list('properties', { status: 'published' });
    const property = published.find((item) => item.slug === slug) ?? published[0];
    if (!property) return undefined;

    const scenes = await store.list('scenes', { propertyId: property.id });
    if (scenes.length === 0) return undefined;
    return [...scenes].sort((a, b) => a.position - b.position)[0].imageUrl;
  } catch {
    // La page d'accueil doit rester en ligne même si la base est injoignable.
    return undefined;
  }
}

export default async function HomePage() {
  const panorama = await heroPanorama();

  return (
    <div className="landing">
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

      <SiteChrome />

      <main id="contenu">
        {/* ---------------------------------------------------------- héros --- */}
        <section className="hero" id="accueil">
          <HeroStage imageUrl={panorama} />

          <div className="hero-inner">
            <p className="kicker">{HERO.eyebrow}</p>

            <h1>
              {HERO.lines.map((line, index) => (
                <span
                  className="hero-line"
                  key={line}
                  style={{ '--line-delay': `${120 + index * 120}ms` } as React.CSSProperties}
                >
                  <span>{index === HERO.accentLine ? <em>{line}</em> : line}</span>
                </span>
              ))}
            </h1>

            <p className="hero-sub">{HERO.lede}</p>

            <div className="hero-actions">
              <a className="cta cta-light" href="#contact">
                Réserver un scan
              </a>
              <a className="quiet-link" href="#seuil">
                Voir la différence <i aria-hidden="true">→</i>
              </a>
            </div>
          </div>

          <dl className="hero-rail">
            {HERO.stats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>
                  <Counter value={stat.value} suffix={stat.suffix} />
                </dd>
              </div>
            ))}
            <p className="hero-hint">
              <span>Faites glisser l’image</span>
            </p>
          </dl>
        </section>

        {/* ------------------------------------------------------ manifeste --- */}
        <section className="manifesto">
          <Reveal className="manifesto-inner">
            <p>
              {MANIFESTO.before}
              <em>{MANIFESTO.accent}</em>
              {MANIFESTO.after}
            </p>
            <p className="manifesto-sign">{MANIFESTO.sign}</p>
          </Reveal>
        </section>

        {/* --------------------------------------------------- avant / après --- */}
        <section className="chapter chapter-dark" id="seuil">
          <div className="chapter-inner">
            <Reveal className="chapter-head">
              <p className="kicker">Le seuil</p>
              <h2 className="display">
                Vingt photos ne font pas <em>une pièce</em>.
              </h2>
              <p className="lead">
                Une galerie se feuillette. Une visite se traverse : on tourne la tête, on passe une
                porte, on mesure la hauteur sous plafond. C’est là que le doute tombe.
              </p>
            </Reveal>

            <div className="compare">
              <Reveal>
                <div className="plate plate-flat" aria-hidden="true">
                  {/* Une mosaïque de vignettes muettes : c'est exactement ce que
                      le voyageur reçoit aujourd'hui, et rien de plus. */}
                  <div className="plate-tiles">
                    {Array.from({ length: 6 }, (_, index) => (
                      <span key={index} />
                    ))}
                  </div>
                </div>
                <div className="plate-caption">
                  <div>
                    <h3>Une annonce ordinaire</h3>
                    <p>
                      Des photos cadrées au grand-angle, dans un ordre qu’on subit. Le voyageur
                      reconstruit le logement dans sa tête — et se trompe.
                    </p>
                  </div>
                  <span className="plate-tag">Avant</span>
                </div>
              </Reveal>

              <Reveal delay={140}>
                <div className="plate plate-deep">
                  <div className="plate-arch" aria-hidden="true">
                    <svg viewBox="0 0 120 170" role="presentation">
                      <path
                        className="arch-open"
                        d="M14 170V64a46 46 0 0 1 92 0v106Z"
                      />
                      <path
                        className="arch-frame"
                        d="M2 170V64a58 58 0 0 1 116 0v106"
                      />
                    </svg>
                  </div>
                </div>
                <div className="plate-caption">
                  <div>
                    <h3>La même annonce, avec la visite</h3>
                    <p>
                      Un lien, et le voyageur est dedans. Il circule d’une pièce à l’autre, à son
                      rythme, sur son téléphone, sans rien installer.
                    </p>
                  </div>
                  <span className="plate-tag">Après</span>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- méthode --- */}
        <section className="chapter" id="methode">
          <div className="chapter-inner">
            <Reveal className="chapter-head">
              <p className="kicker">La méthode</p>
              <h2 className="display">Trois étapes. Une seule de votre côté.</h2>
              <p className="lead">
                Vous n’achetez pas de matériel, vous n’installez rien, vous ne manipulez aucun
                logiciel. Vous ouvrez la porte, on s’occupe du reste.
              </p>
            </Reveal>

            <ol className="steps">
              {STEPS.map((step, index) => (
                <Reveal as="li" className="step" key={step.n} delay={index * 90}>
                  <span className="step-n">{step.n}</span>
                  <div className="step-body">
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* --------------------------------------------------------- valeurs --- */}
        <section className="chapter chapter-dark">
          <div className="chapter-inner">
            <Reveal className="chapter-head">
              <p className="kicker">Ce que ça change</p>
              <h2 className="display">L’effet se voit sur l’annonce.</h2>
            </Reveal>

            <div className="values">
              {VALUE_PROPS.map((prop, index) => (
                <Reveal as="article" className="value" key={prop.title} delay={index * 80}>
                  <p className="value-index">{String(index + 1).padStart(2, '0')}</p>
                  <h3>{prop.title}</h3>
                  <p>{prop.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- tarifs --- */}
        <section className="chapter" id="tarifs">
          <div className="chapter-inner">
            <Reveal className="chapter-head is-centered">
              <p className="kicker">Tarifs</p>
              <h2 className="display">Payé une fois. En ligne pour toujours.</h2>
              <p className="lead">
                Pas d’abonnement caché, pas de frais d’hébergement. Le lien reste actif tant que le
                logement est le vôtre.
              </p>
            </Reveal>

            <div className="offers">
              <Reveal as="article" className="offer">
                <p className="offer-name">Propriétaire</p>
                <p className="offer-price">
                  <strong>{PRICE_PER_LISTING}</strong>
                  <span>par logement</span>
                </p>
                <ul>
                  {OWNER_FEATURES.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <a className="cta" href="#contact">
                  Réserver ma visite
                </a>
              </Reveal>

              <Reveal as="article" className="offer offer-dark" delay={120}>
                <span className="offer-flag">Conciergeries</span>
                <p className="offer-name">Volume & abonnement</p>
                <p className="offer-price">
                  <strong>Sur devis</strong>
                </p>
                <ul>
                  {AGENCY_FEATURES.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <a className="cta cta-light" href="#contact">
                  Demander un devis
                </a>
              </Reveal>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- questions --- */}
        <section className="chapter" id="questions">
          <div className="chapter-inner">
            <Reveal className="chapter-head is-centered">
              <p className="kicker">Questions</p>
              <h2 className="display">Ce qu’on nous demande le plus.</h2>
            </Reveal>

            <div className="faq-list">
              {FAQ.map((item) => (
                <details className="faq-row" key={item.q}>
                  <summary>
                    {item.q}
                    <span className="sign" aria-hidden="true" />
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- contact --- */}
        <section className="contact" id="contact">
          <div className="contact-inner">
            <Reveal>
              <p className="kicker">Prendre rendez-vous</p>
              <h2>
                Ouvrons la porte de <em>votre logement</em>.
              </h2>
              <p className="lead">
                Réponse sous 24 h, créneau de scan dans la semaine. Dites-nous simplement où se
                trouve le logement.
              </p>
            </Reveal>
            <Reveal className="contact-form" delay={120}>
              <ContactForm />
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="site-foot">
        <div className="site-foot-inner">
          <span className="brand">
            <LogoMark size={22} adaptive />
            <span className="mark-name">
              Volume<i>3D</i>
            </span>
          </span>
          <span>
            France entière · <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </span>
          <span>
            <a href="/espace">Espace client</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
