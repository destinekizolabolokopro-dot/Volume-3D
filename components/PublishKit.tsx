'use client';

import { useMemo, useState } from 'react';
import { floorPlanDataUri, floorPlanFileName, renderFloorPlan } from '@/lib/floorplan-svg';
import { buildListing, TITLE_LIMIT } from '@/lib/listing';
import { qrDataUri, qrSvg } from '@/lib/qrcode';
import type { FloorPlan, PlanDoor, Property, PropertyFact } from '@/lib/types';

/**
 * Ce que le propriétaire emporte pour son annonce.
 *
 * Tout le reste du produit sert la visite. Ce bloc sert **l'annonce** : le plan
 * redessiné qu'il dépose sur Airbnb, le texte qu'il colle dans la description,
 * le message qu'il envoie au voyageur avec le lien.
 *
 * Rien n'est calculé sur le serveur, rien n'est enregistré : tout se déduit du
 * dossier déjà à l'écran. Une modification de la fiche se répercute ici au
 * rendu suivant, sans bouton « régénérer ».
 */
export function PublishKit({
  property,
  plan,
  doors,
  facts,
  tourUrl,
}: {
  property: Property;
  plan: FloorPlan | null;
  doors: PlanDoor[];
  facts: PropertyFact[];
  tourUrl: string;
}) {
  const [copied, setCopied] = useState('');

  const listing = useMemo(
    () => buildListing(property, plan, facts, tourUrl),
    [property, plan, facts, tourUrl],
  );

  // Le plan n'est dessiné que s'il a été relu : un relevé non confirmé n'a rien
  // à faire sur une annonce publique.
  const publishable = plan?.confirmed ? plan : null;
  const svg = useMemo(
    () => (publishable ? renderFloorPlan(publishable, doors, { title: property.name, width: 1200 }) : ''),
    [publishable, doors, property.name],
  );
  const svgUri = useMemo(
    () => (publishable ? floorPlanDataUri(publishable, doors, { title: property.name, width: 1200 }) : ''),
    [publishable, doors, property.name],
  );

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      // Presse-papiers refusé : on ne prétend pas avoir copié.
      setCopied('');
    }
  }

  /** Propose un SVG au téléchargement. */
  function save(content: string, filename: string) {
    const url = URL.createObjectURL(new Blob([content], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadPlan() {
    save(svg, floorPlanFileName(property.name));
  }

  const titleTooLong = listing.title.length > TITLE_LIMIT;

  // Correction haute : un QR imprimé finit taché, plié ou décollé à un coin.
  const qr = useMemo(
    () => (tourUrl ? qrDataUri(tourUrl, { ec: 'H', size: 420, label: `Visite de ${property.name}` }) : ''),
    [tourUrl, property.name],
  );

  function downloadQr() {
    const svg = qrSvg(tourUrl, { ec: 'H', size: 420, label: `Visite de ${property.name}` });
    save(svg, `qr-${floorPlanFileName(property.name).replace(/^plan-|\.svg$/g, '')}.svg`);
  }

  return (
    <section className="card">
      <h2 className="admin-h2">
        À publier sur votre annonce <small>déduit de votre plan et de votre fiche</small>
      </h2>

      {/* ------------------------------------------------------------ le plan */}

      {publishable ? (
        <>
          <p className="tiny" style={{ marginTop: 0 }}>
            Le plan redessiné, aux dimensions relevées. Airbnb accepte les plans dans les photos de
            l’annonce, et un plan net répond à la moitié des questions avant qu’on les pose.
          </p>
          <div
            style={{
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              background: '#fff',
              padding: 10,
              marginBottom: 12,
              overflowX: 'auto',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgUri} alt={`Plan de ${property.name}`} style={{ width: '100%', display: 'block' }} />
          </div>
          <div className="row" style={{ marginBottom: 22 }}>
            <button className="btn btn-dark btn-sm" type="button" onClick={downloadPlan}>
              Télécharger le plan
            </button>
            <span className="tiny">
              Format SVG : il reste net à n’importe quelle taille, et s’ouvre dans n’importe quel navigateur.
            </span>
          </div>
        </>
      ) : (
        <div className="note" style={{ marginBottom: 20 }}>
          {plan
            ? 'Confirmez le relevé du plan ci-dessus pour obtenir le plan à publier.'
            : 'Envoyez le plan du logement pour obtenir un plan redessiné, à joindre à votre annonce.'}
        </div>
      )}

      {/* ------------------------------------------------------------ le QR */}

      {qr && (
        <div
          style={{
            display: 'flex',
            gap: 18,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            padding: '16px 0 22px',
            borderTop: '1px solid var(--line)',
            marginBottom: 4,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`QR code vers la visite de ${property.name}`}
            width={132}
            height={132}
            style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', flex: 'none' }}
          />
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>Le QR de votre visite</strong>
            <p className="tiny" style={{ margin: '0 0 10px' }}>
              À imprimer et à poser dans le logement — sur le livret d’accueil, près de la porte, sur le
              frigo. Un voyageur déjà sur place le montre à ses amis ; c’est votre annonce qui tourne.
            </p>
            <button className="btn btn-ghost btn-sm" type="button" onClick={downloadQr}>
              Télécharger le QR
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- le titre */}

      <Field
        label="Titre de l’annonce"
        hint={
          titleTooLong
            ? `${listing.title.length} caractères — Airbnb coupe à ${TITLE_LIMIT}.`
            : `${listing.title.length} / ${TITLE_LIMIT} caractères.`
        }
        warn={titleTooLong}
        value={listing.title}
        copied={copied === 'titre'}
        onCopy={() => copy('titre', listing.title)}
      />

      <Field
        label="Description"
        hint="Aucun lien dedans : Airbnb filtre les liens externes des descriptions."
        value={listing.description}
        rows={9}
        copied={copied === 'description'}
        onCopy={() => copy('description', listing.description)}
      />

      {listing.highlights.length > 0 && (
        <Field
          label="Points forts"
          hint="À reprendre dans les équipements ou en tête de description."
          value={listing.highlights.map((item) => `• ${item}`).join('\n')}
          rows={Math.min(9, listing.highlights.length + 1)}
          copied={copied === 'points'}
          onCopy={() => copy('points', listing.highlights.join('\n'))}
        />
      )}

      <Field
        label="Message au voyageur"
        hint="À envoyer dans la messagerie une fois le contact établi : c’est là que le lien passe."
        value={listing.travellerMessage}
        rows={7}
        copied={copied === 'message'}
        onCopy={() => copy('message', listing.travellerMessage)}
      />

      {listing.missing.length > 0 && (
        <div className="note">
          <strong>Ce qui rendrait l’annonce meilleure :</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {listing.missing.map((item) => (
              <li key={item} className="tiny">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Un texte prêt à copier, avec son bouton. */
function Field({
  label,
  hint,
  value,
  rows = 2,
  warn = false,
  copied,
  onCopy,
}: {
  label: string;
  hint: string;
  value: string;
  rows?: number;
  warn?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="field" style={{ marginBottom: 18 }}>
      <div className="row row-between" style={{ marginBottom: 6 }}>
        <label htmlFor={`kit-${label}`}>{label}</label>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onCopy}>
          {copied ? 'Copié ✓' : 'Copier'}
        </button>
      </div>
      {rows > 2 ? (
        <textarea id={`kit-${label}`} readOnly value={value} rows={rows} style={{ resize: 'vertical' }} />
      ) : (
        <input id={`kit-${label}`} readOnly value={value} />
      )}
      <p className="hint" style={warn ? { color: 'var(--danger)' } : undefined}>
        {hint}
      </p>
    </div>
  );
}
