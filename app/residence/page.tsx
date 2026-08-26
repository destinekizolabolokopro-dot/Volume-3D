import type { Metadata } from 'next';
import { Apparition } from '@/components/premium/Apparition';
import { BarreResidence } from '@/components/premium/BarreResidence';
import { Edifice } from '@/components/premium/Edifice';
import { Mots } from '@/components/premium/Mots';
import { CONTACT_EMAIL } from '@/lib/content';
import {
  APPEL,
  BAINS,
  CHAMBRE,
  CUISINE,
  GALERIE,
  PROJET,
  SEJOUR,
  TERRASSE_SECTION,
  chiffres,
  type Fait,
  type Section,
} from '@/lib/residence';
import './residence.css';

/**
 * ORIEL — la page.
 *
 * Neuf écrans au-dessus d'une seule scène, et **une seule visite : celle d'un
 * appartement.** La caméra part de son entrée, traverse le séjour, la cuisine,
 * la chambre, la salle de bains, et sort sur la terrasse. Elle ne quitte le
 * logement qu'au tout dernier écran, pour reculer et montrer l'immeuble qui le
 * porte : neuf plans sur dix sont pris du dedans, et le dixième donne
 * l'adresse.
 *
 * C'est un recentrage, pas une réduction. Volume3D ne vend pas des immeubles :
 * il vend la reconstitution d'un logement, et une démonstration qui fait le
 * tour d'une tour montre surtout ce qu'on ne livre pas.
 *
 * Le texte se tient **au bord du cadre**, et c'est la règle qui gouverne toute
 * la mise en page. La version précédente posait des paragraphes au milieu de
 * l'écran, sur un voile presque opaque : elle informait bien et cachait le
 * bâtiment, ce qui est à peu près le contraire du travail. Ici, chaque section
 * a un titre en haut à gauche et une bande de fiches en bas — trois clés,
 * trois valeurs — et laisse le centre de l'image libre.
 *
 * Ce que la page ne fait pas, et pourquoi :
 *
 *  · **pas de photographies.** Il n'y a pas de source sous licence, et le
 *    produit vend précisément la reconstitution d'un volume. Illustrer une
 *    page Volume3D avec la photo du bâtiment de quelqu'un d'autre serait à la
 *    fois faux et contre-productif ;
 *  · **pas de défilement détourné.** La page défile normalement ; on ne fait
 *    que lire où elle en est.
 */

export const metadata: Metadata = {
  title: `${PROJET.nom} — une résidence qui se mesure`,
  description:
    'Douze niveaux de béton et de verre, modélisés et rendus en direct dans le navigateur par Volume3D.',
  robots: { index: false, follow: true },
};

/** La bande de fiches en pied de section. Trois clés, trois valeurs, un filet. */
function Fiches({ faits, delai = 0 }: { faits: readonly Fait[]; delai?: number }) {
  return (
    <dl className="rz-fiches">
      {faits.map((fait, i) => (
        <Apparition as="div" key={fait.cle} facon="monte" delai={delai + i * 110} className="rz-fiche">
          <dt>{fait.cle}</dt>
          <dd>{fait.valeur}</dd>
        </Apparition>
      ))}
    </dl>
  );
}

/** Le bloc de titre d'une section : surtitre, titre, chapeau. */
function Titre({ section, cote = 'gauche' }: { section: Section; cote?: 'gauche' | 'droite' }) {
  return (
    <div className="rz-titraille" data-cote={cote}>
      <Apparition facon="filet" className="rz-surtitre">
        {section.surtitre}
      </Apparition>
      <Mots as="h2" className="rz-h2" lignes={section.titre} />
      {section.chapeau ? (
        <Apparition as="p" facon="monte" delai={140} className="rz-p">
          {section.chapeau}
        </Apparition>
      ) : null}
    </div>
  );
}

