# Droit immobilier

Un assistant juridique pour ceux qui vivent de l'immobilier : propriétaires
bailleurs, loueurs en meublé de tourisme, copropriétaires, et les
professionnels qui les accompagnent — agents, mandataires, gestionnaires.

On y pose une question en français, elle part vers le spécialiste compétent
parmi dix, et **la réponse cite le texte officiel**, article par article, tiré
du fonds LEGI de la DILA.

> **Information juridique, et non consultation d'avocat.** La consultation
> juridique est une activité réglementée en France (loi du 31 décembre 1971).
> Ce service informe et oriente ; il ne plaide pas, ne promet aucune issue, et
> nomme le professionnel à voir dès qu'il en faut un.

```bash
npm install
cp .env.example .env.local     # puis renseignez ANTHROPIC_API_KEY et AUTH_SECRET
npm run dev
```

Sans configuration Supabase, tout est enregistré dans `.data/` : prévu pour
développer sans rien installer d'autre. En ligne, la base est obligatoire —
sinon les comptes créés seraient perdus au premier redéploiement, et la page de
connexion le dit au lieu de laisser un compte orphelin.

| commande | ce qu'elle fait |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | compilation de production |
| `npm test` | les tests unitaires |
| `npm run typecheck` | vérification des types |
| `npm run verify` | les deux précédents |
| `npm run corpus -- --fonds` | télécharge le fonds LEGI et reconstruit `corpus/` |

`corpus` est à part : elle télécharge 2,4 Go et prend une heure. Son résultat
est versionné, donc on ne la relance que quand la loi bouge sur une matière
suivie, ou quand la sélection de `lib/corpus-choix.ts` change.

## Ce que contient le dépôt

```
app/          les pages et l'unique route d'API
components/   le fil, le composeur, les sources, la barre
lib/          le catalogue des spécialités, l'aiguillage, le modèle, le corpus
corpus/       2 133 articles en vigueur, versionnés (2,6 Mo)
scripts/      la construction du corpus depuis le fonds DILA
supabase/     trois tables, et rien d'autre
tests/        55 assertions, aucune n'appelle le réseau
```

---

## Ce que c'est

### Deux publics, et le spécialiste reconnaît lequel lui parle

**Les propriétaires** d'abord : bailleurs, loueurs en meublé de tourisme,
copropriétaires. Ça ne change pas le droit, ça change le point de vue : « puis-je donner congé ? » et « mon propriétaire
peut-il me donner congé ? » appellent la même règle et deux réponses
différentes. Un locataire qui pose sa question obtient quand même une réponse
juste : le spécialiste dit alors depuis quel côté il répond.

**Les professionnels** ensuite : agents immobiliers, mandataires,
négociateurs, gestionnaires. Ils changent trois choses. Ils connaissent le
vocabulaire — les définitions leur font perdre du temps, jamais les conditions
de forme. Ils travaillent sous contrainte : ce qu'ils veulent tient en la
règle exacte, la pièce à réunir, et le risque pris s'ils passent outre. Et
surtout **ils engagent leur responsabilité** là où un particulier ne risque
que son affaire — d'où la consigne de leur dire ce qu'ils doivent écrire et
conserver, pas seulement ce qu'ils doivent faire.

C'est ce second public qui a fait apparaître une dixième spécialité, **le
métier de l'agent immobilier** : mandat et registre, honoraires et
exigibilité, mentions obligatoires d'une annonce, carte professionnelle et
garantie financière, vigilance anti-blanchiment, devoir de conseil. Les neuf
autres traitent le droit des biens de ses clients ; celle-là traite le sien,
et c'est celui sur lequel il est attaqué.

### Dix spécialistes, un seul modèle

Il n'y a pas dix modèles : il y a un modèle et dix consignes. Ce qui
spécialise, c'est ce qu'on met devant lui — le périmètre exact, les textes
mobilisables, les délais à signaler, et ce qu'il doit refuser de traiter. Ces
quatre choses vivent dans **un seul fichier**, `lib/domaines.ts`, qui sert à la
fois d'aiguillage, de consigne et de contenu affiché. Un spécialiste dont la
consigne serait écrite à deux endroits finirait par en appliquer une
troisième.

