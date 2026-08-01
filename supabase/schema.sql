-- =============================================================================
-- Volume3D — schéma Postgres (Supabase)
--
-- À coller dans Supabase → SQL Editor → Run, une seule fois.
--
-- Les noms de colonnes sont volontairement en camelCase entre guillemets pour
-- correspondre exactement aux types TypeScript : aucune conversion de nom n'est
-- alors nécessaire entre la base et l'application.
--
-- Accès : l'application se connecte avec la clé "service_role" côté serveur.
-- La sécurité au niveau des lignes (RLS) est activée sans aucune politique,
-- ce qui bloque totalement la clé publique "anon" — donc le navigateur.
-- =============================================================================

create table if not exists accounts (
  id             text primary key,
  email          text not null unique,
  "passwordHash" text not null,
  name           text not null default '',
  company        text not null default '',
  phone          text not null default '',
  plan           text not null default 'essentiel' check (plan in ('essentiel', 'pro', 'conciergerie')),
  status         text not null default 'active',
  "createdAt"    text not null
);

create table if not exists properties (
  id            text primary key,
  "accountId"   text not null default '',
  slug          text not null unique,
  name          text not null default '',
  city          text not null default '',
  "ownerName"   text not null default '',
  "ownerEmail"  text not null default '',
  "ownerPhone"  text not null default '',
  description   text not null default '',
  notes         text not null default '',
  "chatEnabled" boolean not null default true,
  mode          text not null default 'pano' check (mode in ('pano', 'model', 'video', 'embed')),
  "embedUrl"    text not null default '',
  "modelUrl"    text not null default '',
  "videoUrl"    text not null default '',
  status        text not null default 'draft' check (status in ('draft', 'published')),
  "createdAt"   text not null,
  "publishedAt" text,
  views         integer not null default 0
);

create index if not exists properties_status_idx on properties (status);
create index if not exists properties_account_idx on properties ("accountId");

create table if not exists photos (
  id           text primary key,
  "propertyId" text not null references properties (id) on delete cascade,
  url          text not null,
  caption      text not null default '',
  position     integer not null default 0
);

create index if not exists photos_property_idx on photos ("propertyId", position);

-- Repères temporels dans la vidéo : ce qui la rend navigable.
create table if not exists chapters (
  id           text primary key,
  "propertyId" text not null references properties (id) on delete cascade,
  label        text not null default '',
  seconds      double precision not null default 0
);

create index if not exists chapters_property_idx on chapters ("propertyId", seconds);

-- Questions posées à l'assistant : la matière du tableau de bord client.
create table if not exists "chatMessages" (
  id           text primary key,
  "propertyId" text not null references properties (id) on delete cascade,
  question     text not null default '',
  answer       text not null default '',
  "createdAt"  text not null
);

create index if not exists chat_property_idx on "chatMessages" ("propertyId", "createdAt");

create table if not exists scenes (
  id             text primary key,
  "propertyId"   text not null references properties (id) on delete cascade,
  name           text not null default '',
  "imageUrl"     text not null,
  position       integer not null default 0,
  "initialYaw"   double precision not null default 0,
  "initialPitch" double precision not null default 0
);

create index if not exists scenes_property_idx on scenes ("propertyId", position);

create table if not exists hotspots (
  id              text primary key,
  "sceneId"       text not null references scenes (id) on delete cascade,
  "targetSceneId" text not null references scenes (id) on delete cascade,
  label           text not null default '',
  yaw             double precision not null default 0,
  pitch           double precision not null default 0
);

create index if not exists hotspots_scene_idx on hotspots ("sceneId");

-- Aperçus de démarchage : volontairement séparés des visites réelles, pour
-- qu'une simulation IA ne puisse jamais être livrée comme visite d'un logement.
create table if not exists previews (
  id             text primary key,
  token          text not null unique,
  "propertyName" text not null default '',
  city           text not null default '',
  "listingUrl"   text not null default '',
  "ownerEmail"   text not null default '',
  status         text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  error          text not null default '',
  "createdAt"    text not null,
  "expiresAt"    text not null,
  views          integer not null default 0
);

create index if not exists previews_token_idx on previews (token);

create table if not exists "previewShots" (
  id             text primary key,
  "previewId"    text not null references previews (id) on delete cascade,
  label          text not null default '',
  position       integer not null default 0,
  "sourceUrl"    text not null,
  "generatedUrl" text not null default ''
);

create index if not exists preview_shots_preview_idx on "previewShots" ("previewId", position);

create table if not exists leads (
  id          text primary key,
  name        text not null default '',
  email       text not null default '',
  phone       text not null default '',
  city        text not null default '',
  profile     text not null default '',
  message     text not null default '',
  "createdAt" text not null,
  handled     boolean not null default false
);

-- Rien n'est accessible sans la clé service_role : aucune politique n'est créée.
alter table accounts       enable row level security;
alter table properties     enable row level security;
alter table photos         enable row level security;
alter table chapters       enable row level security;
alter table "chatMessages" enable row level security;
alter table scenes         enable row level security;
alter table hotspots       enable row level security;
alter table previews       enable row level security;
alter table "previewShots" enable row level security;
alter table leads          enable row level security;

-- =============================================================================
-- Stockage des fichiers
--
-- Créez ensuite un bucket PUBLIC nommé "tours" :
--   Supabase → Storage → New bucket → nom "tours" → cocher "Public bucket".
--
-- Il doit être public : les panoramas sont chargés directement par le
-- navigateur des voyageurs, sans authentification. N'y déposez donc jamais de
-- document confidentiel.
-- =============================================================================
