-- Liams — schema initial (section 5 du cahier des charges)
-- Note de conception : `enfants` n'est pas listé comme table à part dans la section 5,
-- mais `enfant_fiche_sante` et `enfant_profil_xtra` référencent un `enfant_id`, ce qui suppose
-- une entité enfant distincte de `parent_profiles.enfants[]`. On la normalise ici en table.
-- De même, `professional_profiles.badges[]` est normalisé en table de jointure `professional_badges`
-- (catalogue + attribution) pour permettre le cochage/décochage admin et le calcul automatique
-- du badge "Coup de cœur des parents" sans réécrire un tableau à chaque avis.

create extension if not exists "pgcrypto";

-- =========================================================================
-- Utilisateurs
-- =========================================================================

create type user_role as enum ('parent', 'professionnel', 'admin');

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role user_role not null,
  cgu_acceptees_le timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- Parent + enfants
-- =========================================================================

create table public.parent_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  adresse text,
  latitude double precision,
  longitude double precision,
  disponibilites jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enfants (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.users (id) on delete cascade,
  prenom text not null,
  date_naissance date,
  besoins_particuliers_libre text,
  besoins_particuliers_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index enfants_parent_id_idx on public.enfants (parent_id);

-- Fiche santé/urgence — obligatoire par enfant, donnée sensible (RGPD art. 9)
create table public.enfant_fiche_sante (
  enfant_id uuid primary key references public.enfants (id) on delete cascade,
  allergies text,
  traitements_en_cours text,
  contact_medecin text,
  contact_urgence text,
  updated_at timestamptz not null default now()
);

-- Profil enrichi "Xtra" — facultatif, voir 4.13, donnée sensible (RGPD art. 9)
create table public.enfant_profil_xtra (
  enfant_id uuid primary key references public.enfants (id) on delete cascade,
  routines_apaisantes text,
  declencheurs_a_eviter text,
  moyens_communication_preferes text,
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- Professionnel
-- =========================================================================

create type statut_verification as enum ('en_attente', 'valide', 'refuse');

create table public.professional_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  tarif_horaire numeric(6, 2),
  adresse text,
  latitude double precision,
  longitude double precision,
  rayon_km numeric(5, 1) not null default 15,
  disponibilites jsonb not null default '[]',
  specialisations text[] not null default '{}',
  accueil_a_domicile boolean not null default false,
  statut_verification_casier statut_verification not null default 'en_attente',
  note_moyenne numeric(3, 2),
  nombre_avis integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Photos personnelles pour le profil dynamique façon "cartes" (4.8)
create table public.professional_photos (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles (user_id) on delete cascade,
  fichier_url text not null,
  ordre integer not null default 0
);

create index professional_photos_pro_idx on public.professional_photos (professional_id);

-- Prompts (questions/réponses courtes), voir 4.8
create table public.professional_prompts (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles (user_id) on delete cascade,
  question text not null,
  reponse text not null,
  ordre integer not null default 0
);

create index professional_prompts_pro_idx on public.professional_prompts (professional_id);

-- Documents justificatifs généraux (4.2.5)
create type document_type as enum ('casier', 'cv', 'diplome', 'certificat', 'photo_logement');

create table public.professional_documents (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles (user_id) on delete cascade,
  type document_type not null,
  fichier_url text not null,
  statut statut_verification not null default 'en_attente',
  date_upload timestamptz not null default now()
);

create index professional_documents_pro_idx on public.professional_documents (professional_id);

-- Espace différencié "Xtras" (4.2.6) — distinct des documents généraux, conditionne les badges de spécialisation
create type xtra_justificatif_type as enum ('diplome', 'attestation_aesh', 'autre');

create table public.professional_qualification_xtra (
  professional_id uuid primary key references public.professional_profiles (user_id) on delete cascade,
  declare_qualifie boolean not null default false,
  type_justificatif xtra_justificatif_type,
  fichier_url text,
  statut statut_verification not null default 'en_attente',
  updated_at timestamptz not null default now()
);

-- Catalogue des badges (4.4)
create type badge_source as enum ('manuel', 'automatique');

create table public.badges (
  code text primary key,
  label text not null,
  description text,
  source badge_source not null
);

insert into public.badges (code, label, description, source) values
  ('accueil_xtras_ordinaires', 'Accueil des Xtras ordinaires', 'Expérience avérée avec des enfants à besoins particuliers (Xtras), toutes spécialités confondues', 'manuel'),
  ('specialiste_tsa', 'Spécialiste TSA', 'Expérience/formation spécifique aux troubles du spectre autistique', 'manuel'),
  ('specialiste_tdah', 'Spécialiste TDAH', 'Expérience/formation spécifique au trouble déficit de l''attention/hyperactivité', 'manuel'),
  ('specialiste_dys', 'Spécialiste troubles DYS', 'Expérience/formation spécifique aux troubles dys', 'manuel'),
  ('specialiste_handicap_moteur', 'Spécialiste handicap moteur', 'Expérience/formation spécifique à l''accompagnement de handicaps moteurs', 'manuel'),
  ('vehicule', 'Véhiculé(e)', 'Dispose d''un véhicule personnel pour les trajets', 'manuel'),
  ('nounou_extra', 'Nounou Extra', 'Statut de confiance renforcé / professionnel recommandé', 'manuel'),
  ('diplome', 'Diplômé(e)', 'Diplôme dans la petite enfance (CAP AEPE, BEP, etc.)', 'manuel'),
  ('super_experience', 'Super Expérience', 'Nombre d''années d''expérience significatif', 'manuel'),
  ('premiers_secours', 'Premiers Secours', 'Formation PSC1/SST à jour', 'manuel'),
  ('multilingue', 'Multilingue', 'Pratique une langue étrangère avec l''enfant', 'manuel'),
  ('aide_devoirs', 'Aide aux devoirs', 'Compétence/expérience en accompagnement scolaire', 'manuel'),
  ('non_fumeur', 'Non-fumeur', 'Ne fume pas en présence des enfants', 'manuel'),
  ('coup_de_coeur', 'Coup de cœur des parents', 'Note moyenne ≥ 4,5/5 sur un minimum de 3 avis', 'automatique');

create table public.professional_badges (
  professional_id uuid not null references public.professional_profiles (user_id) on delete cascade,
  badge_code text not null references public.badges (code),
  attribue_le timestamptz not null default now(),
  attribue_par uuid references public.users (id),
  primary key (professional_id, badge_code)
);

-- =========================================================================
-- Mise en relation + messagerie
-- =========================================================================

create type match_statut as enum ('en_attente', 'accepte', 'refuse');

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.users (id) on delete cascade,
  professional_id uuid not null references public.users (id) on delete cascade,
  statut match_statut not null default 'en_attente',
  date timestamptz not null default now(),
  unique (parent_id, professional_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.users (id),
  contenu text not null,
  date timestamptz not null default now()
);

create index messages_match_idx on public.messages (match_id, date);

-- =========================================================================
-- Réseau de confiance parent-professionnel (4.6)
-- =========================================================================

create table public.parent_networks (
  parent_id uuid not null references public.users (id) on delete cascade,
  professional_id uuid not null references public.users (id) on delete cascade,
  statut match_statut not null default 'en_attente',
  date timestamptz not null default now(),
  primary key (parent_id, professional_id)
);

-- =========================================================================
-- Planning et réservations
-- =========================================================================

create type slot_statut as enum ('occupe', 'libre', 'libre_urgence');

create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles (user_id) on delete cascade,
  date date not null,
  heure_debut time not null,
  heure_fin time not null,
  statut slot_statut not null default 'libre',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, date, heure_debut)
);

