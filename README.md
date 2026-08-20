# Volume3D

Site et back-office du service de visites virtuelles 3D pour logements Airbnb.

Le service est vendu **au logement, payé une fois** : le lien de visite reste
en ligne sans abonnement ni frais d'hébergement. Chaque client dispose de son
espace, y crée ses biens, et suit ce qu'ils rapportent ; sa formule ne fixe pas
un loyer mensuel mais le nombre de biens qu'il peut tenir.

> Cette phrase disait « vendu par abonnement », et ce n'était pas qu'une
> approximation de rédaction : l'espace client affichait réellement « 29 € /mois »
> et « 79 € /mois » au moment de créer un compte, quand la page d'accueil promet
> le contraire en trois endroits. La contradiction se lisait à l'endroit exact
> où le client s'engage.

| Zone | URL | Qui y accède |
|---|---|---|
| **Accueil** | `/` | Le public. **La page est la visite** : le défilement fait entrer dans le logement. Prise de rendez-vous en bas. |
| **Visite libre** | `/demonstration` | Le public. Le même logement, mais c'est le visiteur qui conduit. |
| **Espace client** | `/espace` | Vos clients, chacun sur ses propres biens. |
| **Back-office** | `/admin` | Vous seul, par mot de passe. Vue sur l'ensemble. |
| **Rendez-vous** | `/admin/rendez-vous` | Vous seul. Ce que le site a pris comme rendez-vous. |
| **Visite publique** | `/v/{slug}` | Les voyageurs, sans compte, avec assistant. |
| **Aperçu de démarchage** | `/demo/{token}` | Un prospect précis, en privé, temporairement. |


---

## L'accueil est la visite

Le premier écran du site n'est pas un argumentaire : c'est un palier d'immeuble,
avec une porte. On fait défiler, la porte s'ouvre, la caméra entre, traverse le
séjour, le dégagement, la chambre, la salle d'eau, et revient. À chaque pièce,
un panneau donne la surface et ce que le relevé permet d'en dire. Le discours
commence en dessous, quand le visiteur sait déjà de quoi on parle.

### Comment c'est fait

Trois fichiers, et la séparation entre eux est le cœur du procédé.

| Fichier | Rôle |
|---|---|
| `lib/journey-path.ts` | **La timeline.** Du calcul pur : un plan entre, une suite de poses de caméra indexées par un curseur `t` sort. Ni DOM, ni WebGL, ni défilement. |
| `components/three/interior.ts` | **Le logement en volume.** Sols, murs percés, plinthes, mobilier, palier, porte, vis-à-vis. Ne connaît ni le scénario ni React. |
| `components/landing/EntranceTour.tsx` | **Le lien entre les deux.** Lit la position dans la page, la transforme en `t`, demande la pose, dessine. |

Ce découpage est ce qui rend la chose testable : `tests/journey-path.test.ts` et
`tests/showcase.test.ts` vérifient sans ouvrir de navigateur qu'à aucun instant
la caméra ne traverse un mur, que les pièces sont visitées dans l'ordre, et que
deux légendes ne se superposent jamais.

### Quatre décisions qui vont à contre-courant

**On ne détourne pas le défilement.** Pas de `preventDefault`, pas de scroll
simulé : la page défile normalement, on se contente de *lire* où elle en est. La
molette garde son inertie, la barre de défilement fonctionne, Espace et les
flèches marchent, la recherche dans la page marche, le lecteur d'écran suit. Les
sites qui reprennent la main sur le défilement gagnent trois pour cent d'effet
et perdent tout le reste.

**L'image suit le curseur avec du retard.** Un amortissement à chaque image,
normalisé sur le temps écoulé — la même douceur à 60 et à 120 images par
seconde. Sans lui, l'image colle à la molette et saccade à chaque cran.

**Position et regard sont deux pistes distinctes.** La position suit une
polyligne dense dont les angles sont arrondis, parcourue à vitesse constante. Le
regard, lui, est fait de temps forts : on entre, on tourne la tête vers ce que la
pièce a de plus parlant, on repart. Tout lisser donnait une caméra qui ralentit à
chaque point de passage ; les garder distinctes donne une marche régulière sous
un regard qui prend son temps.

**Rien ne passe par React pendant le défilement.** Opacités, voile, barre de
progression : tout est écrit directement dans le DOM depuis la boucle de rendu.
Un `setState` par image ferait retomber la page à vingt images par seconde sur un
téléphone.

Et `prefers-reduced-motion` ne dégrade pas : il rend les mêmes textes, dans le
même ordre, lisibles d'un coup, sans WebGL du tout.

### Le parcours n'est écrit nulle part

`buildJourney(rooms, doors)` le fabrique depuis n'importe quel plan relevé :
il repère la porte palière, parcourt le logement en profondeur d'abord — la plus
grande pièce à chaque embranchement, comme on fait visiter — et conserve les
retours, parce qu'il **faut** repasser par le dégagement pour aller de la chambre
à la salle d'eau. Une caméra qui se téléporte détruit en une seconde la
crédibilité du volume.

Deux règles valent d'être signalées, parce qu'elles viennent d'un rendu raté :

- **On ne s'arrête pas au centre d'une petite pièce.** Au milieu d'une salle
  d'eau de trois mètres carrés, la caméra est à quatre-vingt-dix centimètres de
  chaque mur : quelle que soit la direction, l'image est un aplat. En dessous de
  sept mètres carrés, on s'arrête dans l'embrasure et on cadre la pièce entière,
  comme un photographe d'intérieur.
- **On regarde à un mètre soixante devant.** Viser le point de passage suivant
  paraît naturel jusqu'à ce que deux points soient séparés d'un demi-mètre : dans
  un dégagement d'un mètre quarante, la caméra se met alors à fixer le mur
  qu'elle longe.

### Le logement de démonstration

Il vit dans `lib/showcase.ts`, **dans le code et pas dans la base**. La page
d'accueil est la visite : elle ne peut pas dépendre du contenu d'une base qui
peut être vide. Un premier déploiement sur une base neuve montre déjà quelque
chose, et le logement d'un client n'est jamais exposé.

