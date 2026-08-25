import type { Metadata } from 'next';
import { Apparition } from '@/components/premium/Apparition';
import { BarreResidence } from '@/components/premium/BarreResidence';
import { Edifice } from '@/components/premium/Edifice';
import { Mots } from '@/components/premium/Mots';
import { CONTACT_EMAIL } from '@/lib/content';
import { APPEL, ARCHITECTURE, GALERIE, NIVEAUX, PRESENTATION, PROJET, chiffres } from '@/lib/residence';
import './residence.css';

/**
 * ORIEL — la page.
 *
 * Six sections au-dessus d'une seule scène. Le bâtiment est **fixe**, en fond
 * de fenêtre ; ce sont les sections qui défilent par-dessus, et la caméra qui
 * change de plan à mesure. C'est le contraire de ce qu'on fait d'habitude —
 * une scène par section, montée et démontée — et c'est ce qui donne la
 * sensation de continuité : on ne visite pas six images du projet, on tourne
 * une fois autour d'un bâtiment pendant qu'on lit.
 *
 * Chaque section porte son propre voile. C'est le seul réglage de lisibilité
 * de la page, et il est local par nécessité : le texte de la présentation a
 * besoin d'un fond presque opaque, la galerie a besoin qu'il n'y en ait pas.
 * Un voile global aurait été trop sombre pour la galerie et trop clair pour le
 * texte.
 *
 * Ce que la page ne fait pas, et pourquoi :
 *
 *  · **pas de photographies.** Le brief demandait des images d'architecture
 *    haut de gamme ; il n'y a pas ici de source sous licence, et le produit
 *    vend précisément la reconstitution d'un volume. Illustrer une page
 *    Volume3D avec la photo d'un bâtiment de quelqu'un d'autre serait à la
 *    fois faux et contre-productif. La galerie montre donc le bâtiment de la
 *    page, sous trois angles — ce que le brief appelle lui-même « transitions
 *    entre différentes vues du bâtiment » ;
 *  · **pas de particules.** Une poussière flottante posée sur une façade au
 *    soleil est exactement le gadget contre lequel le brief met en garde ;
 *  · **pas de défilement détourné.** La page défile normalement, on ne fait
 *    que lire où elle en est.
 */

export const metadata: Metadata = {
  title: `${PROJET.nom} — Architecture that defines the future`,
  description:
    'A twelve-storey residence of concrete and glass, modelled and rendered live in the browser by Volume3D.',
  robots: { index: false, follow: true },
};

