import 'server-only';

/**
 * Extension IA des photos d'annonce, pour les aperçus de démarchage.
 *
 * ⚠️ Ce module produit des images partiellement inventées. Il n'est appelé que
 * depuis le mode démarchage (`Preview`), jamais depuis une visite livrée
 * (`Property`). Le résultat est toujours affiché avec filigrane et bandeau
 * d'avertissement — voir app/demo/[token]/page.tsx.
 *
 * Si aucune clé d'API n'est configurée, la génération est simplement ignorée :
 * l'aperçu retombe alors sur les photos d'origine, sans rien inventer.
 */

const PROMPT = [
  "Étends cette photo d'intérieur en une vue panoramique large, comme si elle était prise avec un objectif très grand angle depuis le même point de vue.",
  'Conserve à l’identique tout ce qui est visible sur la photo d’origine : mobilier, matériaux, couleurs, sources de lumière, style architectural.',
  'Prolonge uniquement les murs, le sol et le plafond au-delà du cadre, de façon cohérente avec la pièce.',
  'N’ajoute aucun meuble, aucune ouverture, aucune pièce supplémentaire qui ne serait pas déjà suggérée par la photo.',
  'Rendu photoréaliste, lumière naturelle, aucune personne, aucun texte, aucun filigrane.',
].join(' ');

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
}

export function aiProvider(): 'gemini' | 'none' {
  const explicit = process.env.AI_IMAGE_PROVIDER;
  if (explicit === 'none') return 'none';
  if (process.env.GOOGLE_AI_API_KEY) return 'gemini';
  return 'none';
}

export function isAiConfigured(): boolean {
  return aiProvider() !== 'none';
}

interface GeminiPart {
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}

/**
 * Demande au modèle d'image d'élargir la photo. Renvoie null si la génération
 * échoue : l'appelant doit alors se rabattre sur la photo d'origine.
 */
export async function expandPhoto(source: GeneratedImage): Promise<GeneratedImage | null> {
  if (aiProvider() !== 'gemini') return null;

  const apiKey = process.env.GOOGLE_AI_API_KEY as string;
  const model = process.env.AI_IMAGE_MODEL ?? 'gemini-2.5-flash-image';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: PROMPT },
              { inlineData: { mimeType: source.mimeType, data: source.buffer.toString('base64') } },
            ],
          },
        ],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('[ai-preview] réponse en erreur', response.status, detail.slice(0, 400));
      return null;
    }

    const body = (await response.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
    };

    for (const part of body.candidates?.[0]?.content?.parts ?? []) {
      const inline = part.inlineData ?? part.inline_data;
      const data = inline?.data;
      if (!data) continue;
      const mimeType = (inline as { mimeType?: string }).mimeType ?? (inline as { mime_type?: string }).mime_type;
      return { buffer: Buffer.from(data, 'base64'), mimeType: mimeType ?? 'image/png' };
    }

    console.error('[ai-preview] aucune image dans la réponse du modèle');
    return null;
  } catch (error) {
    console.error('[ai-preview] appel impossible', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