create index availability_slots_pro_date_idx on public.availability_slots (professional_id, date);

create type booking_statut as enum ('en_attente', 'confirme', 'refuse', 'annule');

create table public.urgent_bookings (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.users (id),
  professional_id uuid not null references public.users (id),
  slot_id uuid not null references public.availability_slots (id) on delete cascade,
  statut booking_statut not null default 'en_attente',
  date timestamptz not null default now()
);

create index urgent_bookings_slot_idx on public.urgent_bookings (slot_id);

-- Un seul créneau ne peut être confirmé qu'une fois (gestion de la concurrence, 4.6)
create unique index urgent_bookings_one_confirmed_per_slot
  on public.urgent_bookings (slot_id)
  where statut = 'confirme';

create table public.recurring_bookings (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.users (id),
  professional_id uuid not null references public.users (id),
  jour_semaine smallint not null check (jour_semaine between 0 and 6),
  heure_debut time not null,
  heure_fin time not null,
  statut text not null default 'actif' check (statut in ('actif', 'annule')),
  created_at timestamptz not null default now()
);

-- =========================================================================
-- Avis et notation (4.10)
-- =========================================================================

create table public.avis (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  auteur_id uuid not null references public.users (id),
  cible_id uuid not null references public.users (id),
  note smallint not null check (note between 1 and 5),
  commentaire text,
  date timestamptz not null default now(),
  visible_publiquement boolean not null default true,
  unique (match_id, auteur_id)
);

create index avis_cible_idx on public.avis (cible_id);

-- =========================================================================
-- Feedback pilote NPS (4.14)
-- =========================================================================

create table public.feedback_pilote (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  score_nps smallint check (score_nps between 0 and 10),
  reponses_complementaires jsonb,
  date_envoi timestamptz,
  date_reponse timestamptz
);

create index feedback_pilote_user_idx on public.feedback_pilote (user_id);