export default function ResidencePage() {
  const nombres = chiffres();

  return (
    <div className="rz" id="top">
      <a className="skip-link" href="#project">
        Aller au contenu
      </a>

      {/* Le bâtiment, en fond de fenêtre. Il ne défile pas : il tourne. */}
      <div className="rz-fond" aria-hidden={undefined}>
        <Edifice nom={PROJET.nom} />
      </div>

      <BarreResidence />

      <main className="rz-flux">
        {/* ------------------------------------------------------ 1. hero --- */}
        <section className="rz-section rz-hero">
          <div className="rz-bande">
            <Apparition facon="fond" delai={620} className="rz-etiquette">
              <span className="rz-pastille" aria-hidden="true" />
              {PROJET.nom} — {PROJET.lieu}
            </Apparition>

            <Mots as="h1" className="rz-titre" lignes={PROJET.titre} delai={900} />

            <Apparition as="p" facon="monte" delai={1700} className="rz-chapo">
              {PROJET.chapo}
            </Apparition>

            <Apparition facon="monte" delai={2050}>
              <a className="rz-bouton" href="#project">
                {PROJET.action} <span aria-hidden="true">→</span>
              </a>
            </Apparition>
          </div>

          <Apparition facon="fond" delai={2400} className="rz-cue">
            <span className="rz-cue-trait" aria-hidden="true" />
            Scroll
          </Apparition>
        </section>

        {/* ------------------------------------------ 2. présentation --- */}
        <section className="rz-section rz-projet" id="project">
          <div className="rz-bande rz-deux">
            <div className="rz-colonne">
              <Apparition facon="filet" className="rz-surtitre">
                {PRESENTATION.surtitre}
              </Apparition>
              <Mots as="h2" className="rz-h2" lignes={PRESENTATION.titre} />
            </div>

            <div className="rz-colonne rz-texte">
              {PRESENTATION.paragraphes.map((paragraphe, i) => (
                <Apparition as="p" key={i} facon="monte" delai={i * 160} className="rz-p">
                  {paragraphe}
                </Apparition>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------- 3. architecture --- */}
        <section className="rz-section rz-architecture" id="architecture">
          <div className="rz-bande">
            <Apparition facon="filet" className="rz-surtitre">
              {ARCHITECTURE.surtitre}
            </Apparition>
            <Mots as="h2" className="rz-h2" lignes={ARCHITECTURE.titre} />

            <ul className="rz-traits">
              {ARCHITECTURE.traits.map((trait, i) => (
                <Apparition as="li" key={trait.numero} facon="monte" delai={i * 140} className="rz-trait">
                  <span className="rz-numero">{trait.numero}</span>
                  <h3 className="rz-h3">{trait.titre}</h3>
                  <p className="rz-p rz-p-petit">{trait.texte}</p>
                </Apparition>
              ))}
            </ul>
          </div>
        </section>

        {/* -------------------------------------------------- 4. galerie --- */}
        <section className="rz-galerie" id="gallery" aria-label="Gallery">
          {GALERIE.vues.map((vue, i) => (
            <div className="rz-plan" key={vue.titre}>
              <Apparition facon="net" className="rz-plaque">
                <span className="rz-plaque-rang">
                  {String(i + 1).padStart(2, '0')} / {String(GALERIE.vues.length).padStart(2, '0')}
                </span>
                <h3 className="rz-h3">{vue.titre}</h3>
                <p className="rz-p rz-p-petit">{vue.texte}</p>
              </Apparition>
            </div>
          ))}
        </section>

        {/* --------------------------------------------------- 5. chiffres --- */}
        <section className="rz-section rz-chiffres" id="about">
          <div className="rz-bande">
            <Apparition facon="filet" className="rz-surtitre">
              About the project
            </Apparition>

            <dl className="rz-tableau">
              {nombres.map((chiffre, i) => (
                <Apparition as="div" key={chiffre.libelle} facon="net" delai={i * 180} parallaxe={0.03} className="rz-case">
                  <dt className="rz-valeur">{chiffre.valeur}</dt>
                  <dd className="rz-libelle">
                    {chiffre.libelle}
                    <span className="rz-precision">{chiffre.precision}</span>
                  </dd>
                </Apparition>
              ))}
            </dl>

            <Apparition as="p" facon="monte" delai={220} className="rz-note">
              Every figure above is measured on the geometry you are looking at — {NIVEAUX} floors of it —
              not written into the page.
            </Apparition>
          </div>
        </section>

        {/* --------------------------------------------------- 6. appel --- */}
        <section className="rz-section rz-appel" id="contact">
          <div className="rz-bande rz-centre">
            <Apparition facon="filet" className="rz-surtitre">
              {APPEL.surtitre}
            </Apparition>

            <Mots as="h2" className="rz-titre rz-titre-fin" lignes={APPEL.titre} />

            <Apparition as="p" facon="monte" delai={260} className="rz-chapo">
              {APPEL.texte}
            </Apparition>

            <Apparition facon="monte" delai={420}>
              <a className="rz-bouton" href={`mailto:${CONTACT_EMAIL}`}>
                {APPEL.action} <span aria-hidden="true">→</span>
              </a>
            </Apparition>
          </div>
        </section>
      </main>

      <footer className="rz-pied">
        <div className="rz-bande rz-pied-rang">
          <p>
            {PROJET.nom} est un projet fictif, modélisé et rendu en direct dans votre navigateur par
            Volume3D. Aucune photographie n’a été utilisée.
          </p>
          <a href="/">Volume3D →</a>
        </div>
      </footer>
    </div>
  );
}
