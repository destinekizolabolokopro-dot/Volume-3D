# Volume3D

Site et back-office du service de visites virtuelles 3D pour logements Airbnb.

Trois zones :

| Zone | URL | Qui y accède |
|---|---|---|
| **Landing** | `/` | Le public. Présentation de l'offre + formulaire de contact. |
| **Back-office** | `/admin` | Vous seul, par mot de passe. |
| **Visite publique** | `/v/{slug}` | Le propriétaire et ses voyageurs, sans compte. |
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
  lentement dans le logement. Le visiteur regarde, il ne contrôle pas. C'est le
  format des visites qu'on voit passer sur les réseaux : plus spectaculaire,
  plus facile à produire, mais moins convaincant pour lever un doute précis
  (« la chambre est-elle vraiment séparée ? »). Les deux se complètent.
- **Modèle 3D `.glb`** — pour un logement capturé en photogrammétrie avec
  Polycam ou Luma. Envoyez l'export `.glb` ; au-delà de ~60 Mo le chargement
  devient pénible sur mobile.
- **Viewer externe** — collez un lien Matterport ou Cupix : la page de visite
  garde votre habillage et affiche leur viewer à l'intérieur.

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
  page.tsx                     landing publique
  v/[slug]/                    visite publique (panoramas, modèle 3D ou embed)
  demo/[token]/                aperçu de démarchage, filigrané et temporaire
  admin/
    actions.ts                 toutes les écritures (Server Actions, session vérifiée)
    page.tsx                   tableau de bord : logements, aperçus, demandes
    logements/[id]/            éditeur de visite
  api/contact/                 réception du formulaire
  api/files/[...path]/         service des fichiers en développement
components/
  PanoViewer.tsx               viewer 360° : rotation, zoom, passages, plein écran
  ModelViewer.tsx              viewer de modèle .glb
lib/
  store.ts                     accès aux données (fichier JSON en dev, Supabase en prod)
  storage.ts / paths.ts        envoi de fichiers et sécurité des chemins
  sphere.ts                    conversions yaw/pitch ↔ vecteurs
  ai-preview.ts                extension IA des photos (aperçus uniquement)
supabase/schema.sql            schéma à exécuter une fois
```

### Choix techniques notables

- **Pas de comptes clients.** Un propriétaire reçoit un lien, rien d'autre à
  retenir. Le back-office a un seul compte : le vôtre.
- **Deux implémentations de stockage** derrière la même interface, choisies
  automatiquement selon les variables d'environnement : on développe sans
  Supabase, on déploie avec.
- **Le viewer 360° est maison** (three.js), sans abonnement ni dépendance à un
  service tiers. Les points de passage sont projetés en HTML plutôt qu'en
  sprites 3D, ce qui les rend stylables et accessibles au clavier.
