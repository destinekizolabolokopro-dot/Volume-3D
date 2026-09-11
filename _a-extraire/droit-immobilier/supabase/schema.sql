-- =============================================================================
-- Le schéma, en entier.
--
-- Sept tables. C'est la mesure de ce service : des comptes, des fils de
-- consultation, les messages de ces fils, la trace des documents rédigés, les
-- jetons à usage unique envoyés par courriel, et les branches attendues.
--
-- Ce que ces tables NE contiennent PAS compte autant que le reste : les
-- documents déposés pendant une consultation — bail, compromis, procès-verbal
-- d'assemblée, avis d'imposition — ne sont jamais écrits. Ils traversent la
-- mémoire du serveur le temps d'une réponse et disparaissent ; seul leur nom
-- de fichier subsiste, dans "piece". Voir l'en-tête de lib/piece.ts.
--
-- À jouer une fois dans l'éditeur SQL de Supabase. Le rejouer ne casse rien.
-- =============================================================================

create table if not exists "comptesJuridiques" (
  id                 text primary key,
  email              text not null unique,
  -- Empreinte scrypt, au format « sel:empreinte ». Jamais de mot de passe en
  -- clair, et deux clients au même mot de passe ont deux empreintes.
  "passwordHash"     text not null,
  nom                text not null default '',
  statut             text not null default 'active',
  "createdAt"        text not null,
  -- Formule — voir FormuleId dans lib/abonnements.ts. Vide vaut « Découverte ».
  abonnement         text not null default 'decouverte',
  "abonnementDepuis" text not null default '',
  -- Date de confirmation de l'adresse. Vide tant qu'elle ne l'est pas : une
  -- adresse non confirmée n'empêche pas d'entrer, elle empêche de payer.
  "emailVerifieA"    text not null default '',
  -- Le profil déclaré à l'ouverture : d'où la personne parle. Il sert au
  -- spécialiste, pas à un fichier commercial. Les trois champs sont
  -- facultatifs — un profil faux serait pire qu'un profil vide.
  metier             text not null default '',
  volume             text not null default '',
  usage              text not null default ''
);

-- Un fil n'est enregistré que si la personne a un compte. Sans compte, il vit
-- dans l'onglet et disparaît avec lui : c'est écrit sur la page, et c'est
-- préférable à un identifiant déposé dans un cookie pour rattacher après coup
-- des questions sur une expulsion ou un impayé.
create table if not exists consultations (
  id          text primary key,
  "compteId"  text not null references "comptesJuridiques"(id) on delete cascade,
  domaine     text not null,
  titre       text not null default '',
  "createdAt" text not null,
  "updatedAt" text not null
);

create table if not exists "consultationTours" (
  id               text primary key,
  "consultationId" text not null references consultations(id) on delete cascade,
  role             text not null,
  content          text not null default '',
  -- Le NOM du document déposé, et rien d'autre.
  piece            text not null default '',
  "createdAt"      text not null
);

-- Qui a fait rédiger quoi, et quand. PAS le courrier : une mise en demeure
-- pour loyers impayés nomme des gens et raconte une histoire. Cette table
-- existe pour le quota, que l'écran annonce et qu'il faut donc tenir.
create table if not exists "documentsRediges" (
  id          text primary key,
  "compteId"  text not null references "comptesJuridiques"(id) on delete cascade,
  -- Identifiant du modèle — voir ModeleId dans lib/documents.ts.
  modele      text not null,
  "createdAt" text not null
);

-- Les jetons envoyés par courriel : confirmer une adresse, reprendre la main
-- sur un compte. "empreinte" est le SHA-256 du jeton, jamais le jeton : un
-- vidage de cette table ne donne accès à aucun compte. "utiliseA" marque
-- l'emploi au lieu d'effacer la ligne, pour pouvoir répondre « ce lien a déjà
-- servi » plutôt que « ce lien n'existe pas » quand un antivirus l'a préouvert.
create table if not exists "jetonsCompte" (
  id          text primary key,
  "compteId"  text not null references "comptesJuridiques"(id) on delete cascade,
  usage       text not null,
  empreinte   text not null,
  "expireA"   text not null,
  "utiliseA"  text not null default '',
  "createdAt" text not null
);

-- Qui attend quelle branche. Une ligne par compte et par branche : l'index
-- unique l'impose, pour qu'un double clic ne compte pas deux personnes. Ce
-- n'est pas une liste de diffusion — un seul message partira, le jour de
-- l'ouverture.
create table if not exists attentes (
  id          text primary key,
  "compteId"  text not null references "comptesJuridiques"(id) on delete cascade,
  branche     text not null,
  "createdAt" text not null
);

-- Les réglages posés depuis /reglages. Une seule ligne existe aujourd'hui :
-- « cle-modele », la clé d'API. Sa valeur est CHIFFRÉE (AES-256-GCM, clé
-- dérivée d'AUTH_SECRET) : un vidage de cette table ne donne rien
-- d'exploitable sans la variable d'environnement, qui n'est pas ici.
create table if not exists reglages (
  id       text primary key,
  valeur   text not null,
  "majAt"  text not null
);

create index if not exists consultations_compte on consultations("compteId");
create index if not exists consultation_tours_fil on "consultationTours"("consultationId");
create index if not exists documents_rediges_compte on "documentsRediges"("compteId");
-- La lecture se fait TOUJOURS par empreinte : c'est le seul chemin qu'emprunte
-- un lien cliqué, et il doit rester constant quel que soit le nombre de jetons.
create unique index if not exists jetons_compte_empreinte on "jetonsCompte"(empreinte);
create index if not exists jetons_compte_compte on "jetonsCompte"("compteId", usage);
create unique index if not exists attentes_compte_branche on attentes("compteId", branche);

-- Rien n'est accessible sans la clé service_role : aucune politique n'est créée.
alter table "comptesJuridiques"     enable row level security;
alter table reglages                enable row level security;
alter table consultations           enable row level security;
alter table "consultationTours"     enable row level security;
alter table "documentsRediges"      enable row level security;
alter table "jetonsCompte"          enable row level security;
alter table attentes                enable row level security;