### L'aiguillage se fait sans modèle, sauf quand il hésite

`lib/aiguillage.ts` est du calcul pur : mots normalisés (sans accents ni
apostrophes), mots décisifs pesés quatre fois plus que le champ lexical,
expressions de plusieurs mots pesées davantage que les mots seuls. Une question
sur trois se range d'elle-même — « décennale », « dépôt de garantie »,
« numéro d'enregistrement » ne veulent dire qu'une seule chose, et faire
trancher un modèle là-dessus coûterait une seconde d'attente pour la même
réponse, sans pouvoir l'expliquer.

Le modèle n'est appelé que lorsque deux domaines se tiennent (`certitude:
'hesitante'`) — une fuite causée par un locataire relève autant du bail que de
l'assurance, et les mots-clés le disent honnêtement par deux scores égaux. Il
choisit alors **parmi les pistes trouvées localement** : un identifiant hors
liste vaut absence de réponse, jamais domaine. Si l'API est injoignable,
l'orientation retombe sur la meilleure piste locale au lieu d'échouer.

L'aiguillage se fait **dans la requête de la question**, pas avant : la page
envoie une question sans spécialité, le serveur range et répond dans le même
aller-retour. Une route dédiée existait, elle a été retirée — elle imposait
deux allers-retours au moment précis où quelqu'un attend devant un écran vide.

Le résultat n'est pas qu'un identifiant : la conversation **nomme le
spécialiste retenu** en tête de fil, donne accès à ses délais, et propose les
autres pistes en un clic — cliquer repose la question au bon spécialiste, et
le fil recommence, parce qu'une consigne ne s'applique pas rétroactivement aux
réponses données par un autre. Un aiguillage qui se trompe en silence est plus
agaçant qu'un menu ; un aiguillage qui se corrige d'un clic ne l'est pas.

`tests/aiguillage.test.ts` juge le classement sur vingt-cinq questions écrites
comme un propriétaire les écrit vraiment — minuscules, accents manquants,
aucun vocabulaire juridique.

### La conversation est la page

la page d’accueil n'est pas une page qui contient un chat : au premier envoi, le
titre, la grille des dix spécialités et les avertissements s'effacent, et le
fil prend leur place. Sans navigation — changer d'URL à cet instant coûterait
un chargement au moment où quelqu'un attend sa réponse, et ferait perdre le
fil au retour arrière.

Les fiches restent accessibles (`/{domaine}`) : elles valent pour
elles-mêmes, elles s'indexent, et quelqu'un qui sait déjà que sa question
porte sur la copropriété n'a pas à la formuler pour y arriver. Le lien
« fiche » figure en tête de la conversation.

Trois composants partagent l'écriture d'une question et son fil —
`useConsultation` (l'état et l'envoi), `Composeur` (le champ, la pièce
jointe), `Fil` (le rendu) — et deux coquilles s'en servent : `Assistant` sur
l'accueil, où la spécialité est décidée par l'aiguillage, et `Consultation`
sur la fiche d'un spécialiste et sur une consultation reprise, où elle est
fixée d'avance.

Seul le strict nécessaire des fiches descend jusqu'au navigateur — nom, résumé,
délais. Le reste du catalogue (mots-clés d'aiguillage, textes de référence,
périmètre donné au modèle) pèse cinq fois plus et ne sert qu'au serveur.

### Deux règles avant toutes les autres

- **Aucune référence inventée.** Un numéro d'article faux ne se voit pas : il a
  la forme exacte d'un vrai, il sera recopié dans un courrier, puis lu par un
  juge. Le spécialiste ne cite donc un numéro que s'il a le texte sous les
  yeux — voir *Le texte est joint* plus bas. Tout le reste, il le nomme sans le
  numéroter : « la loi de 1989 sur les baux d'habitation », « la loi de 1965
  sur la copropriété ». Une réponse sans référence est utile ; une réponse avec
  une fausse référence est un piège.
- **Le délai d'abord.** C'est la seule chose qu'on ne rattrape pas : une
  mauvaise argumentation se corrige à l'audience, un délai expiré ne se corrige
  nulle part. Chaque fiche porte ses délais couperets, ils sont affichés
  **avant** la première question, et rappelés au modèle à chaque réponse.
  Quelqu'un qui apprend en arrivant qu'il lui reste deux mois pour contester
  une assemblée générale a déjà obtenu ce qu'il venait chercher.

Le reste du socle tient en cinq points : ne pas promettre d'issue, poser une
question plutôt que supposer un fait, renvoyer vers la bonne spécialité, **ne
pas sortir du droit immobilier** — une question de travail ou de famille est
déclinée franchement —, et nommer l'interlocuteur réel : ADIL, point-justice,
conciliateur, commissaire de justice, notaire, géomètre-expert, service
urbanisme.

### Le texte est joint

Interdire la référence protégeait de l'invention, mais privait la réponse de ce
qui la rend vérifiable. On a changé de méthode, pas de principe : au lieu
d'interdire, on **fournit le texte**.

`npm run corpus` télécharge le fonds LEGI publié par la DILA — le même qui
alimente Légifrance, en licence ouverte —, en tire les matières de chaque
spécialité et écrit `corpus/<domaine>.json`. Ces fichiers sont versionnés avec
le code : le site ne rappelle jamais la DILA, et une réponse ne dépend donc pas
de la disponibilité d'un serveur tiers au moment où quelqu'un pose sa question.

Le fonds se compose d'une archive globale figée (1,1 Go) et d'une archive par
jour depuis. Le script pose la première, déroule les secondes dans l'ordre, et
applique les suppressions : sans les quotidiennes, le corpus aurait plus d'un
an de retard, et un texte périmé présenté comme en vigueur est pire que pas de
texte du tout.

Trois décisions méritent d'être dites.

**On choisit par le nom et par le plan, jamais par des numéros.** Une liste de
numéros d'articles écrite à la main est exactement le risque que ce dispositif
existe pour supprimer — et les numéros bougent : le code de la construction a
été renuméroté en entier en 2021. `lib/corpus-choix.ts` déclare « la loi du
6 juillet 1989 » en entier, ou « le chapitre du louage dans le code civil ». Ça
reste juste quand les articles se déplacent.

**Un article, un bloc.** Chaque texte devient un document et chaque article un
bloc à l'intérieur. C'est ce découpage qui rend la citation exploitable :
l'API renvoie l'indice du bloc cité, donc l'article exact. Le numéro affiché
sous une réponse est **lu dans le fonds**, jamais produit par le modèle.

**Une citation qui ne tombe sur rien est jetée.** Pas rapprochée de l'article
voisin, pas rendue approximativement. Une pièce jointe déposée par le visiteur
est un document elle aussi et prend l'indice suivant : la rendre comme un
article du corpus ferait dire à la loi ce qu'elle ne dit pas. C'est le seul
défaut que ce projet ne peut pas se permettre, et `tests/citations.test.ts`
décrit surtout ce qui est refusé.

À l'écran, les articles cités vivent sous la réponse, repliés. Quelqu'un qui
demande s'il peut donner congé veut d'abord la réponse ; le texte est là pour
celui qui doute, celui qui doit écrire un courrier, et le professionnel qui
engage sa responsabilité.

Au 8 septembre 2026, le corpus tient en **2 133 articles en vigueur** répartis
sur quinze textes — la loi de 1989 et ses deux décrets, la loi de 1965 et le
décret de 1967, la loi Hoguet et son décret, le code de déontologie, et des
parties choisies du code civil, du code de la construction, de l'urbanisme, du
tourisme, des assurances, des procédures civiles d'exécution et du code général
des impôts. Le plus petit domaine (voisinage) en reçoit 165, le plus gros
(urbanisme) 480.

Le corpus est **borné** : un domaine qui dépasse le plafond fait échouer la
construction. Ce n'est pas une limite technique — la fenêtre tiendrait dix fois
plus — mais un spécialiste à qui l'on donne trois cents articles pour en
utiliser deux répond moins bien qu'un spécialiste à qui l'on en donne quarante.
La réponse au plafond est de resserrer la sélection, pas de le relever.

Un dépôt fraîchement cloné n'a pas de `corpus/` : c'est un état normal. Le
spécialiste répond alors comme avant, en nommant les textes sans les numéroter,
et n'affiche aucune source.

### Le spécialiste demande avant de répondre

« Puis-je donner congé ? » n'a pas de réponse : elle en a quatre, selon que le
bail est vide ou meublé et que le congé soit pour vente, pour reprise ou pour
motif légitime. Un assistant qui choisit tout seul l'une des quatre a une
chance sur quatre d'avoir raison, et aucune de le savoir.

Quand la règle applicable dépend d'un fait qui n'a pas été donné, le
spécialiste ne répond donc pas à moitié : il **réclame ce qui manque**, par un
outil (`preciser`) et non par une phrase noyée dans sa réponse. La différence
est visible à l'écran — la question arrive dans son propre encadré, avec ses
réponses en boutons. « Vide » ou « Meublé » se clique ; retapé, le même mot
serait une phrase à interpréter.

Trois garde-fous, parce qu'un assistant qui interroge sans fin est pire que
celui qui devine :

- **une seule question**, celle qui change le plus la réponse ;
- **jamais deux tours de suite** — si la personne ne sait pas, la réponse
  distingue les cas au lieu de redemander. Le bouton « Je ne sais pas » n'est
  pas une réponse de second rang, c'est souvent la vraie ;
- **jamais pour du confort** : une question dont la réponse ne changerait rien
  fait perdre un tour à tout le monde et transforme la conversation en
  formulaire.

Le fil, lui, n'enregistre que du texte. C'est ce qui permet de rouvrir une
consultation six mois plus tard sans dépendre de la forme que l'outil avait ce
jour-là, et de renvoyer l'historique au modèle sans reconstituer un appel
d'outil resté sans réponse. À l'écran, la bulle ne porte que ce qui précède la
question — l'afficher aux deux endroits la ferait lire deux fois.

`lib/precision.ts` est la porte entre les deux : un schéma valide ne garantit
pas une question affichable. Une question vide n'en est pas une, une option
unique n'offre aucun choix, huit options font un formulaire — les trois cas
sont ramenés à quelque chose d'utilisable, et testés.

### Deux choses qu'un professionnel rouvre plusieurs fois par semaine

**L'aide-mémoire.** Chaque spécialité porte, à côté de ses délais, la liste de
ce qu'il faut avoir sous les yeux *avant* d'agir : le mandat numéroté au
registre et son double remis, les trois derniers procès-verbaux d'assemblée et
le pré-état daté, l'attestation décennale valable à la date d'ouverture du
chantier, la date de mise en recouvrement portée sur l'avis. Les délais disent
quand il sera trop tard ; celui-ci dit ce qui manque encore. Il est affiché sur
la fiche, dépliable en tête de conversation, et donné au modèle — avec la
consigne de réclamer la pièce manquante au lieu de supposer qu'elle existe.

**Le tableau des diagnostics.** Douze lignes, leur condition d'exigibilité et
leur durée de validité, plus le calendrier des interdictions de louer selon la
classe énergie. Il vit dans `lib/diagnostics.ts` et non dans la tête du modèle,
et la raison tient en une phrase : une durée de validité est un fait
vérifiable, pas une appréciation. Un modèle qui l'invente produit une réponse
crédible et fausse ; un tableau se relit et se corrige. Il n'est donné qu'aux
quatre spécialités qui le manipulent vraiment — ailleurs il occuperait la
fenêtre sans servir. La règle qui l'accompagne partout : le rapport remis porte
sa propre date de fin de validité, et c'est elle qui fait foi.

### Compte, formules, et le quota qui se voit descendre

Trois formules et pas quatre — au-delà, on ne choisit plus, on hésite. La
médiane est marquée : elle existe autant pour être vendue que pour rendre la
haute lisible. Sans compte, l'assistant répond à trois questions par jour et
par adresse ; un compte gratuit en donne dix par mois et conserve les
consultations ; les formules payantes lèvent la limite et ouvrent le dépôt de
documents.

Le quota se vérifie **avant** l'appel au modèle — refuser après avoir produit
la réponse reviendrait à la facturer sans la rendre — et il se compte en
relisant les messages du mois plutôt qu'en tenant un compteur. Un compteur
peut dériver de la réalité, et il faudrait alors décider laquelle des deux
valeurs fait foi ; ici, effacer une consultation rend vraiment ses questions.
Ce qu'il reste s'affiche sous le champ après chaque réponse : un quota qu'on
découvre au moment où il bloque est une mauvaise surprise, un quota qu'on voit
descendre est une information.

Un compte ne sert qu'à trois choses : retrouver ses consultations passées,
porter une formule, et compter les questions du mois. On n'y range ni
téléphone, ni société, ni adresse — ce qu'on ne demande pas ne fuit pas, et
rien de tout cela ne changerait une réponse de droit.

Les jetons de session portent une **portée** dans leur signature. `AUTH_SECRET`
se recopie d'un déploiement à l'autre ; sans elle, un cookie émis par un autre
service partageant ce secret aurait exactement la forme d'un cookie d'ici, et
ouvrirait une session sur le compte du même identifiant. C'est l'invariant que
vérifie `tests/sessions.test.ts` — et c'est pour pouvoir l'écrire que
`lib/sessions.ts` ne porte pas `server-only` : une barrière qu'on ne peut pas
tester n'est pas une barrière.

**Aucun prestataire de paiement n'est branché**, et le site l'écrit sur les
deux écrans qui proposent une formule. Le changement est immédiat et gratuit.
Simuler une page de carte bancaire pour une caisse qui n'existe pas serait la
seule chose vraiment malhonnête à faire ici. Le jour où `STRIPE_SECRET_KEY`
existe, c'est `changerFormule` dans `app/compte/actions.ts` qui
redirige vers le paiement au lieu d'écrire directement — les formules, les
quotas et leur application sont déjà en place.

### Trois questions posées une fois

À l'ouverture du compte, un écran demande d'où la personne parle : son métier,
le nombre de biens qu'elle suit, ce qu'elle vient chercher. Le socle
distinguait déjà les propriétaires des professionnels, mais il devait le
deviner aux mots employés — deviner marche une fois sur deux, demander marche
à tous les coups.

Tout y est facultatif, et l'écran le dit sans le cacher en gris clair : un
questionnaire qu'on ne peut pas éviter se remplit au hasard, et un profil faux
oriente les réponses dans le mauvais sens pendant des mois. Des cartes
cliquables, pas des menus déroulants : on voit tout d'un coup, et la cible
fait quarante-quatre pixels au doigt.

Le profil est donné au spécialiste **après** le point de mise en cache, et
c'est tout l'intérêt : la consigne du domaine ne change jamais et se facture
une fois, le profil change à chaque personne et n'invalide rien. Il dit d'où
la personne parle, pas ce qui lui arrive — s'il contredit ce qu'elle écrit,
c'est ce qu'elle écrit qui gagne.

### La couche esthétique, et ses quatre partis pris

Ni palette ni fonte nouvelles : les jetons de `globals.css` restent la seule
source de couleur, Inter la seule famille. Ce qui change, c'est la façon de
s'en servir.

1. **Un seul objectif par écran.** Les pages qui portent un seul appel à
   l'action convertissent nettement mieux que celles qui en portent cinq —
   c'est la mesure la plus constante du métier. L'accueil ne propose donc
   qu'une chose : écrire sa question. Formules, compte et fiches sont dans la
   barre, pas dans le chemin.
2. **De l'air, puis du contraste.** Le fond clair domine ; deux moments
   seulement basculent en sombre, la bande de clôture et le pied. Un site
   entièrement sombre fatigue sur des textes longs, un site entièrement clair
   n'a pas de colonne vertébrale.
3. **Le trait plutôt que l'ombre.** Filets fins, bordures nettes, une seule
   ombre franche — sous le champ d'accueil, c'est-à-dire sous la seule chose
   qu'on demande de faire.
4. **Un motif qui dit d'où l'on vient.** Le bandeau porte une trame de lignes
   très pâle : le papier millimétré du dessin d'architecture, seul rappel
   visuel entre cet assistant et les visites 3D qui l'hébergent. Aucune image,
   deux dégradés répétés.

Les cartes de spécialité sont numérotées : dix cartes sans numéro font une
liste, dix cartes numérotées font un sommaire. Et le titre d'accueil est coupé
dans la copie, pas par le navigateur — laissé à `text-wrap: balance`, le point
d'interrogation se retrouvait en début de ligne une fois sur deux.

### Les documents déposés ne sont jamais conservés

On peut joindre un bail, un devis, un procès-verbal d'assemblée, un arrêté —
PDF, photo ou texte, huit mégaoctets. La pièce traverse la mémoire du serveur
le temps de l'appel au modèle, et **rien n'est écrit** : ni sur le disque, ni
dans le bucket, ni en base. Ce qui subsiste dans le fil, c'est le nom du
fichier et la réponse.

C'est un choix, pas un oubli. Ces documents sont parmi les plus sensibles
qu'un propriétaire possède ; les conserver imposerait un chiffrement, une durée
de rétention, une procédure d'effacement et une réponse claire en cas de fuite.
Ne pas les conserver répond à tout cela d'un coup. Le prix — redéposer une
pièce pour la relire plus tard — est assumé.

### L'historique n'existe que pour les comptes

Sans connexion, un fil vit dans l'onglet et disparaît avec lui : aucun
identifiant n'est déposé dans un cookie pour rattacher après coup des questions
sur un impayé ou un contentieux de voisinage. La page le dit au lieu de faire
semblant d'être vide.

Avec un compte, la consultation est enregistrée (`/dossiers`), peut
être reprise avec le même spécialiste, et s'efface d'un bouton — sans boîte de
dialogue intermédiaire. Dès qu'une personne est connectée, **le serveur reprend
le fil dans sa base et ignore ce que le navigateur envoie** : sans quoi il
suffirait de réécrire les réponses précédentes dans la requête pour faire dire
au spécialiste qu'il a déjà validé n'importe quoi.

### Pourquoi la copie des pages vit dans `lib/`

`lib/copie.ts` tient les textes affichés, et ce n'est pas un goût de
l'indirection. La ponctuation double française prend une espace fine
insécable (U+202F) — et U+202F porte la propriété Unicode `White_Space`. Le
texte libre d'un élément JSX est normalisé à la compilation : l'espace fine y
est ramenée à une espace ordinaire, et le navigateur redevient libre de couper
devant le point d'interrogation. Le titre de l'accueil commençait ainsi une
ligne par « ? Elle ira au bon spécialiste ». Dans une chaîne de caractères,
rien n'est normalisé. C'est déjà la raison pour laquelle la copie de
`/residence` vit dans `lib/residence.ts` ; le même test la vérifie des deux
côtés.

### Ce que la page dit d'elle-même

L'accueil porte une section « ce que cet assistant est, et ce qu'il n'est
pas », et chaque page de spécialité rappelle en pied qu'il s'agit d'une
information juridique et non d'une consultation d'avocat, avec le renvoi vers
l'ADIL, les points-justice et l'aide juridictionnelle. Ce n'est pas une mention
légale posée en petit : c'est la seule façon honnête de vendre ce que fait
réellement l'outil.

Même clé que l'assistant des visites : `ANTHROPIC_API_KEY`. Sans elle, les
fiches et les délais restent lisibles — ils ne dépendent d'aucun modèle — et
le composeur s'éteint au lieu de faire semblant d'attendre une question. Un
compteur limite les rafales (huit questions par minute et par adresse).

---
