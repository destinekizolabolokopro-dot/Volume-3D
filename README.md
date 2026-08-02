# Volume3D

Site et back-office du service de visites virtuelles 3D pour logements Airbnb.

Le service est vendu **par abonnement** : chaque client dispose de son espace,
y crée ses biens, et suit ce qu'ils rapportent.

| Zone | URL | Qui y accède |
|---|---|---|
| **Landing** | `/` | Le public. Présentation de l'offre + formulaire de contact. |
| **Espace client** | `/espace` | Vos abonnés, chacun sur ses propres biens. |
| **Back-office** | `/admin` | Vous seul, par mot de passe. Vue sur l'ensemble. |
| **Visite publique** | `/v/{slug}` | Les voyageurs, sans compte, avec assistant. |
| **Aperçu de démarchage** | `/demo/{token}` | Un prospect précis, en privé, temporairement. |

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
```

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
pièces, des repères vidéo et des légendes de photos. Il tourne sur l'API Claude
(`claude-opus-5`).

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

Un seul fichier, sans installation ni serveur. Il s'ouvre par double-clic et se
dépose tel quel sur n'importe quel hébergement. Il contient la landing, un
viewer 360° fonctionnel, et un espace privé accessible par le lien **« Mon
espace »** de la barre de navigation.

**Mot de passe par défaut : `Volume3D-2026`.** Pour le changer, ouvrez le
fichier dans un éditeur de texte et modifiez la ligne `var ESPACE_PASSWORD =`
en haut du script.

Dans cet espace vous pouvez créer des visites, envoyer un panorama 360° par
pièce, les relier par des points de passage en cliquant dans l'image, joindre
une vidéo walkthrough, et relire les demandes envoyées depuis le formulaire.

Trois limites à connaître, inhérentes à un fichier sans serveur :

1. **Le mot de passe n'est pas une sécurité.** Il est écrit dans le fichier :
   quiconque affiche le code source le lit. C'est un verrou de confort. La
   version déployée, elle, vérifie le mot de passe côté serveur et signe la
   session.
2. **Les données restent dans ce navigateur, sur cet appareil.** Elles sont
   enregistrées dans IndexedDB — ni synchronisées, ni sauvegardées. Vider les
   données du navigateur les efface.
3. **Pas de lien public.** Une visite créée ici se regarde sur cet appareil ;
   elle ne peut pas être envoyée à un propriétaire. C'est la raison d'être de
   la version déployée.

Servez-vous-en comme d'une vitrine portable — en rendez-vous, même sans réseau
— et de la version en ligne pour livrer.

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
  page.tsx                     page publique
  landing.css                  feuille de la page publique
  v/[slug]/                    visite publique (panoramas, vidéo, modèle 3D ou embed)
  demo/[token]/                aperçu de démarchage, filigrané et temporaire
  espace/                      espace client : tableau de bord, biens, création, compte
  admin/
    actions.ts                 toutes les écritures (Server Actions, session vérifiée)
    page.tsx                   tableau de bord interne
    logements/[id]/            éditeur de visite
  editor.css                   éditeur de visite, partagé admin / espace client
  api/chat/                    assistant du voyageur (Claude)
  api/contact/                 réception du formulaire
  api/files/[...path]/         service des fichiers en développement
components/
  PanoViewer.tsx               viewer 360° : rotation, zoom, passages, plein écran
  TourStage.tsx                choix du format et chapitres de la vidéo
  ModelViewer.tsx              viewer de modèle .glb
  ChatWidget.tsx               assistant posé sur la visite
  landing/                     SiteNav, DemoTour, DemoVideo, Reveal, icônes
lib/
  demo.ts                      pièces et points de passage de la démonstration publique
  store.ts                     accès aux données (fichier JSON en dev, Supabase en prod)
  accounts.ts                  comptes clients, mots de passe, sessions
  assistant.ts                 invite système de l'assistant, garde-fous
  storage.ts / paths.ts        envoi de fichiers et sécurité des chemins
  sphere.ts                    conversions yaw/pitch ↔ vecteurs
  ai-preview.ts                extension IA des photos (aperçus uniquement)
scripts/
  demo-rooms.mjs               cotes des trois pièces de démonstration
  draw-room.js                 dessin d'un panorama équirectangulaire de pièce
  generate-demo.mjs            écrit public/demo/*.jpg
  record-demo.mjs              filme la visite réelle, écrit public/demo/visite.*
public/
  fonts/                       Inter en woff2 (latin + latin-ext)
  demo/                        panoramas, vidéo et vignette de la démonstration
supabase/schema.sql            schéma à exécuter une fois
```

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

Les trois panoramas sont **dessinés**, pas photographiés : `scripts/draw-room.js`
construit une image équirectangulaire à partir des cotes d'une pièce (demi-
largeur, hauteur sous plafond, hauteur d'objectif) et de la position des
ouvertures et des meubles. Le point délicat est que l'arête horizontale d'un mur
plat n'est pas une droite dans une équirectangulaire : sa hauteur angulaire suit
`atan(h / r(θ))`, et `r` varie avec le cap. Chaque élément est donc tracé le long
de cette courbe — sans quoi les fenêtres apparaissent bombées sur la sphère.

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
