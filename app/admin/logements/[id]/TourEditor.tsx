'use client';

import { useActionState, useCallback, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CopyField } from '@/components/CopyField';
import { PanoViewer } from '@/components/PanoViewer';
import type { Hotspot, Property, Scene } from '@/lib/types';
import {
  addHotspot,
  addScene,
  deleteHotspot,
  deleteProperty,
  deleteScene,
  moveScene,
  setPropertyStatus,
  updateProperty,
  updateScene,
  uploadModel,
  uploadVideo,
  type ActionResult,
} from '../../actions';

interface Props {
  property: Property;
  scenes: Scene[];
  hotspots: Hotspot[];
  origin: string;
  /** Blocs supplémentaires (photos, repères vidéo) rendus dans la colonne latérale. */
  extras?: React.ReactNode;
}

export function TourEditor({ property, scenes, hotspots, origin, extras }: Props) {
  const router = useRouter();
  const [currentSceneId, setCurrentSceneId] = useState(scenes[0]?.id ?? '');
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();
  const liveView = useRef({ yaw: 0, pitch: 0 });

  const current = scenes.find((scene) => scene.id === currentSceneId) ?? scenes[0] ?? null;
  const currentHotspots = useMemo(
    () => hotspots.filter((hotspot) => hotspot.sceneId === current?.id),
    [hotspots, current?.id],
  );
  const otherScenes = scenes.filter((scene) => scene.id !== current?.id);
  const tourUrl = `${origin}/v/${property.slug}`;

  const act = useCallback(
    (fn: () => Promise<ActionResult>, successMessage?: string) => {
      start(async () => {
        const result = await fn();
        setNotice(result.ok ? (successMessage ?? '') : (result.error ?? 'Opération impossible.'));
        router.refresh();
      });
    },
    [router],
  );

  const onPick = useCallback(
    (yaw: number, pitch: number) => {
      if (!pendingTarget || !current) return;
      const target = pendingTarget;
      setPendingTarget(null);
      act(
        () => addHotspot({ sceneId: current.id, targetSceneId: target, yaw, pitch }),
        'Passage ajouté.',
      );
    },
    [pendingTarget, current, act],
  );

  return (
    <div className="stack">
      {notice && (
        <div className="form-feedback form-feedback-ok" role="status">
          {notice}
        </div>
      )}

      <div className="editor">
        {/* ------------------------------------------------------- scène --- */}
        <div className="stack">
          <div className="stage">
            {property.mode === 'pano' && current ? (
              <PanoViewer
                key={current.id}
                scenes={scenes}
                hotspots={hotspots}
                initialSceneId={current.id}
                picking={pendingTarget !== null}
                onPick={onPick}
                onViewChange={(yaw, pitch) => {
                  liveView.current = { yaw, pitch };
                }}
                onSceneChange={setCurrentSceneId}
                showHint={false}
              />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#cbbfb0',
                  fontSize: 14,
                  textAlign: 'center',
                  padding: 24,
                }}
              >
                {scenes.length === 0
                  ? 'Ajoutez un premier panorama pour voir la visite ici.'
                  : 'Aperçu disponible sur la page publique de la visite.'}
              </div>
            )}
          </div>

          {pendingTarget && (
            <div className="callout-box">
              <strong>Cliquez dans l’image</strong> à l’endroit où le visiteur devra cliquer pour aller vers «{' '}
              {scenes.find((scene) => scene.id === pendingTarget)?.name} ».{' '}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingTarget(null)}>
                Annuler
              </button>
            </div>
          )}

          {property.mode === 'pano' && current && (
            <div className="card stack-sm">
              <div className="row row-between">
                <strong style={{ fontSize: 14 }}>Passages depuis « {current.name} »</strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={pending}
                  onClick={() =>
                    act(
                      () =>
                        updateScene(current.id, {
                          initialYaw: liveView.current.yaw,
                          initialPitch: liveView.current.pitch,
                        }),
                      'Vue de départ enregistrée.',
                    )
                  }
                  title="Le visiteur arrivera face à ce que vous voyez actuellement"
                >
                  Définir la vue de départ
                </button>
              </div>

              {currentHotspots.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  Aucun passage. Sans passage, le visiteur devra utiliser la barre des pièces en bas du viewer.
                </p>
              ) : (
                currentHotspots.map((hotspot) => (
                  <div className="hotspot-row" key={hotspot.id}>
                    <span>
                      → {scenes.find((scene) => scene.id === hotspot.targetSceneId)?.name ?? 'pièce supprimée'}{' '}
                      <em className="tiny">({Math.round(hotspot.yaw)}°)</em>
                    </span>
                    <button
                      type="button"
                      className="mini-btn mini-btn-danger"
                      disabled={pending}
                      onClick={() => act(() => deleteHotspot(hotspot.id), 'Passage supprimé.')}
                      title="Supprimer ce passage"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}

              {otherScenes.length > 0 && (
                <div className="row" style={{ marginTop: 4 }}>
                  <select
                    aria-label="Ajouter un passage vers une autre pièce"
                    className="scene-name"
                    style={{ border: '1px solid var(--line)', padding: 8, borderRadius: 2, flex: '1 1 180px' }}
                    defaultValue=""
                    onChange={(event) => {
                      if (event.target.value) setPendingTarget(event.target.value);
                      event.target.value = '';
                    }}
                  >
                    <option value="" disabled>
                      Ajouter un passage vers…
                    </option>
                    {otherScenes.map((scene) => (
                      <option key={scene.id} value={scene.id}>
                        {scene.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* -------------------------------------------------- colonne --- */}
        <div className="stack">
          <PublishPanel property={property} tourUrl={tourUrl} pending={pending} act={act} />

          {property.mode === 'pano' && (
            <div className="card stack-sm">
              <strong style={{ fontSize: 14 }}>Pièces ({scenes.length})</strong>
              {scenes.map((scene, index) => (
                <div
                  key={scene.id}
                  className={`scene-row ${scene.id === current?.id ? 'scene-row-active' : ''}`}
                  onClick={() => setCurrentSceneId(scene.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="scene-thumb" src={scene.imageUrl} alt="" loading="lazy" />
                  <input
                    aria-label="Nom de la pièce"
                    className="scene-name"
                    defaultValue={scene.name}
                    maxLength={60}
                    onClick={(event) => event.stopPropagation()}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value && value !== scene.name) act(() => updateScene(scene.id, { name: value }));
                    }}
                  />
                  <button
                    type="button"
                    className="mini-btn"
                    disabled={pending || index === 0}
                    title="Monter"
                    onClick={(event) => {
                      event.stopPropagation();
                      act(() => moveScene(scene.id, -1));
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="mini-btn"
                    disabled={pending || index === scenes.length - 1}
                    title="Descendre"
                    onClick={(event) => {
                      event.stopPropagation();
                      act(() => moveScene(scene.id, 1));
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="mini-btn mini-btn-danger"
                    disabled={pending}
                    title="Supprimer la pièce"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (confirm(`Supprimer « ${scene.name} » et ses passages ?`)) {
                        act(() => deleteScene(scene.id), 'Pièce supprimée.');
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <AddSceneForm propertyId={property.id} />
            </div>
          )}

          <SettingsForm property={property} />

          <VideoUploadForm property={property} />

          {extras}

          {property.mode === 'model' && <ModelUploadForm property={property} />}

          <div className="card">
            <strong style={{ fontSize: 14 }}>Zone dangereuse</strong>
            <p className="muted" style={{ margin: '8px 0 12px' }}>
              La suppression retire le logement, ses pièces et ses passages. Le lien public cessera de fonctionner.
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pending}
              onClick={() => {
                if (confirm(`Supprimer définitivement « ${property.name} » ?`)) {
                  start(() => void deleteProperty(property.id));
                }
              }}
            >
              Supprimer ce logement
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ publication --- */

function PublishPanel({
  property,
  tourUrl,
  pending,
  act,
}: {
  property: Property;
  tourUrl: string;
  pending: boolean;
  act: (fn: () => Promise<ActionResult>, message?: string) => void;
}) {
  const published = property.status === 'published';
  const embedSnippet = `<iframe src="${tourUrl}" width="100%" height="600" style="border:0" allowfullscreen loading="lazy" title="Visite 3D — ${property.name}"></iframe>`;

  return (
    <div className="card stack-sm">
      <div className="row row-between">
        <strong style={{ fontSize: 14 }}>Publication</strong>
        <span className={`tag ${published ? 'tag-live' : 'tag-draft'}`}>{published ? 'En ligne' : 'Brouillon'}</span>
      </div>

      <button
        type="button"
        className={published ? 'btn btn-ghost btn-sm' : 'btn btn-dark btn-sm'}
        disabled={pending}
        onClick={() =>
          act(
            () => setPropertyStatus(property.id, published ? 'draft' : 'published'),
            published ? 'Visite dépubliée.' : 'Visite en ligne — le lien est actif.',
          )
        }
      >
        {published ? 'Dépublier' : 'Publier la visite'}
      </button>

      {published && (
        <>
          <p className="tiny" style={{ margin: '6px 0 0' }}>
            Lien à envoyer au propriétaire :
          </p>
          <CopyField value={tourUrl} label={`tour-${property.id}`} name="le lien de la visite" />
          <p className="tiny" style={{ margin: '6px 0 0' }}>
            Code d’intégration pour son site :
          </p>
          <CopyField value={embedSnippet} label={`embed-${property.id}`} name="le code d’intégration" />
          <p className="tiny" style={{ margin: 0 }}>
            {property.views} vue{property.views > 1 ? 's' : ''} depuis la publication.
          </p>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- formulaires --- */

function AddSceneForm({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (previous, formData) => {
    const result = await addScene(previous, formData);
    if (result.ok) {
      formRef.current?.reset();
      router.refresh();
    }
    return result;
  }, null);

  return (
    <form action={formAction} ref={formRef} className="file-drop stack-sm" style={{ marginTop: 6 }}>
      <strong style={{ fontSize: 13 }}>Ajouter une pièce</strong>
      <input name="propertyId" type="hidden" value={propertyId} />
      <input
        aria-label="Nom de la pièce"
        name="name"
        placeholder="Nom de la pièce (facultatif)"
        maxLength={60}
        className="scene-name"
      />
      <input aria-label="Panoramas 360° à envoyer" name="image" type="file" accept="image/*" multiple required />
      <p className="tiny" style={{ margin: 0 }}>
        Panoramas 360° équirectangulaires (rapport 2:1). Sélectionnez-en plusieurs d’un coup : chaque fichier devient
        une pièce, nommée d’après son nom de fichier. Les images sont recompressées automatiquement pour rester rapides
        sur mobile.
      </p>
      {state?.error && (
        <div className="form-feedback form-feedback-error" role="alert">
          {state.error}
        </div>
      )}
      <button className="btn btn-dark btn-sm" type="submit" disabled={pending}>
        {pending ? 'Envoi…' : 'Ajouter la ou les pièces'}
      </button>
    </form>
  );
}

function ModelUploadForm({ property }: { property: Property }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (previous, formData) => {
    const result = await uploadModel(previous, formData);
    if (result.ok) router.refresh();
    return result;
  }, null);

  return (
    <form action={formAction} className="card stack-sm">
      <strong style={{ fontSize: 14 }}>Modèle 3D</strong>
      <input type="hidden" name="propertyId" value={property.id} />
      {property.modelUrl && <p className="tiny" style={{ margin: 0 }}>Un modèle est déjà en place — envoyer un nouveau fichier le remplace.</p>}
      <input aria-label="Modèle 3D à envoyer" name="model" type="file" accept=".glb,.gltf" required />
      <p className="tiny" style={{ margin: 0 }}>
        Export .glb depuis Polycam ou Luma. Au-delà de 60 Mo, le chargement devient lent sur mobile.
      </p>
      {state?.error && (
        <div className="form-feedback form-feedback-error" role="alert">
          {state.error}
        </div>
      )}
      <button className="btn btn-dark btn-sm" type="submit" disabled={pending}>
        {pending ? 'Envoi…' : 'Envoyer le modèle'}
      </button>
    </form>
  );
}

function VideoUploadForm({ property }: { property: Property }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (previous, formData) => {
    const result = await uploadVideo(previous, formData);
    if (result.ok) router.refresh();
    return result;
  }, null);

  return (
    <form action={formAction} className="card stack-sm">
      <strong style={{ fontSize: 14 }}>Vidéo walkthrough</strong>
      <p className="tiny" style={{ margin: 0 }}>
        Une déambulation filmée au téléphone, en marchant lentement dans le logement. Le visiteur la regarde, il ne la
        contrôle pas — c’est le format des visites vues sur les réseaux.
      </p>
      {property.videoUrl && (
        <video src={property.videoUrl} controls playsInline style={{ width: '100%', borderRadius: 2, background: '#14100d' }} />
      )}
      <input aria-label="Vidéo à envoyer" name="video" type="file" accept="video/*" required />
      <input type="hidden" name="propertyId" value={property.id} />
      <p className="tiny" style={{ margin: 0 }}>MP4, WebM ou MOV, 200 Mo maximum.</p>
      {state?.error && (
        <div className="form-feedback form-feedback-error" role="alert">
          {state.error}
        </div>
      )}
      <button className="btn btn-dark btn-sm" type="submit" disabled={pending}>
        {pending ? 'Envoi…' : property.videoUrl ? 'Remplacer la vidéo' : 'Envoyer la vidéo'}
      </button>
    </form>
  );
}

function SettingsForm({ property }: { property: Property }) {
  const router = useRouter();
  const [mode, setMode] = useState(property.mode);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (previous, formData) => {
    const result = await updateProperty(previous, formData);
    if (result.ok) router.refresh();
    return result;
  }, null);

  return (
    <form action={formAction} className="card stack-sm">
      <strong style={{ fontSize: 14 }}>Fiche du logement</strong>
      <input type="hidden" name="id" value={property.id} />

      <div className="field">
        <label htmlFor="ed-name">Nom</label>
        <input id="ed-name" name="name" defaultValue={property.name} required maxLength={140} />
      </div>
      <div className="field">
        <label htmlFor="ed-city">Ville</label>
        <input id="ed-city" name="city" defaultValue={property.city} maxLength={120} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="ed-owner">Propriétaire</label>
          <input id="ed-owner" name="ownerName" defaultValue={property.ownerName} maxLength={140} />
        </div>
        <div className="field">
          <label htmlFor="ed-phone">Téléphone</label>
          <input id="ed-phone" name="ownerPhone" defaultValue={property.ownerPhone} maxLength={40} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ed-email">Email</label>
        <input id="ed-email" name="ownerEmail" type="email" defaultValue={property.ownerEmail} maxLength={200} />
      </div>

      <div className="field">
        <label htmlFor="ed-mode">Format ouvert par défaut</label>
        <select
          id="ed-mode"
          name="mode"
          defaultValue={property.mode}
          onChange={(event) => setMode(event.target.value as Property['mode'])}
        >
          <option value="pano">Panoramas 360° (hébergés ici)</option>
          <option value="model">Modèle 3D .glb (Polycam, Luma)</option>
          <option value="video">Vidéo walkthrough (filmée sur place)</option>
          <option value="embed">Viewer externe (Matterport, Cupix)</option>
        </select>
      </div>

      {mode === 'embed' && (
        <div className="field">
          <label htmlFor="ed-embed">Lien du viewer externe</label>
          <input
            id="ed-embed"
            name="embedUrl"
            type="url"
            defaultValue={property.embedUrl}
            placeholder="https://my.matterport.com/show/?m=…"
          />
        </div>
      )}
      {mode !== 'embed' && <input type="hidden" name="embedUrl" value={property.embedUrl} />}

      <p className="tiny" style={{ margin: '-2px 0 0' }}>
        Les formats que vous avez renseignés sont tous proposés au voyageur, qui bascule de l’un à l’autre. Celui-ci
        est simplement affiché en premier.
      </p>

      <div className="field">
        <label htmlFor="ed-description">Description publique</label>
        <textarea
          id="ed-description"
          name="description"
          defaultValue={property.description}
          maxLength={4000}
          rows={5}
          placeholder="T2 de 42 m² au 3e étage, chambre séparée, cuisine équipée…"
        />
        <p className="tiny" style={{ margin: '6px 0 0' }}>
          Affichée sous la visite, et utilisée par l’assistant pour répondre aux voyageurs.
        </p>
      </div>

      <div className="field">
        <label htmlFor="ed-chat" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
          <input id="ed-chat" name="chatEnabled" type="checkbox" defaultChecked={property.chatEnabled} style={{ width: 'auto' }} />
          Activer l’assistant sur cette visite
        </label>
        <p className="tiny" style={{ margin: '6px 0 0' }}>
          Il répond aux questions des voyageurs à partir de la description et des pièces, sans jamais inventer.
        </p>
      </div>

      <div className="field">
        <label htmlFor="ed-notes">Notes internes</label>
        <textarea id="ed-notes" name="notes" defaultValue={property.notes} maxLength={4000} rows={3} />
        <p className="tiny" style={{ margin: '6px 0 0' }}>Jamais affichées publiquement.</p>
      </div>

      {state?.error && (
        <div className="form-feedback form-feedback-error" role="alert">
          {state.error}
        </div>
      )}

      <button className="btn btn-dark btn-sm" type="submit" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  );
}
