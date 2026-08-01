'use client';

import { useActionState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addChapter,
  addPhotos,
  deleteChapter,
  deletePhoto,
  updatePhoto,
  type ActionResult,
} from '@/app/admin/actions';
import type { Chapter, Photo } from '@/lib/types';

function timecode(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

/**
 * Photos de présentation et repères de la vidéo.
 *
 * Ces deux blocs vivent hors de l'éditeur 360° : ils concernent le bien, pas
 * la visite — et servent aussi de matière à l'assistant.
 */
export function PropertyExtras({
  propertyId,
  photos,
  chapters,
  hasVideo,
}: {
  propertyId: string;
  photos: Photo[];
  chapters: Chapter[];
  hasVideo: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const photoForm = useRef<HTMLFormElement>(null);
  const chapterForm = useRef<HTMLFormElement>(null);

  const [photoState, photoAction, photoPending] = useActionState<ActionResult | null, FormData>(
    async (previous, formData) => {
      const result = await addPhotos(previous, formData);
      if (result.ok) {
        photoForm.current?.reset();
        router.refresh();
      }
      return result;
    },
    null,
  );

  const [chapterState, chapterAction, chapterPending] = useActionState<ActionResult | null, FormData>(
    async (previous, formData) => {
      const result = await addChapter(previous, formData);
      if (result.ok) {
        chapterForm.current?.reset();
        router.refresh();
      }
      return result;
    },
    null,
  );

  return (
    <>
      {/* ------------------------------------------------------- photos --- */}
      <div className="card stack-sm">
        <strong style={{ fontSize: 14 }}>Photos du bien ({photos.length})</strong>
        <p className="tiny" style={{ margin: 0 }}>
          Affichées sous la visite. Leur légende aide l’assistant à répondre.
        </p>

        {photos.map((photo) => (
          <div className="scene-row" key={photo.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="scene-thumb" src={photo.url} alt="" loading="lazy" />
            <input
              className="scene-name"
              defaultValue={photo.caption}
              maxLength={120}
              placeholder="Légende (ex. Salon vu de l’entrée)"
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value !== photo.caption) start(() => void updatePhoto(photo.id, value).then(router.refresh));
              }}
            />
            <button
              type="button"
              className="mini-btn mini-btn-danger"
              disabled={pending}
              title="Supprimer la photo"
              onClick={() => {
                if (confirm('Supprimer cette photo ?')) {
                  start(() => void deletePhoto(photo.id).then(router.refresh));
                }
              }}
            >
              ✕
            </button>
          </div>
        ))}

        <form action={photoAction} ref={photoForm} className="file-drop stack-sm">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input name="photos" type="file" accept="image/*" multiple required />
          {photoState?.error && (
            <div className="form-feedback form-feedback-error" role="alert">
              {photoState.error}
            </div>
          )}
          <button className="btn btn-dark btn-sm" type="submit" disabled={photoPending}>
            {photoPending ? 'Envoi…' : 'Ajouter des photos'}
          </button>
        </form>
      </div>

      {/* ---------------------------------------------------- chapitres --- */}
      <div className="card stack-sm">
        <strong style={{ fontSize: 14 }}>Repères de la vidéo ({chapters.length})</strong>
        <p className="tiny" style={{ margin: 0 }}>
          Sans repères, une vidéo se regarde du début à la fin. Avec, le voyageur saute directement à la chambre.
        </p>

        {!hasVideo && (
          <div className="callout-box">Ajoutez d’abord une vidéo pour pouvoir y placer des repères.</div>
        )}

        {[...chapters]
          .sort((a, b) => a.seconds - b.seconds)
          .map((chapter) => (
            <div className="hotspot-row" key={chapter.id}>
              <span>
                {timecode(chapter.seconds)} — {chapter.label}
              </span>
              <button
                type="button"
                className="mini-btn mini-btn-danger"
                disabled={pending}
                title="Supprimer ce repère"
                onClick={() => start(() => void deleteChapter(chapter.id).then(router.refresh))}
              >
                ✕
              </button>
            </div>
          ))}

        <form action={chapterAction} ref={chapterForm} className="file-drop stack-sm">
          <input type="hidden" name="propertyId" value={propertyId} />
          <div className="row" style={{ gap: 8 }}>
            <input
              name="label"
              className="scene-name"
              placeholder="Nom de la pièce"
              maxLength={60}
              required
              style={{ flex: '1 1 140px', border: '1px solid var(--line)', padding: 8, borderRadius: 2 }}
            />
            <input
              name="time"
              className="scene-name"
              placeholder="1:30"
              maxLength={12}
              required
              style={{ flex: '0 0 90px', border: '1px solid var(--line)', padding: 8, borderRadius: 2 }}
            />
          </div>
          {chapterState?.error && (
            <div className="form-feedback form-feedback-error" role="alert">
              {chapterState.error}
            </div>
          )}
          <button className="btn btn-ghost btn-sm" type="submit" disabled={chapterPending || !hasVideo}>
            {chapterPending ? 'Ajout…' : 'Ajouter un repère'}
          </button>
        </form>
      </div>
    </>
  );
}