Ce qu'il faut en dire, et que la page dit : les mesures sont **cohérentes de bout
en bout** — surfaces, hauteurs, largeurs d'ouverture, circulation — mais le bien
est **fictif** tant qu'un vrai logement n'a pas été relevé. On vend la fidélité du
volume ; on ne peut pas la revendiquer sur un appartement qui n'existe pas.

`tests/showcase.test.ts` contrôle ce plan à chaque exécution : pièces qui ne se
chevauchent pas, portes qui reposent réellement sur un mur de leurs deux pièces,
ouvertures qui ne dépassent pas la hauteur sous plafond, mobilier qui tient dans
sa pièce, surfaces annoncées égales aux surfaces calculées. Ces contrôles
viennent d'un vrai défaut : une porte déclarée entre le dégagement et la salle
d'eau alors que les deux polygones ne se touchaient pas. La caméra franchissait
vingt centimètres de vide, sans sol ni plafond, et on voyait le ciel au milieu de
l'appartement.

---

## Prendre rendez-vous

Le service est vendu par une personne, pas par une plateforme. Le visiteur
choisit un créneau, laisse un numéro, et il est rappelé. Pas de calendrier
partagé, pas de synchronisation, pas de visioconférence intégrée — trois choses
qui demanderaient un service extérieur et n'apporteraient rien tant qu'il n'y a
qu'un interlocuteur.

- `lib/booking.ts` calcule les créneaux **à l'heure de Paris**, changement d'heure
  compris, à partir de plages ouvertes déclarées jour par jour. Un délai de
  prévenance de trois heures évite de promettre un appel dans dix minutes.
- `app/api/rendez-vous/route.ts` **recalcule la liste des créneaux valables à la
  réception**. Un formulaire n'est jamais une source de vérité : sans ce
  recalcul, on accepterait un rendez-vous à trois heures du matin parce que
  quelqu'un aurait modifié une valeur dans la page.
- Deux compteurs de débit distincts, et c'est délibéré : l'un borne les requêtes,
  l'autre les **réservations abouties**. Avec un compteur unique, quelqu'un qui se
  trompe quatre fois d'adresse e-mail se retrouvait interdit de réservation
  pendant dix minutes.
- Quand un créneau vient d'être pris entre l'affichage et l'envoi, le serveur
  répond 409 **avec la liste à jour**, et le formulaire la réaffiche aussitôt.
  C'est la différence entre une course perdue et une page cassée.

> **Aucun e-mail n'est envoyé.** Il n'y a pas d'expéditeur configuré dans ce
> projet, et la page ne promet donc pas de confirmation. `/admin/rendez-vous` est
> le seul endroit où l'on voit les demandes arriver — la page le dit, et le
> message de confirmation aussi. Annuler un rendez-vous y libère immédiatement le
> créneau côté public.

---

## Démarrage en local

```bash
npm install
cp .env.example .env.local     # puis renseignez ADMIN_PASSWORD et AUTH_SECRET
npm run dev
```

Le site tourne sur <http://localhost:3000>, le back-office sur `/admin`.

Sans configuration Supabase, tout est enregistré dans le dossier `.data/` du
projet : c'est prévu pour développer sans rien installer d'autre. Les données y
sont locales à votre machine et ne partent jamais en ligne.

Commandes utiles :

```bash
npm run dev        # serveur de développement
npm run build      # compilation de production
npm run test       # tests unitaires (géométrie 360°, validation, sécurité des chemins)
npm run typecheck  # vérification des types
npm run verify     # les trois ci-dessus qui n'ont besoin de rien d'autre
```

Trois autres commandes ne vérifient pas du code mais des **images**, et elles
sont le contrôle qualité réel de ce projet. Les deux dernières demandent un
serveur en marche, parce qu'elles mesurent ce que le navigateur affiche pour de
bon — pas ce que la feuille de style annonce.

```bash
npm run palette    # l'étude de couleur : écart entre surfaces voisines, harmonie des teintes
BASE=http://localhost:3000 npm run contraste   # contraste au pixel des légendes et de la barre
BASE=http://localhost:3000 npm run budget      # appels de rendu, triangles, temps par image
```

Chacune est née d'un défaut qu'aucune relecture n'avait vu : un rideau
indiscernable du mur derrière lui, un libellé de navigation à 2,8:1 sur un mur
en plein soleil, une scène partie de trois cent soixante-seize appels de rendu.
Elles sont dans le dépôt pour que ces défauts ne reviennent pas sans qu'on le
sache.

> Il n'y a pas de `npm run lint` : le script hérité du gabarit Next.js appelait
> `next lint`, déprécié, sans qu'ESLint soit installé ni configuré — il ouvrait
> une invite interactive et bloquait toute exécution non surveillée. Un contrôle
> qui ne peut pas tourner vaut moins que pas de contrôle du tout, parce qu'on
> croit l'avoir.

---

## Le parcours, de bout en bout

1. **Vous scannez le logement sur place.** Une photo panoramique 360° par pièce.
2. **Vous créez le logement** dans `/admin` et vous **envoyez les panoramas**.
   Sélectionnez tous les fichiers d'un coup : chaque image devient une pièce,
   nommée d'après son fichier — `salon.jpg` donne « Salon ». Les images sont
   recompressées automatiquement (largeur ramenée à 4096 px, JPEG progressif,
   métadonnées EXIF supprimées avec la position GPS du logement).
3. **Vous reliez les pièces** : dans l'éditeur, choisissez « Ajouter un passage
   vers… », puis cliquez dans l'image à l'endroit exact où le visiteur devra
   cliquer pour s'y rendre.
4. **Vous publiez.** Le lien `/v/{slug}` devient actif.
5. **Vous envoyez le lien au propriétaire**, avec le code d'intégration si son
   site peut l'accueillir.

### Comment obtenir des panoramas 360°

Le viewer attend des images **équirectangulaires**, au rapport **2:1**
(par exemple 4096 × 2048 px). Deux façons d'en produire :

- **Gratuit** — l'application **Google Street View** (ou toute app « Photo
  Sphere ») : vous tournez sur vous-même en suivant les pastilles, l'app
  assemble la sphère. Comptez ~2 minutes par pièce.
- **~350 €** — une caméra **Insta360** ou **Ricoh Theta** : une pression, une
  sphère complète, 10 secondes par pièce, et une qualité nettement supérieure.

