'use client';

import { useMemo, useState } from 'react';
import { PRICE_PER_LISTING } from '@/lib/content';
import { qrDataUri } from '@/lib/qrcode';

/**
 * La fiche qu'on laisse au propriétaire après lui avoir montré une visite.
 *
 * Un rendez-vous de démarchage dure dix minutes et se termine par « je vais y
 * réfléchir ». Ce qui reste sur la table décide de la suite. Une feuille avec
 * un QR vers une vraie visite vaut mieux qu'une carte : le propriétaire la
 * montre à son associé le soir même, et la visite parle à sa place.
 *
 * La feuille se prépare à l'écran et s'imprime en A4. Tout est calculé dans le
 * navigateur — le QR compris — donc rien à enregistrer, et on peut changer un
 * nom entre deux rendez-vous sans rien recharger.
 */
export function PitchSheet({ defaultLink, contactEmail }: { defaultLink: string; contactEmail: string }) {
  const [ownerName, setOwnerName] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [link, setLink] = useState(defaultLink);
  /* Le prix par défaut est celui du site, pas un nombre écrit ici.
     Il valait cent quatre-vingt-dix quand la page d'accueil en annonçait
     quatre-vingt-neuf : le propriétaire à qui l'on tend la feuille est
     précisément celui qui ira voir le site le soir même. Il reste modifiable —
     une tournée de conciergerie ne se démarche pas au tarif d'un particulier —
     mais on ne part plus d'un chiffre que rien ne relie au reste. */
  const [price, setPrice] = useState(PRICE_PER_LISTING);
  const [note, setNote] = useState('');

  const trimmed = link.trim();
  const qr = useMemo(() => {
    if (!trimmed) return '';
    try {
      // Correction haute : la feuille voyage dans une sacoche, se plie, se tache.
      return qrDataUri(trimmed, { ec: 'H', size: 460, label: 'Visite virtuelle' });
    } catch {
      return '';
    }
  }, [trimmed]);

  return (
    <>
      <section className="card no-print">
        <h2 className="pro-card-title">
          Préparer la fiche <small>elle s’imprime en une page A4</small>
        </h2>

        <div className="form-grid">
          <div className="form-row">
            <div className="field">
              <label htmlFor="pitch-owner">Nom du propriétaire</label>
              <input
                id="pitch-owner"
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                placeholder="Marc Vidal"
                maxLength={60}
              />
              <p className="hint">Laissez vide pour une fiche générique, à distribuer en nombre.</p>
            </div>
            <div className="field">
              <label htmlFor="pitch-property">Le logement</label>
              <input
                id="pitch-property"
                value={propertyName}
                onChange={(event) => setPropertyName(event.target.value)}
                placeholder="Studio République"
                maxLength={80}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="pitch-link">Lien à faire scanner</label>
            <input
              id="pitch-link"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://volume3d.fr"
            />
            <p className="hint">
              L’aperçu de son propre logement s’il en existe un, sinon la démonstration de la page
              d’accueil. C’est ce que le QR ouvrira.
            </p>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="pitch-price">Prix annoncé</label>
              <input
                id="pitch-price"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                maxLength={40}
              />
            </div>
            <div className="field">
              <label htmlFor="pitch-note">Mot personnel</label>
              <input
                id="pitch-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Je repasse jeudi matin."
                maxLength={110}
              />
            </div>
          </div>

          <div className="row">
            <button className="btn btn-accent btn-sm" type="button" onClick={() => window.print()}>
              Imprimer la fiche
            </button>
            <span className="tiny">
              Dans la boîte d’impression, décochez les en-têtes et pieds de page du navigateur.
            </span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ la feuille */}

      <div className="sheet-wrap">
        <article className="sheet" aria-label="Fiche à imprimer">
          <header className="sheet-head">
            <div className="sheet-brand">
              Volume<span>3D</span>
            </div>
            <div className="sheet-kicker">Visites virtuelles · France entière</div>
          </header>

          <h1 className="sheet-title">
            {ownerName ? `${ownerName}, vos` : 'Vos'} voyageurs visitent
            <br />
            {propertyName || 'le logement'} avant de réserver.
          </h1>

          <div className="sheet-body">
            <div className="sheet-text">
              <p className="sheet-lead">
                On vient scanner sur place. Vous recevez un lien à envoyer à vos voyageurs : ils
                parcourent chaque pièce, se projettent, et réservent sans vous poser dix questions.
              </p>

              <ul className="sheet-points">
                <li>
                  <strong>20 minutes sur place.</strong> Une prise de vue par pièce, vous n’avez rien à
                  préparer.
                </li>
                <li>
                  <strong>Le lien sous 48 heures.</strong> À mettre dans la messagerie Airbnb, sur
                  Booking, sur votre site, ou en QR dans le logement.
                </li>
                <li>
                  <strong>Payé une fois.</strong> Pas d’abonnement, pas de reconduction. Le lien reste
                  actif.
                </li>
                <li>
                  <strong>Vous voyez ce qu’on vous demande.</strong> Les questions posées par vos
                  voyageurs remontent dans votre espace : elles disent ce que votre annonce n’explique
                  pas.
                </li>
              </ul>

              <p className="sheet-price">
                <span>{price}</span> pour un logement complet, plan et retouches compris.
              </p>
            </div>

            <aside className="sheet-qr">
              {qr ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="QR code vers une visite virtuelle" />
                  <p>
                    <strong>Regardez maintenant.</strong>
                    <br />
                    Ouvrez l’appareil photo de votre téléphone et visez ce carré.
                  </p>
                </>
              ) : (
                <p className="sheet-qr-empty">Renseignez un lien valide pour obtenir le QR.</p>
              )}
            </aside>
          </div>

          <footer className="sheet-foot">
            {note && <p className="sheet-note">{note}</p>}
            <p className="sheet-contact">
              <strong>{contactEmail}</strong> · volume3d.fr
            </p>
          </footer>
        </article>
      </div>
    </>
  );
}
