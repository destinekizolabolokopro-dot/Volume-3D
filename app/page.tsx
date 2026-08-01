import { ContactForm } from '@/components/ContactForm';
import { Logo, LogoMark } from '@/components/Logo';
import { PanoViewer } from '@/components/PanoViewer';
import {
  AGENCY_FEATURES,
  FAQ,
  CONTACT_EMAIL,
  HERO,
  OWNER_FEATURES,
  PRICE_PER_LISTING,
  STEPS,
  VALUE_PROPS,
} from '@/lib/content';
import { loadTour } from '@/lib/queries';
import { getStore } from '@/lib/store';
import type { Hotspot, Property, Scene } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Récupère la visite mise en avant dans la section « Avant / Après ».
 * Tant qu'aucun logement n'est publié, la section retombe sur le visuel
 * de substitution du prototype.
 */
async function featuredTour(): Promise<Property | null> {
  try {
    const slug = process.env.NEXT_PUBLIC_FEATURED_SLUG;
    const published = await getStore().list('properties', { status: 'published' });
    if (published.length === 0) return null;
    return published.find((property) => property.slug === slug) ?? published[0];
  } catch {
    // La landing doit rester en ligne même si la base est injoignable.
    return null;
  }
}

export default async function HomePage() {
  const featured = await featuredTour();

  // La démonstration de la section « Avant / Après » est la vraie visite d'un
  // logement publié : rien ne convainc mieux qu'un visiteur qui la manipule.
  let demo: { scenes: Scene[]; hotspots: Hotspot[] } = { scenes: [], hotspots: [] };
  if (featured) {
    try {
      demo = await loadTour(featured.id);
    } catch {
      demo = { scenes: [], hotspots: [] };
    }
  }
  const hasDemo = demo.scenes.length > 0;

  return (
    <>
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

      <header className="nav">
        <Logo />
        <nav className="nav-links" aria-label="Navigation principale">
          <a className="nav-hide-sm" href="#comment-ca-marche">
            Comment ça marche
          </a>
          <a className="nav-hide-sm" href="#tarifs">
            Tarifs
          </a>
          <a className="nav-hide-sm" href="/espace">
            Mon espace
          </a>
          <a className="btn btn-accent btn-sm" href="#contact">
            Prendre rendez-vous
          </a>
        </nav>
      </header>

      <main id="contenu">
        <section className="hero">
          <div className="hero-blob" aria-hidden="true" />

          <div className="hero-copy">
            <div className="pill">
              <span className="pill-dot" aria-hidden="true" />
              {HERO.eyebrow}
            </div>
            <h1>{HERO.headline}</h1>
            <p className="hero-lede">{HERO.lede}</p>
            <div className="hero-actions">
              <a className="btn btn-dark" href="#contact">
                Prendre rendez-vous →
              </a>
              <a className="link-underline" href="#exemple">
                Voir un exemple de visite
              </a>
            </div>
            <div className="stats">
              {HERO.stats.map((stat) => (
                <div key={stat.label}>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-visual">
            <div className="listing-card">
              <div className="placeholder">
                <span>visite 3d — capture d’écran à intégrer</span>
                <div className="badge-360">
                  <i aria-hidden="true" /> Visite interactive 360°
                </div>
              </div>
              <div className="listing-body">
                <div className="listing-title">Appartement lumineux — Le Marais</div>
                <div className="listing-meta">Paris 3e · 4,97 ★ (128 avis)</div>
              </div>
            </div>
            <div className="callout">
              <strong>+38%</strong>
              de clics sur les annonces avec visite 3D*
            </div>
          </div>
        </section>

        <section id="exemple" className="section section-white">
          <div className="wrap">
            <div className="section-head">
              <div className="eyebrow">Avant / Après</div>
              <h2>La même annonce, un tout autre niveau de confiance</h2>
            </div>

            <div className="two-col">
              <div>
                <div className="compare-label">SANS visite 3D</div>
                <div className="compare-card">
                  <div className="photo-grid">
                    <div className="placeholder placeholder-light">
                      <span>photo salon</span>
                    </div>
                    <div className="photo-stack">
                      <div className="placeholder placeholder-light">
                        <span>photo</span>
                      </div>
                      <div className="placeholder placeholder-light">
                        <span>photo</span>
                      </div>
                    </div>
                  </div>
                  <div className="compare-body">
                    <div className="listing-title">Studio cosy centre-ville</div>
                    <div className="listing-meta">
                      « Est-ce que la chambre est séparée ? » — question reçue 6× ce mois-ci
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="compare-label compare-label-on">AVEC visite 3D</div>
                <div className="compare-card compare-card-on">
                  {hasDemo ? (
                    <div className="live-demo">
                      <PanoViewer scenes={demo.scenes} hotspots={demo.hotspots} showHint={false} />
                      <div className="badge-3d">Essayez : faites glisser</div>
                    </div>
                  ) : (
                    <div className="placeholder" style={{ aspectRatio: '16 / 9' }}>
                      <span>viewer 3d — capture à intégrer</span>
                      <div className="badge-3d">Visite virtuelle 3D</div>
                    </div>
                  )}
                  <div className="compare-body">
                    <div className="listing-title">{featured ? featured.name : 'Studio cosy centre-ville'}</div>
                    <div className="listing-meta">
                      {hasDemo
                        ? 'Voici une vraie visite, telle que la reçoit un voyageur. Faites-la tourner.'
                        : 'Les voyageurs visitent chaque recoin avant de réserver — zéro surprise, zéro question'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="footnote">
              *Ordre de grandeur issu d’études sectorielles sur l’impact des visites virtuelles dans l’immobilier
              locatif — les résultats varient selon le logement et l’annonce.
            </p>
          </div>
        </section>

        <section id="comment-ca-marche" className="section">
          <div className="wrap">
            <div className="section-head">
              <div className="eyebrow">Le déroulé</div>
              <h2>Comment ça marche</h2>
              <p>Aucune contrainte technique de votre côté — on s’occupe de tout, sur place.</p>
            </div>
            <div className="grid-3">
              {STEPS.map((step) => (
                <article className="step-card" key={step.n}>
                  <div className="step-n">{step.n}</div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-dark">
          <div className="wrap">
            <div className="section-head">
              <div className="eyebrow">Pourquoi la 3D</div>
              <h2>Ce que ça change pour votre annonce</h2>
            </div>
            <div className="grid-4">
              {VALUE_PROPS.map((prop) => (
                <article className="value-card" key={prop.letter}>
                  <div className="value-icon" aria-hidden="true">
                    {prop.letter}
                  </div>
                  <h3>{prop.title}</h3>
                  <p>{prop.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="tarifs" className="section">
          <div className="section-head">
            <div className="eyebrow">Tarifs</div>
            <h2>Simple, sans engagement</h2>
            <p>Lancement en France entière — places limitées ce mois-ci.</p>
          </div>
          <div className="pricing">
            <article className="price-card">
              <div className="price-kicker">Propriétaire</div>
              <div className="price-row">
                <span className="price-value">{PRICE_PER_LISTING}</span>
                <span className="price-unit">/ logement</span>
              </div>
              <ul className="price-features">
                {OWNER_FEATURES.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>
              <a className="btn btn-dark btn-block btn-sm" href="#contact">
                Réserver ma visite 3D
              </a>
            </article>

            <article className="price-card price-card-dark">
              <div className="price-badge">Conciergeries</div>
              <div className="price-kicker">Volume / abonnement</div>
              <div className="price-row">
                <span className="price-value">Sur devis</span>
              </div>
              <ul className="price-features">
                {AGENCY_FEATURES.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>
              <a className="btn btn-accent btn-block btn-sm" href="#contact">
                Demander un devis
              </a>
            </article>
          </div>
        </section>

        <section id="questions" className="section section-white">
          <div className="wrap" style={{ maxWidth: 820 }}>
            <div className="section-head">
              <div className="eyebrow">Questions fréquentes</div>
              <h2>Ce qu’on nous demande le plus souvent</h2>
            </div>
            <div className="faq">
              {FAQ.map((item) => (
                <details className="faq-item" key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="section-cta">
          <h2>Prêt à montrer votre logement sous son meilleur jour ?</h2>
          <p>Réponse sous 24h. Première visite 3D livrée cette semaine.</p>
          <ContactForm />
        </section>
      </main>

      <div className="sticky-cta">
        <span>Visite 3D livrée sous 48h</span>
        <a className="btn btn-dark btn-sm" href="#contact">
          Prendre rendez-vous
        </a>
      </div>

      <footer className="footer">
        <div className="brand">
          <LogoMark size={20} />
          <span className="brand-name" style={{ fontSize: 16 }}>
            Volume3D
          </span>
        </div>
        <div>
          France entière · <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </div>
      </footer>
    </>
  );
}
