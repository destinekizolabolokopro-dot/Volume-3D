/**
 * Nommer ce qui vient de casser.
 *
 * Tout échec donnait la même phrase : « La réponse n'a pas pu être produite.
 * Réessayez dans un instant. » Elle a le défaut d'être vraie partout et utile
 * nulle part. Derrière elle se cachaient trois situations qui n'appellent pas
 * du tout le même geste : le service est saturé et il faut attendre trente
 * secondes ; la clé est mauvaise et réessayer mille fois ne changera rien ;
 * le réseau a lâché au milieu et la réponse était peut-être à moitié écrite.
 *
 * Ce fichier les sépare. Il ne connaît ni le SDK ni le réseau : il lit un
 * code et un nom sur ce qu'on lui tend, ce qui le rend testable sans rien
 * faire tomber pour de vrai.
 *
 * Le champ qui compte le plus n'est pas le message, c'est `reessayable` :
 * c'est lui qui décide si l'écran propose un bouton « Reposer la question »
 * ou s'il serait cruel de le faire.
 */

export interface Panne {
  /** Ce que la personne lit. En français, sans code ni nom de service. */
  message: string;
  /** Vrai quand refaire la même chose a une vraie chance de marcher. */
  reessayable: boolean;
}

/** Ce qu'on arrive à lire sur une erreur, quelle qu'en soit la provenance. */
function indices(cause: unknown): { statut: number; nom: string } {
  const objet = (cause ?? {}) as { status?: unknown; name?: unknown; message?: unknown };
  const statut = typeof objet.status === 'number' ? objet.status : 0;
  const nom = [objet.name, objet.message].filter((x) => typeof x === 'string').join(' ');
  return { statut, nom };
}

export function diagnostiquer(cause: unknown): Panne {
  const { statut, nom } = indices(cause);

  /* Une coupure réseau ou un délai dépassé n'ont pas de code : ils se
     reconnaissent au nom de l'erreur. On les traite en premier, parce qu'un
     `status` à zéro tomberait sinon dans le cas général. */
  if (/timeout|timed out|connection|network|socket|abort|ECONN|ETIMEDOUT/i.test(nom)) {
    return {
      message:
        'La liaison s’est interrompue pendant la réponse. Votre question est conservée : relancez-la.',
      reessayable: true,
    };
  }

  /* 529 est le code propre à la surcharge du modèle. Il est le plus fréquent
     des échecs passagers, et le seul pour lequel attendre un peu avant de
     relancer change vraiment quelque chose. */
  if (statut === 529 || statut === 503) {
    return {
      message:
        'Le service est momentanément saturé. Attendez une demi-minute et relancez votre question : elle est conservée.',
      reessayable: true,
    };
  }

  if (statut === 429) {
    return {
      message:
        'Trop de questions sont parties en même temps. Patientez quelques secondes et relancez : votre question est conservée.',
      reessayable: true,
    };
  }

  if (statut === 408 || statut === 504) {
    return {
      message:
        'La réponse a mis trop longtemps à venir. Relancez votre question — en la découpant, si elle portait sur plusieurs points à la fois.',
      reessayable: true,
    };
  }

  if (statut === 401 || statut === 403) {
    /* Celle-ci ne se répare pas en réessayant, et le dire évite à quelqu'un
       de s'acharner sur un bouton. Le message reste sobre : la personne n'a
       pas à savoir qu'il s'agit d'une clé d'API. */
    return {
      message:
        'L’assistant n’est pas correctement configuré sur ce site. Ce n’est pas votre question : signalez-le, elle sera traitée dès que ce sera réglé.',
      reessayable: false,
    };
  }

  if (statut === 400 || statut === 422) {
    return {
      message:
        'La demande a été refusée telle quelle. Reformulez votre question, ou retirez la pièce jointe si vous en aviez déposé une.',
      reessayable: false,
    };
  }

  if (statut >= 500) {
    return {
      message: 'Le service a rencontré une panne passagère. Relancez votre question : elle est conservée.',
      reessayable: true,
    };
  }

  /* Le cas général est déclaré réessayable, et c'est un choix : relancer ne
     coûte qu'un clic, tandis que renoncer coûte la question. */
  return {
    message: 'La réponse n’a pas pu être produite. Relancez votre question : elle est conservée.',
    reessayable: true,
  };
}