export default function ResidencePage() {
  const nombres = chiffres();

  return (
    <div className="rz" id="top">
      <a className="skip-link" href="#projet">
        Aller au contenu
      </a>

      {/* Le bâtiment, en fond de fenêtre. Il ne défile pas : on y entre. */}
      <div className="rz-fond">
        <Edifice />
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
              <a className="rz-bouton" href="#projet">
                {PROJET.action} <span aria-hidden="true">→</span>
              </a>
            </Apparition>
          </div>

          <Apparition facon="fond" delai={2400} className="rz-cue">
            <span className="rz-cue-trait" aria-hidden="true" />
            Faites défiler
          </Apparition>
        </section>

        {/* --------------------------------------------------- 2. le séjour --- */}
        <section className="rz-section" id="sejour">
          <div className="rz-bande rz-plaque-haute">
            <Titre section={SEJOUR} />
          </div>
          <div className="rz-bande rz-pied-section">
            <Fiches faits={SEJOUR.faits} delai={220} />
          </div>
        </section>

        {/* --------------------------------------------------- 3. la cuisine --- */}
        <section className="rz-section" id="cuisine">
          <div className="rz-bande rz-plaque-haute">
            <Titre section={CUISINE} cote="droite" />
          </div>
          <div className="rz-bande rz-pied-section">
            <Fiches faits={CUISINE.faits} delai={220} />
          </div>
        </section>

        {/* -------------------------------------------------- 4. galerie --- */}
        <section className="rz-galerie" id="galerie" aria-label={GALERIE.surtitre}>
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

        {/* --------------------------------------------------- 5. la chambre --- */}
        <section className="rz-section" id="chambre">
          <div className="rz-bande rz-plaque-haute">
            <Titre section={CHAMBRE} />
          </div>
          <div className="rz-bande rz-pied-section">
            <Fiches faits={CHAMBRE.faits} delai={220} />
          </div>
        </section>

        {/* ------------------------------------------- 6. la salle de bains --- */}
        <section className="rz-section" id="bains">
          <div className="rz-bande rz-plaque-haute">
            <Titre section={BAINS} cote="droite" />
          </div>
          <div className="rz-bande rz-pied-section">
            <Fiches faits={BAINS.faits} delai={220} />
          </div>
        </section>

        {/* ------------------------------------------------- 7. terrasse --- */}
        {/* Elle n'avait pas d'écran à elle : cinquante-deux mètres carrés
            servaient de fond au bloc d'appel. Elle en a un, et la navigation
            y mène enfin. */}
        <section className="rz-section" id="terrasse">
          <div className="rz-bande rz-plaque-haute">
            <Titre section={TERRASSE_SECTION} cote="gauche" />
          </div>
          <div className="rz-bande rz-pied-section">
            <Fiches faits={TERRASSE_SECTION.faits} delai={220} />
          </div>
        </section>

        {/* ----------------------------------------------------- 8. appel --- */}
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

          {/* Les trois chiffres du projet, en bande de pied : c'est le dernier
              écran, donc le bon endroit pour un récapitulatif — et le seul où
              trois grands nombres ne prennent la place de rien. */}
          <div className="rz-bande rz-pied-section">
            <dl className="rz-tableau">
              {nombres.map((chiffre, i) => (
                <Apparition as="div" key={chiffre.libelle} facon="net" delai={i * 150} className="rz-case">
                  <dt className="rz-valeur">{chiffre.valeur}</dt>
                  <dd className="rz-libelle">
                    {chiffre.libelle}
                    <span className="rz-precision">{chiffre.precision}</span>
                  </dd>
                </Apparition>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="rz-pied">
        <div className="rz-bande rz-pied-rang">
          <p>
            {PROJET.nom} est un projet fictif, modélisé et rendu en direct dans votre navigateur par
            Volume3D. Aucune photographie n’a été utilisée. Chaque chiffre est relevé sur la
            géométrie affichée.
          </p>
          <a href="/">Volume3D →</a>
        </div>
      </footer>
    </div>
  );
}
