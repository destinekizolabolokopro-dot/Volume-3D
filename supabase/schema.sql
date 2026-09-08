-- =============================================================================
-- Le schéma, en entier.
--
-- Trois tables. C'est la mesure de ce service : des comptes, des fils de
-- consultation, et les messages de ces fils.
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

create index if not exists consultations_compte on consultations("compteId");
create index if not exists consultation_tours_fil on "consultationTours"("consultationId");

-- Rien n'est accessible sans la clé service_role : aucune politique n'est créée.
alter table "comptesJuridiques"     enable row level security;
alter table consultations           enable row level security;
alter table "consultationTours"     enable row level security;
