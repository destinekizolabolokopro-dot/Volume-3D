'use client';

import { useState } from 'react';
import { Sources } from '@/components/Sources';
import { Dictee } from '@/components/Voix';
import type { Reference } from '@/lib/citations';
import { nomDeFichier } from '@/lib/rtf';

/**
 * Décrire sa situation, obtenir le courrier.
 *
 * Le fichier produit est un RTF : Word, Pages et LibreOffice l'ouvrent tous en
 * gardant la mise en page, et surtout il se CORRIGE. Ce qu'on rend ici est un
 * projet — il reste un nom, une adresse, une date à compléter — et un PDF, qui
 * se lit partout et ne se modifie nulle part, serait le mauvais format pour ça.
 *
 * Le téléchargement se fabrique dans le navigateur à partir du texte reçu :
 * rien n'est écrit sur le serveur, et le courrier n'existe donc nulle part
 * après la réponse. Une mise en demeure nomme des gens et raconte une
 * histoire ; il n'y a aucune raison d'en garder copie.
 */

interface Document {
  titre: string;
  objet: string;
  corps: string[];
  aVerifier: string[];
  references: Reference[];
  rtf: string;
  error?: string;
  abonnement?: boolean;
}

export function Redaction({ modele, titre, actif }: { modele: string; titre: string; actif: boolean }) {
  const [situation, setSituation] = useState('');
  const [document, setDocument] = useState<Document | null>(null);
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState('');
  const [quota, setQuota] = useState(false);

  async function rediger() {
    const propre = situation.trim();
    if (!propre || pending) return;

    setPending(true);
    setErreur('');
    setQuota(false);
    try {
      const reponse = await fetch('/api/document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modele, situation: propre }),
      });
      const corps = (await reponse.json()) as Document;
      if (!reponse.ok) {
        setQuota(Boolean(corps.abonnement));
        throw new Error(corps.error ?? 'Rédaction impossible.');
      }
      setDocument(corps);
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : 'Rédaction impossible.');
    } finally {
      setPending(false);
    }
  }

  function telecharger() {
    if (!document) return;
    /* Le préfixe d'octets indique l'encodage à Word ; sans lui, certains
       lecteurs devinent mal et rendent des caractères de remplacement. */
    const fichier = new Blob([document.rtf], { type: 'application/rtf' });
    const url = URL.createObjectURL(fichier);
    const lien = window.document.createElement('a');
    lien.href = url;
    lien.download = nomDeFichier(document.titre);
    /* Le lien doit être DANS la page, et l'URL survivre au clic : Firefox
       ignore un clic sur un ancrage détaché, et révoquer l'objet dans la
       foulée coupe le téléchargement avant qu'il ait commencé. On rend donc
       la main au navigateur, puis on nettoie au tour suivant. */
    window.document.body.append(lien);
    lien.click();
    lien.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <>
      <section className="jur-bloc">
        <h3>Votre situation</h3>
        <p className="hint">
          Racontez-la comme vous la raconteriez à quelqu’un : les faits, les dates, les montants. Plus
          c’est précis, moins le courrier comportera de blancs à compléter.
        </p>

        <div className="jur-form">
          <div className="field">
            <label className="sr-only" htmlFor="situation">
              Votre situation
            </label>
            <textarea
              id="situation"
              value={situation}
              onChange={(ev) => setSituation(ev.target.value)}
              rows={7}
              maxLength={4000}
              disabled={!actif || pending}
              placeholder={
                actif
                  ? 'Exemple : mon locataire occupe le logement depuis mars 2021, le bail arrive à échéance le 14 mars prochain, et je souhaite vendre au prix de 245 000 euros.'
                  : 'Assistant indisponible : aucune clé d’API n’est configurée sur ce site.'
              }
            />
          </div>

          <div className="jur-redaction-actions">
            <Dictee onTexte={setSituation} actif={actif && !pending} />
            <button
              className="btn btn-accent"
              type="button"
              onClick={() => void rediger()}
              disabled={!actif || pending || !situation.trim()}
            >
              {pending ? 'Rédaction…' : `Rédiger ${titre.toLowerCase()}`}
            </button>
          </div>

          {erreur && (
            <p className="jur-erreur" role="alert">
              {erreur}
              {quota && (
                <>
                  {' '}
                  <a href="/abonnement">Voir les formules</a>.
                </>
              )}
            </p>
          )}
        </div>
      </section>

      {document && (
        <section className="jur-bloc jur-courrier">
          <div className="jur-courrier-tete">
            <h3>{document.titre}</h3>
            <button className="btn btn-accent btn-sm" type="button" onClick={telecharger}>
              Télécharger (.rtf)
            </button>
          </div>

          <div className="jur-courrier-corps">
            {document.objet && <p className="jur-courrier-objet">Objet : {document.objet}</p>}
            {document.corps.map((paragraphe, rang) => (
              <p key={rang}>{paragraphe}</p>
            ))}
            <p className="jur-courrier-signature">Signature</p>
          </div>

          {document.aVerifier.length > 0 && (
            <div className="jur-avant-envoi">
              <p className="jur-oeil">À compléter avant d’envoyer</p>
              <ul>
                {document.aVerifier.map((point, rang) => (
                  <li key={rang}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          <Sources references={document.references} />

          <p className="hint">
            Ce courrier est un projet. Relisez-le, complétez les blancs entre crochets, datez-le et
            signez-le. Il n’a pas été relu par un avocat, et sur un enjeu important il devrait l’être.
          </p>
        </section>
      )}
    </>
  );
}