Une photo classique, même très grand angle, ne convient pas : il manque
l'information sur les 360° et le viewer l'étirerait n'importe comment.

### Les formats de visite

Un logement n'est **pas cantonné à un seul format**. Renseignez-en plusieurs et
le voyageur bascule de l'un à l'autre grâce aux onglets en haut de la visite ;
le champ « Format ouvert par défaut » de la fiche décide seulement lequel
s'affiche en premier. La combinaison la plus efficace est **panoramas + vidéo** :
la vidéo accroche, la 360° rassure.

Quatre formats sont disponibles :

- **Panoramas 360°** — le cas nominal, hébergé chez vous, décrit ci-dessus. Le
  visiteur explore : il tourne la tête, il choisit où aller.
- **Vidéo walkthrough** — une déambulation filmée au téléphone en marchant
  lentement dans le logement. C'est le format des visites qu'on voit passer sur
  les réseaux : plus spectaculaire, plus facile à produire. Ajoutez des
  **repères** (« Chambre — 1:20 ») depuis la fiche du bien : le visiteur saute
  directement à la pièce qui l'intéresse au lieu de tâtonner dans la barre de
  lecture. Sans eux, une vidéo ne se parcourt pas.
- **Modèle 3D `.glb`** — pour un logement capturé en photogrammétrie avec
  Polycam ou Luma. Envoyez l'export `.glb` ; au-delà de ~60 Mo le chargement
  devient pénible sur mobile.
- **Plan 3D** — pour un logement dont on n'a pas de panorama. On lit le plan,
  on en tire le volume, et les photos du propriétaire viennent s'accrocher sur
  les murs qu'elles montrent. Voir la section dédiée plus bas.
- **Viewer externe** — collez un lien Matterport ou Cupix : la page de visite
  garde votre habillage et affiche leur viewer à l'intérieur.

---

## L'espace client

Un client crée son compte sur `/espace`, choisit sa formule, puis travaille
dans quatre onglets :

- **Tableau de bord** — vues cumulées, visites en ligne, questions posées à
  l'assistant, vues moyennes par visite, et le classement des questions les plus
  fréquentes. Ces questions sont la donnée la plus utile du produit : elles
  disent noir sur blanc ce que l'annonce n'explique pas.
- **Mes biens** — la liste, avec vignette, statut et nombre de vues.
- **Création** — nom, ville, **description** et **photos** du bien. La visite
  360° ou la vidéo s'ajoutent ensuite dans la fiche.
- **Mon compte** — coordonnées et formule.

Les formules limitent le nombre de biens : Essentiel 1, Pro 5, Conciergerie
illimité. Aucun paiement n'est encaissé par l'application — la limite sert à
cadrer l'usage, la facturation reste à mettre en place de votre côté.

**Cloisonnement.** Chaque action portant sur un bien vérifie qu'il appartient
au compte connecté ; un bien d'un autre client répond 404, y compris en tapant
son adresse directement. L'administrateur, lui, voit et modifie tout.

---

## L'assistant des visites

Sur chaque page de visite, un bouton « Une question sur ce logement ? » ouvre un
assistant qui répond aux voyageurs à partir de la description, du nom des
pièces, des repères vidéo, des légendes de photos et de la **fiche du logement**
renseignée par le propriétaire. Il tourne sur l'API Claude (`claude-opus-5`).

Ce qu'il ne fait pas, volontairement :

- **Il n'invente rien.** Une information absente de la fiche est annoncée comme
  absente, avec renvoi vers le propriétaire. Un voyageur qui réserve sur une
  réponse fausse se retourne contre l'annonce.
- **Il ne déduit pas.** « Chambre 2 » ne prouve pas qu'il y a deux lits.
- **Il n'engage rien** : ni réservation, ni modification, ni transmission de
  message.

Chaque question est enregistrée et remonte dans le tableau de bord du client.
Un compteur limite les rafales (8 questions par minute et par visiteur) pour
que le budget d'API ne parte pas d'un coup.

Activez-le avec `ANTHROPIC_API_KEY` dans les variables d'environnement. Sans
clé, le bouton ne s'affiche pas et le reste du site fonctionne normalement.

---

## Les aperçus de démarchage

Le back-office permet de générer, à partir des **photos publiques de l'annonce
d'un prospect**, un aperçu de ce que donnerait une visite. L'IA prolonge chaque
photo au-delà de son cadre.

Ces images sont **partiellement inventées**. Le code impose donc trois
garde-fous :

1. **Filigrane « Aperçu simulé »** incrusté par-dessus le rendu, et bandeau
   d'avertissement en haut de page — sans variante sans avertissement.
2. **Lien privé** : jeton non devinable, `noindex`, exclu de `robots.txt`,
   **expiration automatique au bout de 30 jours**.
3. **Séparation stricte** : les aperçus vivent dans leurs propres tables
   (`previews`, `previewShots`) et sur `/demo/{token}`. Aucun chemin de code ne
   transforme un aperçu en visite publiée — il faut un vrai scan sur place.

Montrez-les au propriétaire, jamais à un voyageur, jamais sur une annonce. Une
visite qui ne correspond pas au logement se retourne contre l'annonce, et
Airbnb exige des visuels fidèles.

Sans clé d'API image configurée, la fonction reste utilisable : l'aperçu montre
les photos d'origine dans l'habillage Volume3D, sans rien inventer.

---

## La version autonome : `standalone/volume3d.html`

Un seul fichier, sans installation ni serveur. Il s'ouvre par double-clic,
fonctionne **sans réseau**, et se dépose tel quel sur n'importe quel
hébergement. C'est la vitrine à sortir en rendez-vous.

Il n'est pas écrit à la main : `npm run standalone` **extrait le site en
fonctionnement** — le HTML que le serveur rend, la feuille de style qu'il sert,
les images et la vidéo — et remplace chaque adresse de fichier par son contenu.
Ce qu'on montre au propriétaire ne peut donc pas diverger du produit.

Quatre écrans, atteignables par la barre en bas : l'accueil, la visite
publique, le tableau de bord du client, et la fiche d'un bien.

