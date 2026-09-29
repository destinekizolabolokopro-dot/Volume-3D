import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  CALENDRIER,
  CHARGES,
  MAJORITES,
  PASSERELLES,
  PIECES,
  coproprietePourLeModele,
} from '../lib/copropriete.ts';

/**
 * Cette table est la seule du projet dont le contenu est affirmé au
 * spécialiste comme un fait vérifié : la consigne l'autorise à en reprendre
 * les numéros d'article sans les chercher dans le corpus. Elle doit donc être
 * vérifiée ici, contre le corpus lui-même.
 *
 * Si la loi est renumérotée, ou si le fonds LEGI est reconstruit sans un
 * article, ces tests tombent — avant que la table n'atteigne quiconque.
 */

const corpus = JSON.parse(await readFile('corpus/copropriete.json', 'utf8')) as {
  arrete: string;
  documents: { nom: string; articles: { num: string; texte: string }[] }[];
};

const LOI = corpus.documents.find((d) => d.nom.includes('1965'));
const PAR_NUMERO = new Map((LOI?.articles ?? []).map((a) => [a.num, a.texte]));

function texteDe(numero: string): string {
  const texte = PAR_NUMERO.get(numero);
  assert.ok(texte, `l’article ${numero} de la loi de 1965 est absent du corpus`);
  return texte;
}

/* ------------------------------------------------ les articles existent --- */

test('le corpus de copropriété porte bien la loi de 1965', () => {
  assert.ok(LOI, 'la loi du 10 juillet 1965 est absente du corpus');
  assert.ok((LOI?.articles.length ?? 0) > 100);
});

test('chaque majorité cite un article qui existe', () => {
  for (const majorite of MAJORITES) {
    assert.ok(PAR_NUMERO.has(majorite.article), `${majorite.nom} → article ${majorite.article}`);
  }
});

test('tous les articles cités dans la table existent', () => {
  /* La table est donnée au modèle comme vérifiée : un numéro qui aurait bougé
     deviendrait une référence fausse recopiée dans un courrier. */
  const tout = coproprietePourLeModele();
  const cites = new Set(
    [...tout.matchAll(/article\s+(\d+(?:-\d+)?)/gi)].map((m) => m[1]),
  );
  /* L'article 2224 est celui du code civil, cité par l'article 42 lui-même :
     il n'est pas dans la loi de 1965 et n'a pas à y être. */
  cites.delete('2224');
  for (const numero of cites) {
    assert.ok(PAR_NUMERO.has(numero), `article ${numero} cité mais absent de la loi de 1965`);
  }
  assert.ok(cites.size >= 6, `trop peu d’articles cités : ${[...cites].join(', ')}`);
});

/* ------------------------------------------- ce que disent les articles --- */

test('l’article 24 se compte sur les voix exprimées', () => {
  /* C'est LA distinction entre 24 et 25, et celle qu'on rate : à l'article 24
     les absents ne comptent pas, à l'article 25 ils votent contre de fait. */
  assert.match(texteDe('24'), /majorité des voix exprimées/i);
  const simple = MAJORITES.find((m) => m.article === '24');
  assert.match(simple?.calcul ?? '', /EXPRIMÉES/);
  assert.match(simple?.calcul ?? '', /abstentions ne comptent pas/i);
});

test('l’article 25 se compte sur tous les copropriétaires', () => {
  assert.match(texteDe('25'), /majorité des voix de tous les copropriétaires/i);
  const absolue = MAJORITES.find((m) => m.article === '25');
  assert.match(absolue?.calcul ?? '', /TOUS les copropriétaires/);
});

test('l’article 26 exige bien les deux tiers ET la majorité des membres', () => {
  assert.match(texteDe('26'), /majorité des membres du syndicat représentant au moins les deux tiers des voix/i);
  const double = MAJORITES.find((m) => m.nom === 'Double majorité');
  assert.match(double?.calcul ?? '', /DEUX TIERS/);
  assert.match(double?.calcul ?? '', /cumulatives/);
});

test('la passerelle de l’article 25-1 tient au tiers des voix', () => {
  const texte = texteDe('25-1');
  assert.match(texte, /au moins le tiers de ces voix/i);
  assert.match(texte, /second vote/i);
  assert.match(texte, /trois mois/i);
  assert.ok(PASSERELLES.some((p) => /25-1/.test(p) && /tiers/.test(p)));
  assert.ok(PASSERELLES.some((p) => /trois mois/.test(p) && /identique/i.test(p)));
});

test('la passerelle de l’article 26-1 mène à l’article 25, pas à l’article 24', () => {
  const texte = texteDe('26-1');
  assert.match(texte, /majorité des voix de tous les copropriétaires/i);
  const passerelle = PASSERELLES.find((p) => /26-1/.test(p));
  assert.match(passerelle ?? '', /article 25/);
  assert.ok(!/mène à la majorité de l’article 24/.test(passerelle ?? ''));
});

test('aucune passerelle ne mène à l’unanimité, et la table le dit', () => {
  assert.ok(PASSERELLES.some((p) => /unanimité/i.test(p) && /aucune/i.test(p)));
});

test('le délai de contestation court de la notification, pas de l’assemblée', () => {
  /* Confondre les deux points de départ fait déclarer irrecevable une
     contestation qui était dans les temps. */
  const texte = texteDe('42');
  assert.match(texte, /deux mois à compter de la notification du procès-verbal/i);
  assert.match(texte, /opposants ou défaillants/i);
  assert.match(texte, /délai d'un mois à compter de la tenue de l'assemblée/i);

  const ligne = CALENDRIER.find((l) => /DEUX MOIS/.test(l));
  assert.match(ligne ?? '', /notification du procès-verbal/);
  assert.match(ligne ?? '', /et non de la tenue de l’assemblée/);
  assert.ok(CALENDRIER.some((l) => /OPPOSANTS ou DÉFAILLANTS/.test(l)));
  assert.ok(CALENDRIER.some((l) => /dans le mois de la tenue/.test(l)));
});

test('les deux clés de répartition de l’article 10 sont distinguées', () => {
  const texte = texteDe('10');
  assert.match(texte, /utilité objective/i);
  assert.match(texte, /proportionnellement aux valeurs relatives/i);
  assert.ok(CHARGES.some((c) => /UTILITÉ OBJECTIVE/.test(c) && /équipement commun/i.test(c)));
  assert.ok(CHARGES.some((c) => /TANTIÈMES/.test(c) && /conservation/i.test(c)));
});

test('la déchéance du terme de l’article 19-2 tient à trente jours', () => {
  assert.match(texteDe('19-2'), /délai de trente jours/i);
  assert.ok(CHARGES.some((c) => /TRENTE JOURS/.test(c) && /19-2/.test(c)));
});

/* ------------------------------------------------------ ce qui en sort --- */

test('la consigne nomme les quatre majorités et leurs décisions', () => {
  const rendu = coproprietePourLeModele();
  for (const majorite of MAJORITES) {
    assert.ok(rendu.includes(majorite.nom), majorite.nom);
    for (const decision of majorite.decisions) {
      assert.ok(rendu.includes(decision), decision.slice(0, 40));
    }
  }
});

test('la consigne porte les deux réflexes de spécialiste', () => {
  const rendu = coproprietePourLeModele();
  assert.match(rendu, /règlement de copropriété de CET immeuble/);
  assert.match(rendu, /NOTIFICATION du procès-verbal, jamais de la tenue/);
});

test('les pièces à réclamer nomment la date de notification', () => {
  assert.ok(PIECES.some((p) => /DATE DE SA NOTIFICATION/.test(p)));
});