> **Le fichier versionné date d'avant la nouvelle page d'accueil.** Il montre
> l'ancien accueil, pas la visite au défilement — et c'est une limite du procédé
> plus qu'un oubli : l'extraction fige le HTML et les feuilles de style d'une
> page, or la nouvelle entrée est une scène WebGL pilotée par la position dans
> le document. Il faudrait embarquer le moteur, pas une capture. Relancez
> `npm run standalone` quand vous en aurez besoin en rendez-vous ; le résultat
> restera une démonstration des écrans, pas de l'entrée.

Ce qui **fonctionne vraiment** dedans, pas en image :

- **Le viewer 360°** — rotation, zoom, changement de pièce, points de passage
  cliquables. Le rendu passe par un shader d'une vingtaine de lignes qui, pour
  chaque pixel, calcule la direction du regard et va lire la couleur
  correspondante dans l'image équirectangulaire. Embarquer un moteur 3D complet
  coûterait un mégaoctet et ne ferait rien de plus.
- **La marche dans le volume reconstruit depuis le plan** — murs percés par les
  ouvertures, photos accrochées sur les murs qu'elles montrent, ciel visible par
  les fenêtres. Les règles de déplacement sont celles de `lib/plan.ts`, portées
  à l'identique : marge de 35 cm, glissement le long des murs, avancée jusqu'au
  point atteignable.
- **La vidéo walkthrough**, embarquée dans le fichier.
- **L'assistant**, hors ligne. Il répond à partir de la description, du relevé
  du plan et des pièces — et **annonce comme absent** ce qui n'y figure pas,
  exactement comme la version en ligne. Aucune supposition.
- **Le questionnaire** de la fiche d'un bien. Chaque réponse met à jour, en
  direct, le bloc « ce qu'il reste à faire » et la bande d'avancement.

Trois limites, inhérentes à un fichier sans serveur :

1. **Rien n'est enregistré**, sauf les réponses du questionnaire, gardées dans
   le navigateur de l'appareil. Un bandeau le dit en haut de l'écran.
2. **On ne crée pas de visite dedans.** C'est une démonstration du produit, pas
   une version réduite du produit : ni envoi de panorama, ni relevé de plan, ni
   lien public à envoyer à un propriétaire.
3. **Le fichier pèse environ 8 Mo.** Ce sont les panoramas, les photos et la
   vidéo, tous embarqués. C'est le prix du « fonctionne sans réseau ».

Pour le régénérer (Playwright requis, ce n'est pas une dépendance du site) :

```bash
npm run build && npm run start &     # le générateur lit le site en marche
npm run standalone
```

Variables utiles : `V3D_BASE` (adresse du site, `http://localhost:3000` par
défaut), `V3D_EMAIL` / `V3D_PASSWORD` (le compte client dont on extrait
l'espace), `V3D_CHROMIUM` (chemin du navigateur, quand il n'est pas là où
Playwright l'attend), `V3D_DEST` (fichier de sortie).

---

## Une visite à partir du plan et des photos

Le cas est fréquent : le propriétaire n'a pas de panorama 360°, mais il a **son
plan** et **ses photos**. Ces deux documents se complètent exactement.

- Le **plan** contient la géométrie : la forme des pièces, leurs dimensions, où
  sont les portes. C'est ce qu'une photo ne contient jamais.
- Les **photos** contiennent l'apparence : les couleurs, les matières, le
  mobilier. C'est ce qu'un plan ne contient jamais.

Assemblés, ils donnent un volume parcourable où **rien n'est inventé**. Ce n'est
pas une photo à 360°, et la page de visite ne le prétend pas : c'est le logement
en volume, avec ses vraies photos posées aux bons endroits.

### Comment ça marche

1. Dans la fiche du bien, section **« Visite depuis le plan »**, envoyez l'image
   du plan et indiquez la **surface annoncée**.
2. Le modèle relève le plan : contour de chaque pièce en mètres, position des
   portes et des fenêtres. Il ne dessine rien — il transcrit ce qui est sur
   l'image, et signale quand le document n'est pas un plan.
3. La surface que vous avez indiquée sert de **mètre étalon** : les proportions
   viennent du plan, l'échelle vient de vous. Un plan sans cotes lisibles reste
   donc à la bonne taille.
4. **Vous relisez.** Les surfaces obtenues s'affichent pièce par pièce. Tant que
   vous n'avez pas confirmé, le format n'apparaît pas dans la visite —
   `loadPlan()` ne sert que les plans confirmés.
5. Bouton **« Ranger les photos dans les pièces »** : le modèle regarde vos
   photos et dit laquelle montre quoi. Une photo qu'il ne sait pas rattacher
   reste sans pièce plutôt que d'être placée au hasard.

Dans la visite, le visiteur ne saute pas de point de vue en point de vue : il
**marche**. Au doigt sur mobile, aux flèches ou en ZQSD au clavier. Les murs
l'arrêtent (`canStandAt` impose 35 cm de marge), et un déplacement qui buterait
contre un mur **glisse le long** au lieu de se bloquer net (`slideMove`) — c'est
la différence entre une pièce qu'on explore et une pièce où l'on se coince dans
les angles. Un appui derrière un mur avance aussi loin que possible dans cette
direction plutôt que de ne rien faire (`reachableToward`). Ces trois fonctions
sont pures et testées dans `tests/plan.test.ts`.

### Ce qui protège la fiabilité

Une lecture automatique se trompe. Trois filtres, dans cet ordre :

| Où | Quoi |
|---|---|
| `lib/plan.ts` — `parsePlanReading` | Le JSON du modèle est validé champ par champ. Hauteur aberrante ramenée au standard, identifiants normalisés, passage vers une pièce inexistante coupé. |
| `lib/plan.ts` — `assertPlanIsUsable` | Refus pur et simple : pièce de moins d'un m², contour à deux points, porte de six mètres, identifiants en double. |
| L'écran de relecture | Le propriétaire confirme, ou ne confirme pas. C'est lui qui connaît son logement. |

Ces deux premières fonctions sont **pures** — pas de réseau, pas de rendu — et
couvertes par les tests (`tests/plan.test.ts`, `tests/plan-reader.test.ts`).
C'est volontaire : l'appel au modèle n'est qu'un transport, alors que c'est là
que se décide si une géométrie est publiable.

### Un point de géométrie

Le viewer perce les murs plutôt que de poser des portes dessus. Pour chaque mur,
les ouvertures sont projetées dessus (`projectOnWall`), fusionnées, puis les
**portions pleines** sont calculées par complément (`solidSpans`). Le linteau et
l'allège sont ajoutés par-dessus. C'est ce qui permet à une porte déclarée une
seule fois de percer les deux pièces qu'elle sépare, sans qu'on ait à la
déclarer deux fois.

---

## Le dossier : où j'en suis, ce qui manque, et la fiche

Un propriétaire qui envoie son plan et ses photos ne sait pas s'il en a envoyé
assez. La fiche du bien répond à cette question à trois endroits : une bande
d'avancement en haut de page, puis **ce qu'il reste à faire**, puis **les
questions**.

### Le parcours

`lib/journey.ts` dérive de l'état du dossier — jamais stocké — les étapes
franchies et celle en cours : **le logement → la visite → les photos → la
vérification → la fiche → la publication**. Sous les étapes, une phrase dit
l'action précise, pas un pourcentage : « Prochaine étape — la vérification :
il manque une photo pour le dégagement. »

Deux principes :

- **Rien n'est verrouillé.** La bande n'est pas cliquable et n'impose aucun
  ordre : tout reste modifiable plus bas dans la page. Une bande qui
  prétendrait naviguer promettrait un cheminement que l'éditeur n'impose pas.
- **Deux routes mènent à une visite publiable** — des panoramas 360° (ou une
  vidéo, un modèle, un viewer externe), ou un plan relevé et des photos.
  L'étape de vérification ne concerne que la seconde : elle n'apparaît au
  parcours que si un plan existe.

### Le contrôle de complétude

`lib/intake.ts` compare ce que le plan annonce à ce qui a été reçu. C'est
**déterministe** — aucun appel à un modèle, donc aucun « il manque peut-être
quelque chose ». Chaque manque a un code stable et un message qui dit quoi
faire :

| Code | Ce que voit le propriétaire | Gravité |
|---|---|---|
| `plan-manquant` | « Envoyez le plan du logement : c'est lui qui donne les dimensions de chaque pièce. » | bloquant |
| `photos-manquantes` | « Ajoutez au moins une photo par pièce : Séjour, Chambre, Cuisine. » | bloquant |
| `piece-sans-photo` | « Il manque une photo pour **la chambre**. » — un message par pièce, nommée | bloquant |
| `aucun-passage` | « Aucun passage n'a été trouvé entre les pièces : le visiteur ne pourrait pas circuler. » | bloquant |
| `plan-non-confirme` | « Relisez les dimensions relevées, puis confirmez le plan. » | bloquant |
| `photos-non-rattachees` | « 2 photos ne sont rattachées à aucune pièce : elles n'apparaîtront pas dans la visite. » | conseil |

Deux détails qui changent l'usage : les **placards et pièces de moins de 2 m²**
ne réclament pas de photo — personne ne visite un placard —, et l'article suit
le genre du nom (« **la** salle d'eau », « **le** bureau »). Un message qui
écorche le français fait douter du reste.

### La fiche du logement

`lib/facts.ts` tient un catalogue de dix questions, séparées selon une ligne
nette : ce qu'une photo **peut** montrer (meublé ou non, douche ou baignoire,
équipements, luminosité) et ce qu'elle **ne peut pas** (l'adresse, les écoles
du quartier, le nombre de couchages, ce qui rend le logement différent).

Le bouton **« Pré-remplir depuis les photos »** envoie les photos au modèle,
qui ne répond qu'aux premières (`lib/facts-reader.ts`). Il lui est demandé
explicitement de **laisser vide plutôt que de deviner** : une case vide se
corrige en un clic, une réponse fausse se découvre à l'arrivée du voyageur.

Trois règles tiennent l'ensemble :

1. **Une réponse d'IA est marquée `source: 'ia'`** et porte l'étiquette
   « Proposé » à l'écran. Tant qu'elle n'est pas enregistrée par le
   propriétaire, `factsForAssistant` et `factsForDescription` l'ignorent : elle
   n'atteint **ni la présentation publique, ni l'assistant des visites**.
2. **Le propriétaire l'emporte toujours.** `mergeFacts` refuse qu'une lecture
   automatique écrase une réponse humaine, même postérieure.
3. **Hors catalogue, rien ne passe.** `parseFactAnswers` rejette une clé
   inventée et une option qui n'est pas dans la liste, plutôt que de la
   déformer pour la faire rentrer.

Les réponses confirmées nourrissent l'assistant : c'est ce qui lui permet de
répondre « oui, il y a un lave-linge » au lieu de renvoyer vers le
propriétaire. Couvert par `tests/intake.test.ts`, `tests/facts.test.ts` et
`tests/journey.test.ts`.

---

## Ce que les voyageurs regardent

Le tableau de bord savait compter les ouvertures d'une visite. Il ne savait pas
dire **ce qui retient l'attention**, et c'est pourtant la seule donnée sur
laquelle un propriétaire peut agir : si quatre visiteurs sur cinq ne dépassent
jamais le séjour, ce n'est pas la chambre qui est en cause, c'est le passage
qui y mène.

### Le parti pris : agréger à l'écriture

Il n'existe **aucune ligne par visiteur, ni même par session**. Le navigateur
envoie des durées, le serveur les ajoute à un compteur par logement, par jour
et par pièce. Trois conséquences, toutes voulues :

- **Rien de personnel n'est jamais enregistré.** Pas d'identifiant, pas de
  cookie, pas d'adresse IP. Il n'y a donc rien à anonymiser, rien à purger, et
  rien à déclarer — ce qui, pour un service vendu à des propriétaires français,
  se dit en une phrase.
- **La table ne grossit pas avec le trafic**, seulement avec les jours et les
  pièces. Mille visiteurs coûtent autant de place qu'un seul.
- **On perd le détail par visiteur.** C'est le prix, assumé : ce détail ne
  servirait à rien à un propriétaire, et beaucoup à qui voudrait profiler ses
  voyageurs.

### Côté visiteur

Une horloge par pièce, qui ne tourne que pendant que la pièce est affichée
**et** que l'onglet est au premier plan — sans quoi la « pièce la plus
regardée » serait celle sur laquelle on part déjeuner. L'envoi part une seule
fois, quand la page disparaît, par `sendBeacon` : ni requête à chaque
changement de pièce, ni battement régulier.

### Côté serveur : un point d'entrée public tenu court

`/api/attention` n'est pas authentifié — un voyageur n'a pas de compte. Tout ce
qui arrive est donc traité comme hostile :

| Barrière | Ce qu'elle arrête |
|---|---|
| La visite doit exister et être publiée | Un identifiant inventé n'écrit rien |
| Les identifiants de pièce viennent de la base, jamais du corps de la requête | Une pièce inventée pour gonfler un compteur |
| Durée au-delà du **double** de la borne : écartée, pas ramenée | Un lot forgé qui se ferait créditer le maximum à chaque envoi |
| Plafond appliqué **après** fusion des entrées | Le contournement par découpage d'une longue durée |
| Débit limité par logement et par adresse | Les rafales |
| Réponse toujours `200`, quoi qu'il arrive | Le sondage de la base par les codes d'erreur |

Six attaques passées sur le point d'entrée — pièce inventée, visite
inexistante, durée forgée, corps informe, JSON cassé, corps énorme — n'ont
rien écrit.

### Ce qui s'affiche

Un graphique ne dit pas quoi faire : la phrase du haut porte la conclusion, les
barres ne servent qu'à la vérifier. Et **tant que le nombre de visites ne
permet pas de conclure, on le dit** au lieu d'afficher une tendance tirée de
trois visiteurs.

Le seuil de « déséquilibre » suit la part équitable — `1/n` — et non un 50 %
fixe : sur un logement de deux pièces, l'une dépasse forcément la moitié, et
signaler cela comme une anomalie décrédibiliserait tout le reste.

---

## Ce que le propriétaire emporte pour son annonce

Le plan et la fiche servaient jusqu'ici au produit lui-même. Ils contiennent
pourtant tout ce qu'il faut pour **rédiger l'annonce** — la surface mesurée, le
nom des pièces, les équipements, le quartier. Le bloc « À publier sur votre
annonce », en bas de la fiche d'un bien, le lui rend sous une forme
directement utilisable.

### Le plan redessiné

`lib/floorplan-svg.ts` reprend la géométrie du relevé et la dessine aux
conventions du dessin d'architecture : murs épais percés par les ouvertures,
portes en arc de battement, fenêtres en trait fin double, nom et surface de
chaque pièce, échelle d'un mètre. Le propriétaire le télécharge en SVG et le
dépose dans les photos de son annonce — Airbnb affiche les plans, et un plan
net répond à la moitié des questions avant qu'on les pose.

Deux détails qui font la différence entre un plan lisible et un plan raté :

- **Les murs sont percés, pas recouverts.** Les ouvertures sont projetées sur
  chaque mur puis les portions pleines calculées par complément — le même
  `solidSpans` que le viewer 3D. Une porte déclarée une fois perce les deux
  pièces qu'elle sépare.
- **La taille du libellé suit la largeur de la pièce.** Un dégagement fait
  1,40 m de large ; un nom à taille fixe en dépasse et va mordre sur la pièce
  voisine, ce qui se lit comme une erreur de relevé.

Le plan n'apparaît qu'une fois le relevé **confirmé** : un relevé non relu n'a
rien à faire sur une annonce publique.

### L'annonce rédigée

`lib/listing.ts` assemble un titre, une description, des points forts et le
message à envoyer au voyageur. Deux règles le tiennent :

1. **Rien n'est inventé.** Chaque phrase vient d'une réponse confirmée par le
   propriétaire ou d'une mesure prise sur le plan. Une réponse encore marquée
   `source: 'ia'` est ignorée — comme partout ailleurs dans ce projet.
2. **Aucun modèle n'est appelé.** Le texte est assemblé par des règles : il
   fonctionne sans clé d'API, et rend deux fois le même résultat pour le même
   dossier. C'est ce qu'on attend d'un outil, pas d'un générateur.

Ce que ça implique en pratique :

| Contrainte | Ce que le code en fait |
|---|---|
| Airbnb coupe le titre à 50 caractères | Le titre empile typologie, luminosité, surface et lieu, et s'arrête avant la limite plutôt que d'être tronqué en plein mot. |
| Airbnb filtre les liens externes des descriptions | Le lien de la visite n'apparaît **que** dans le message au voyageur, à envoyer par la messagerie une fois le contact établi. |
| « à Le Marais » disqualifie un texte français | `atPlace` fait la contraction : au, aux, à la, à l'. |
| Personne ne réserve pour un couloir | Les pièces de circulation sont relevées, dessinées sur le plan, mais tues dans le texte. |
| « Métro Saint-Paul » est un nom propre | Le texte libre du propriétaire garde sa casse. |

La typologie suit l'usage français : `T2` compte les pièces principales — le
séjour et les chambres — et laisse de côté cuisine, salle d'eau et
dégagements.

Enfin, le bloc dit **ce qui manque** pour faire mieux : sans nombre de
couchages, sans équipements, sans ce qui rend le logement différent, l'annonce
sort moins dans les filtres. Couvert par `tests/floorplan-svg.test.ts` et
`tests/listing.test.ts`.

---

## Mise en ligne

### 1. Base de données et stockage (Supabase, offre gratuite)

1. Créez un compte sur <https://supabase.com> et un projet.
2. **SQL Editor → New query** : collez le contenu de
   [`supabase/schema.sql`](supabase/schema.sql), puis **Run**.
3. **Storage → New bucket** : nom `tours`, cochez **Public bucket**.
   Il doit être public : les panoramas sont chargés directement par le
   navigateur des voyageurs.
4. **Settings → API** : relevez l'URL du projet et la clé **`service_role`**.

### 2. Déploiement (Vercel, offre gratuite)

1. Poussez ce dépôt sur GitHub.
2. Sur <https://vercel.com>, **Add New → Project**, importez le dépôt.
3. **Settings → Environment Variables**, ajoutez :

   | Variable | Valeur |
   |---|---|
   | `ADMIN_PASSWORD` | votre mot de passe de back-office |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `SUPABASE_URL` | l'URL du projet Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | la clé `service_role` |
   | `SUPABASE_BUCKET` | `tours` |
   | `NEXT_PUBLIC_SITE_URL` | l'URL finale du site |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | votre email de contact |
   | `ANTHROPIC_API_KEY` | pour l'assistant des visites |
   | `GOOGLE_AI_API_KEY` | facultatif, pour les aperçus IA |

4. **Deploy**. Connectez ensuite votre nom de domaine dans **Settings → Domains**.

> La clé `service_role` contourne toutes les règles d'accès de Supabase. Ne la
> préfixez jamais `NEXT_PUBLIC_` et ne la collez jamais dans du code client.

---

## À savoir sur Airbnb

Airbnb filtre les liens externes dans les annonces (titre, description,
messages automatiques). Un lien `volume3d.fr` placé dans une description a de
bonnes chances d'être supprimé, voire de faire signaler le compte du
propriétaire.

Là où le lien fonctionne en pratique : la **messagerie** avec le voyageur une
fois le contact établi, le **site personnel** du propriétaire, **Booking** et
**Abritel** (plus permissifs), un **QR code** dans le logement, les emails de
confirmation. La landing est rédigée dans ce sens — elle ne promet pas une
intégration directe dans l'annonce Airbnb.

---

## Organisation du code

```
app/
  globals.css                  jetons de design et primitives partagées
  fonts.css                    @font-face de la fonte auto-hébergée (généré)
  layout.tsx                   coquille HTML, métadonnées, préchargement de la fonte
  page.tsx                     accueil : la visite au défilement, puis l'offre et le rendez-vous
  demonstration/page.tsx       visite libre, conduite par le visiteur
  landing.css                  feuille des pages publiques
  v/[slug]/                    visite publique (panoramas, vidéo, modèle 3D ou embed)
  demo/[token]/                aperçu de démarchage, filigrané et temporaire
  espace/                      espace client : tableau de bord, biens, création, compte
  admin/
    actions.ts                 toutes les écritures (Server Actions, session vérifiée)
    page.tsx                   tableau de bord interne
    logements/[id]/            éditeur de visite
  editor.css                   éditeur de visite, partagé admin / espace client
    rendez-vous/               les rendez-vous pris depuis le site
  api/chat/                    assistant du voyageur (Claude)
  api/contact/                 réception du formulaire
  api/rendez-vous/             réservation d'un créneau, et liste des créneaux libres
  api/files/[...path]/         service des fichiers en développement
components/
  three/interior.ts            le logement en volume : murs percés, mobilier, palier, porte
  landing/EntranceTour.tsx     l'accueil : le défilement fait la visite
  FreeTour.tsx                 la visite libre : le visiteur conduit
  BookingForm.tsx              choix d'un créneau et coordonnées
  PanoViewer.tsx               viewer 360° : rotation, zoom, passages, plein écran
  PlanViewer.tsx               viewer du volume reconstruit depuis un plan
  PlanPanel.tsx                relevé du plan et relecture, dans l'éditeur
  FactsPanel.tsx               ce qu'il reste à faire, et la fiche du logement
  JourneyBar.tsx               bande d'avancement en haut de la fiche d'un bien
  PublishKit.tsx               le plan et les textes à emporter sur l'annonce
  AttentionPanel.tsx           les pièces regardées, dans le tableau de bord
  TourStage.tsx                choix du format et chapitres de la vidéo
  ModelViewer.tsx              viewer de modèle .glb
  ChatWidget.tsx               assistant posé sur la visite
  landing/                     SiteNav, DemoTour, DemoVideo, Reveal, icônes
lib/
  journey-path.ts              la timeline de l'accueil : plan → poses de caméra indexées par t
  showcase.ts                  le logement de démonstration, dans le code et non dans la base
  booking.ts                   créneaux à l'heure de Paris, contrôle serveur, formatage
  plan.ts                      géométrie des visites depuis un plan, marche, validation du relevé
  plan-reader.ts               lecture du plan et rattachement des photos (Claude, vision)
  intake.ts                    contrôle de complétude du dossier, sans appel à un modèle
  journey.ts                   étapes du dossier, de la création à la publication
  attention.ts                 ce que les voyageurs regardent, agrégé à l'écriture
  attention-client.ts          l'horloge par pièce, côté visiteur
  floorplan-svg.ts             le plan redessiné, à joindre à l'annonce
  listing.ts                   titre, description et message, déduits du dossier
  facts.ts                     catalogue des questions, arbitrage propriétaire / IA
  facts-reader.ts              pré-remplissage de la fiche depuis les photos (Claude, vision)
  demo.ts                      pièces et points de passage de la démonstration publique
  store.ts                     accès aux données (fichier JSON en dev, Supabase en prod)
  accounts.ts                  comptes clients, mots de passe, sessions
  assistant.ts                 invite système de l'assistant, garde-fous
  storage.ts / paths.ts        envoi de fichiers et sécurité des chemins
  sphere.ts                    conversions yaw/pitch ↔ vecteurs
  ai-preview.ts                extension IA des photos (aperçus uniquement)
scripts/
  generate-demo.mjs            prépare public/demo/*.jpg depuis les sources CC0
  record-demo.mjs              filme la visite réelle, écrit public/demo/visite.*
  standalone/                  génère standalone/volume3d.html depuis le site en marche
    extract.mjs                relève le HTML rendu, la feuille de style, les fichiers
    assemble.mjs               recolle le tout en un seul fichier
    app.js                     viewer 360° et marche dans le volume, en WebGL nu
    wire.js                    rebranche les boutons que React animait
public/
  fonts/                       Inter en woff2 (latin + latin-ext)
  demo/                        panoramas, vidéo et vignette de la démonstration
supabase/schema.sql            schéma à exécuter une fois
```

### La palette, et pourquoi celle-là

Elle a été refaite après un audit chiffré, pas au jugé. Trois constats :

1. **L'accent et les neutres partageaient la même teinte** — tout était entre
   h207 et h220, l'accent n'étant qu'un bleu plus saturé. Rien ne se détachait
   de rien, et l'ensemble lisait « gabarit par défaut ».
2. **`--ink-faint`, qui porte toutes les mentions, ne tenait que 3,35** sur
   blanc, sous le seuil AA de 4,5.
3. **Le back-office était resté sur la palette « hôtellerie »** — ocre, brun,
   crème — abandonnée sur la page publique. Les deux moitiés du produit ne se
   ressemblaient plus.

D'où la direction : **neutres chauds très désaturés** — le papier d'une agence
— et un **accent pétrole** froid. C'est l'appariement du dessin
d'architecture, encre bleu-vert sur papier, et il éloigne des bleus de Booking
et de Matterport sans partir dans le décoratif. Les deux familles de teinte
sont franchement séparées : 149° d'écart, contre 5° auparavant.

Quelques valeurs, mesurées :

| Rôle | Valeur | Contraste |
|---|---|---|
| `--ink` sur blanc | `#272320` | 15,6 — AAA |
| `--ink-faint` sur `--bg-alt` | `#726b60` | 4,9 — AA (contre 3,3 avant) |
| `--accent` sur blanc | `#0e6e66` | 6,1 — AA |
| blanc sur `--accent` | | 6,1 — le même ton sert au lien et au bouton plein |
| `--accent-on-dark` sur `--dark` | `#4fb3a6` | 6,7 — le pétrole profond y tombait à 2,8 |
| `--line-strong` sur blanc | `#948d7f` | 3,3 — seuil exigé pour la limite d'un contrôle |

Trois règles tiennent l'ensemble :

- **Un seul accent, réservé à ce sur quoi on peut agir.** Les couleurs de sens
  — `--positive`, `--warning`, `--danger` — sont distinctes et ne servent
  jamais d'accent : une couleur qui veut dire deux choses ne veut plus rien
  dire.
- **Aucune couleur codée en dur** hors de `:root`. Feuilles de zone, modules
  CSS et styles en ligne passent tous par un jeton — c'est ce qui avait laissé
  le back-office et le widget d'assistant sur l'ancienne palette.
- **Le contraste se mesure sur le rendu, pas dans la feuille.** Un script
  parcourt chaque page, relève la couleur effective de chaque texte visible et
  celle du premier ancêtre qui peint un fond, applique la composition alpha, et
  compare au seuil correspondant à la taille et à la graisse. Les onze écrans
  passent AA.

### Parti pris de la page publique

Le lecteur visé est le **propriétaire qui loue son logement**, pas le voyageur
qui le réserve. La page ne cherche donc pas à faire rêver : elle montre l'outil,
dit ce qu'il change pour lui, et donne le prix. Trois règles la tiennent :

1. **La démonstration passe avant le discours.** Le premier écran contient une
   vraie visite, manipulable à la souris ou au doigt — pas une capture, pas une
   promesse. Une section plus bas montre en vidéo ce que reçoit le voyageur.
2. **Une seule couleur d'accent**, réservée à ce sur quoi on peut agir. Sa
   luminance est choisie pour franchir le seuil AA dans les deux sens : texte
   bleu sur blanc, et texte blanc sur aplat bleu.
3. **Aucun effet qui ne serve pas la lecture.** Les apparitions au défilement
   durent une demi-seconde, ne se jouent qu'une fois, et `prefers-reduced-motion`
   les supprime entièrement.

Une seule fonte pour tout le site — Inter, auto-hébergée dans `public/fonts`. La
feuille distante de Google Fonts bloquait le rendu et ajoutait deux connexions
au chemin critique ; `app/fonts.css` est généré à partir de leur API et ne
contient que les sous-ensembles latin et latin-ext.

### La démonstration publique

Elle ne vient pas de la base de données : ce sont des fichiers fixes, versionnés
avec le code. La page d'accueil est donc identique sur toute installation, y
compris neuve, elle n'expose jamais le logement d'un client, et elle ne dépend
pas de la disponibilité de la base.

Les trois panoramas sont de **vraies photographies 360°**, pas des images de
synthèse. Une première version dessinait les pièces au canevas à partir de leurs
cotes ; le rendu restait une illustration, et une illustration ne démontre pas un
service qui vend justement du réalisme. Les sources viennent de
[Poly Haven](https://polyhaven.com), en CC0 — domaine public, usage commercial
autorisé, attribution non requise (elle est faite ici par correction) :

| Pièce         | Source Poly Haven |
| ------------- | ----------------- |
| Salon         | `lythwood_lounge` |
| Chambre       | `hotel_room`      |
| Salle de bain | `modern_bathroom` |

**À remplacer par un vrai logement dès le premier scan livré.** Il suffit de
déposer trois fichiers dans `public/demo/` et d'ajuster `lib/demo.ts` : les caps
de départ de chaque pièce et la position des points de passage sur les portes.

Un détail à connaître pour ces réglages : les caps se lisent facilement sur le
panorama à plat — la colonne `x` d'une image de largeur `W` correspond au cap
`360 × x / W` — mais le viewer compte les siens depuis une autre origine. La
fonction `facing()` de `lib/demo.ts` fait la conversion, en un seul endroit.

La vidéo, elle, n'est pas une maquette : `scripts/record-demo.mjs` pilote la
visite réelle de la page d'accueil et filme la fenêtre. Ce qui est montré ne peut
donc pas diverger du produit.

Pour régénérer les deux (Playwright et ffmpeg requis, aucun des deux n'est une
dépendance du site) :

```bash
npx playwright@1.62 install chromium
npm run demo:images
npm run build && npm run start &      # la vidéo filme le site en fonctionnement
npm run demo:video
```

### Choix techniques notables

- **Deux niveaux d'accès.** Le voyageur n'a besoin de rien : il ouvre un lien.
  Le propriétaire abonné dispose d'un espace où il crée ses propres visites.
  Le back-office `/admin` reste réservé à un seul compte : le vôtre.
- **Deux implémentations de stockage** derrière la même interface, choisies
  automatiquement selon les variables d'environnement : on développe sans
  Supabase, on déploie avec.
- **Le viewer 360° est maison** (three.js), sans abonnement ni dépendance à un
  service tiers. Les points de passage sont projetés en HTML plutôt qu'en
  sprites 3D, ce qui les rend stylables et accessibles au clavier.
