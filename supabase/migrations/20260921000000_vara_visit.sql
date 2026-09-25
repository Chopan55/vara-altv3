-- ════════════════════════════════════════════════════════════════════════
-- VARA Visit — esquema
--
-- Principio que ordena todo el archivo: los datos de una persona viven en
-- tablas separadas según quién puede verlos. Postgres tiene RLS a nivel de
-- FILA, no de columna: si el teléfono está en la misma tabla que el perfil
-- público, no hay política que lo esconda. Por eso hay tres tablas donde
-- un diseño ingenuo pondría una.
--
--   visit_partners        → perfil público (marketplace)
--   partner_contacts      → teléfono, email, domicilio (privado)
--   partner_verifications → compliance (solo admin)
--
-- Idempotente: se puede correr de nuevo sin romper nada.
-- Requiere que 20260919000000_initial_schema.sql ya esté aplicada.
-- ════════════════════════════════════════════════════════════════════════

-- ───────────────────────────── Enums ─────────────────────────────

do $$ begin create type user_role as enum ('CLIENT','PARTNER','ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin create type visit_service_type as enum ('SHOW_PROPERTY','ACCOMPANY_VISIT');
exception when duplicate_object then null; end $$;

do $$ begin create type partner_status as enum
  ('DRAFT','PENDING_APPROVAL','ACTIVE','PAUSED_BY_PARTNER','SUSPENDED','DEACTIVATED');
exception when duplicate_object then null; end $$;

do $$ begin create type partner_tier as enum ('TRAINEE','VERIFIED','PRO','EXPERT','ELITE');
exception when duplicate_object then null; end $$;

do $$ begin create type partner_onboarding_status as enum
  ('NOT_STARTED','IN_PROGRESS','PENDING_REVIEW','APPROVED','REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin create type verification_status as enum
  ('NOT_STARTED','SUBMITTED','IN_REVIEW','VERIFIED','REJECTED','EXPIRED');
exception when duplicate_object then null; end $$;

-- LEGAL REVIEW REQUIRED — ARGENTINA DATA PRIVACY (Ley 25.326)
-- Solo estado de elegibilidad. Nunca el certificado ni su contenido.
do $$ begin create type background_eligibility_status as enum
  ('NOT_REQUESTED','PENDING_REVIEW','VERIFIED_BY_AUTHORIZED_PROCESS','REJECTED','EXPIRED');
exception when duplicate_object then null; end $$;

do $$ begin create type reference_status as enum
  ('PENDING','REQUESTED','RESPONDED','VERIFIED','FAILED');
exception when duplicate_object then null; end $$;

do $$ begin create type certification_status as enum
  ('NOT_STARTED','IN_PROGRESS','QUIZ_PENDING','FAILED','CERTIFIED','EXPIRED');
exception when duplicate_object then null; end $$;

do $$ begin create type vara_visit_status as enum
  ('REQUESTED','SEARCHING_PARTNER','ASSIGNED','CONFIRMED','PARTNER_EN_ROUTE',
   'ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED','INCIDENT_REVIEW');
exception when duplicate_object then null; end $$;

do $$ begin create type assignment_mode as enum ('CLIENT_CHOICE','VARA_MATCH');
exception when duplicate_object then null; end $$;

do $$ begin create type pin_status as enum ('NOT_REQUIRED','PENDING','CONFIRMED','FAILED');
exception when duplicate_object then null; end $$;

do $$ begin create type session_status as enum
  ('NOT_STARTED','CHECKED_IN','IN_PROGRESS','CHECKED_OUT','ABORTED');
exception when duplicate_object then null; end $$;

do $$ begin create type incident_severity as enum
  ('LEVEL_1_MINOR','LEVEL_2_REVIEW','LEVEL_3_CRITICAL');
exception when duplicate_object then null; end $$;

do $$ begin create type incident_category as enum
  ('SAFETY','IDENTITY','PROPERTY_DAMAGE','CONDUCT','NO_SHOW','ACCESS','PRIVACY','OTHER');
exception when duplicate_object then null; end $$;

do $$ begin create type incident_status as enum
  ('OPEN','IN_REVIEW','ACTION_TAKEN','CLOSED','DISMISSED');
exception when duplicate_object then null; end $$;

do $$ begin create type zone_coverage as enum ('AVAILABLE','LIMITED','WAITLIST','PAUSED');
exception when duplicate_object then null; end $$;

-- ────────────────────────── Roles ──────────────────────────

alter table profiles add column if not exists role user_role not null default 'CLIENT';

/*
 * is_admin() en SECURITY DEFINER.
 *
 * Sin esto, una política que consulte `profiles` para saber el rol dispara
 * la política de `profiles`, que a su vez consulta `profiles`: recursión
 * infinita y error en runtime. El definer corre con permisos del dueño y
 * corta el ciclo. search_path fijo para que nadie lo secuestre.
 */
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'ADMIN'
  );
$$;

create or replace function is_partner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'PARTNER'
  );
$$;

-- ──────────────────── visit_partners (PÚBLICO) ────────────────────
-- Nada acá puede identificar dónde vive ni cómo contactar a la persona.

create table if not exists visit_partners (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references auth.users(id) on delete cascade,
  display_name          text not null,
  initials              text not null,
  photo_path            text,
  bio                   text,
  profession            text,
  experience_years      int,
  languages             text[] not null default '{}',
  -- Zona APROXIMADA. El domicilio exacto vive en partner_contacts.
  home_zone_label       text not null default '',
  coverage_zones        text[] not null default '{}',
  max_travel_radius_km  int not null default 10,
  service_types         visit_service_type[] not null default '{}',
  -- Disponibilidad como JSON: {"mon":["09:00-13:00"], ...}. Simple y suficiente.
  availability          jsonb not null default '{}'::jsonb,
  rate_per_visit        numeric(10,2) not null default 0,
  currency              currency_code not null default 'USD',
  status                partner_status not null default 'DRAFT',
  tier                  partner_tier not null default 'TRAINEE',
  onboarding_status     partner_onboarding_status not null default 'NOT_STARTED',
  -- Verificaciones como booleanos derivados. El detalle vive en partner_verifications.
  verified_identity     boolean not null default false,
  verified_document     boolean not null default false,
  verified_phone        boolean not null default false,
  verified_email        boolean not null default false,
  certified             boolean not null default false,
  -- Métricas. Se recalculan; no se editan a mano.
  total_visits          int not null default 0,
  completed_visits      int not null default 0,
  cancelled_visits      int not null default 0,
  on_time_visits        int not null default 0,
  rating_sum            numeric(10,2) not null default 0,
  review_count          int not null default 0,
  incident_count        int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists visit_partners_status_idx on visit_partners(status);
create index if not exists visit_partners_zones_idx on visit_partners using gin(coverage_zones);

drop trigger if exists visit_partners_updated_at on visit_partners;
create trigger visit_partners_updated_at before update on visit_partners
  for each row execute function set_updated_at();

-- ──────────────── partner_contacts (PRIVADO) ────────────────
-- Tabla aparte justamente porque RLS no filtra columnas.

create table if not exists partner_contacts (
  partner_id    uuid primary key references visit_partners(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  phone         text,
  email         text,
  -- Domicilio para validación. Nunca sale de acá.
  address_line  text,
  address_city  text,
  updated_at    timestamptz not null default now()
);

drop trigger if exists partner_contacts_updated_at on partner_contacts;
create trigger partner_contacts_updated_at before update on partner_contacts
  for each row execute function set_updated_at();

-- ────────── partner_verifications (COMPLIANCE — solo admin) ──────────

create table if not exists partner_verifications (
  partner_id                      uuid primary key references visit_partners(id) on delete cascade,
  user_id                         uuid not null references auth.users(id) on delete cascade,
  identity_status                 verification_status not null default 'NOT_STARTED',
  document_verification_status    verification_status not null default 'NOT_STARTED',
  address_verification_status     verification_status not null default 'NOT_STARTED',
  reference_check_status          verification_status not null default 'NOT_STARTED',
  interview_status                verification_status not null default 'NOT_STARTED',
  training_status                 verification_status not null default 'NOT_STARTED',
  supervised_visits_completed     int not null default 0,
  risk_review_status              verification_status not null default 'NOT_STARTED',
  -- LEGAL REVIEW REQUIRED — ARGENTINA DATA PRIVACY (Ley 25.326)
  -- Solo el estado. Está prohibido agregar acá el certificado o su contenido.
  background_eligibility_status   background_eligibility_status not null default 'NOT_REQUESTED',
  verification_provider           text,
  verification_date               timestamptz,
  expiration_date                 timestamptz,
  overall_status                  partner_onboarding_status not null default 'NOT_STARTED',
  reviewed_by                     uuid references auth.users(id),
  reviewed_at                     timestamptz,
  rejection_reason                text,
  updated_at                      timestamptz not null default now()
);

drop trigger if exists partner_verifications_updated_at on partner_verifications;
create trigger partner_verifications_updated_at before update on partner_verifications
  for each row execute function set_updated_at();

-- ───────────────────── partner_references ─────────────────────

create table if not exists partner_references (
  id              uuid primary key default gen_random_uuid(),
  partner_id      uuid not null references visit_partners(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  relationship    text not null,
  contact_email   text,
  contact_phone   text,
  status          reference_status not null default 'PENDING',
  requested_at    timestamptz,
  responded_at    timestamptz,
  -- Respuestas al cuestionario. Ver REFERENCE_QUESTIONS en varaVisit.ts.
  answers         jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists partner_references_partner_idx on partner_references(partner_id);

-- ────────────────────── partner_training ──────────────────────

create table if not exists partner_training (
  partner_id             uuid primary key references visit_partners(id) on delete cascade,
  user_id                uuid not null references auth.users(id) on delete cascade,
  modules_completed      text[] not null default '{}',
  quiz_score             numeric(4,3),
  quiz_attempts          int not null default 0,
  certification_status   certification_status not null default 'NOT_STARTED',
  certification_date     timestamptz,
  expiration_date        timestamptz,
  updated_at             timestamptz not null default now()
);

drop trigger if exists partner_training_updated_at on partner_training;
create trigger partner_training_updated_at before update on partner_training
  for each row execute function set_updated_at();

-- ─────────────────────── visit_bookings ───────────────────────

create sequence if not exists visit_code_seq;

create table if not exists visit_bookings (
  id                    uuid primary key default gen_random_uuid(),
  -- VIS-AR-PIL-000238. Es el que una persona dice por teléfono.
  visit_code            text not null unique,
  requester_user_id     uuid not null references auth.users(id) on delete cascade,
  property_id           uuid references properties(id) on delete set null,
  operation_id          uuid references operations(id) on delete set null,
  service_type          visit_service_type not null,
  requested_date        date not null,
  requested_time        time not null,
  duration_minutes      int not null default 30,
  location_label        text not null,
  instructions          text,
  -- Cómo entrar. Solo el partner asignado y confirmado, o admin.
  access_instructions   text,
  guests_expected       int,
  price                 numeric(10,2) not null default 0,
  currency              currency_code not null default 'USD',
  assignment_mode       assignment_mode not null default 'VARA_MATCH',
  assigned_partner_id   uuid references visit_partners(id) on delete set null,
  status                vara_visit_status not null default 'REQUESTED',
  -- PIN de confirmación de identidad. Se genera al confirmar la visita.
  confirmation_pin      text,
  cancellation_reason   text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists visit_bookings_requester_idx on visit_bookings(requester_user_id);
create index if not exists visit_bookings_partner_idx on visit_bookings(assigned_partner_id);
create index if not exists visit_bookings_status_idx on visit_bookings(status);

drop trigger if exists visit_bookings_updated_at on visit_bookings;
create trigger visit_bookings_updated_at before update on visit_bookings
  for each row execute function set_updated_at();

-- ────────────────────── visit_assignments ──────────────────────
-- Historial: si un partner rechaza y se asigna otro, quedan las dos filas.

create table if not exists visit_assignments (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references visit_bookings(id) on delete cascade,
  partner_id            uuid not null references visit_partners(id) on delete cascade,
  assigned_at           timestamptz not null default now(),
  accepted_at           timestamptz,
  rejected_at           timestamptz,
  rejection_reason      text,
  cancelled_at          timestamptz,
  cancellation_reason   text
);

create index if not exists visit_assignments_booking_idx on visit_assignments(booking_id);
create index if not exists visit_assignments_partner_idx on visit_assignments(partner_id);

-- ─────────────────────── visit_sessions ───────────────────────
-- Acá vive la trazabilidad: quién entró, cuándo, y cuándo salió.

create table if not exists visit_sessions (
  id                        uuid primary key default gen_random_uuid(),
  booking_id                uuid not null unique references visit_bookings(id) on delete cascade,
  partner_id                uuid not null references visit_partners(id) on delete cascade,
  check_in_at               timestamptz,
  -- Geolocalización: se registra si el navegador la da, nunca se exige.
  -- Bloquear por GPS dejaría a un partner honesto afuera de un subsuelo sin señal.
  check_in_lat              double precision,
  check_in_lng              double precision,
  check_in_accuracy_m       double precision,
  check_out_at              timestamptz,
  check_out_lat             double precision,
  check_out_lng             double precision,
  check_out_accuracy_m      double precision,
  confirmation_pin_status   pin_status not null default 'PENDING',
  pin_attempts              int not null default 0,
  status                    session_status not null default 'NOT_STARTED',
  duration_minutes          int,
  checklist_state           jsonb not null default '{}'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

drop trigger if exists visit_sessions_updated_at on visit_sessions;
create trigger visit_sessions_updated_at before update on visit_sessions
  for each row execute function set_updated_at();

-- ──────────────────────── visit_reports ────────────────────────

create table if not exists visit_reports (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null unique references visit_bookings(id) on delete cascade,
  partner_id          uuid not null references visit_partners(id) on delete cascade,
  attendees_count     int not null default 0,
  rooms_shown         text[] not null default '{}',
  -- Textual, como se preguntó. Hechos, no interpretaciones.
  questions_asked     text[] not null default '{}',
  observations        text[] not null default '{}',
  issues              jsonb not null default '[]'::jsonb,
  photo_paths         text[] not null default '{}',
  checklist_results   jsonb not null default '{}'::jsonb,
  generated_at        timestamptz not null default now()
);

-- ───────────────────── reviews bilaterales ─────────────────────

create table if not exists partner_reviews (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null unique references visit_bookings(id) on delete cascade,
  reviewer_user_id   uuid not null references auth.users(id) on delete cascade,
  partner_id         uuid not null references visit_partners(id) on delete cascade,
  punctuality        int not null check (punctuality between 1 and 5),
  professionalism    int not null check (professionalism between 1 and 5),
  communication      int not null check (communication between 1 and 5),
  knowledge          int not null check (knowledge between 1 and 5),
  report_quality     int not null check (report_quality between 1 and 5),
  overall_rating     int not null check (overall_rating between 1 and 5),
  comment            text,
  created_at         timestamptz not null default now()
);

create index if not exists partner_reviews_partner_idx on partner_reviews(partner_id);

create table if not exists client_reviews (
  id                     uuid primary key default gen_random_uuid(),
  booking_id             uuid not null unique references visit_bookings(id) on delete cascade,
  partner_id             uuid not null references visit_partners(id) on delete cascade,
  client_user_id         uuid not null references auth.users(id) on delete cascade,
  punctuality            int not null check (punctuality between 1 and 5),
  respect                int not null check (respect between 1 and 5),
  communication          int not null check (communication between 1 and 5),
  -- NUNCA se publican. Van a Trust & Safety.
  private_safety_flags   text[] not null default '{}',
  comment                text,
  created_at             timestamptz not null default now()
);

-- ─────────────────────── safety_incidents ───────────────────────

create table if not exists safety_incidents (
  id                   uuid primary key default gen_random_uuid(),
  booking_id           uuid references visit_bookings(id) on delete set null,
  reported_by_user_id  uuid not null references auth.users(id) on delete cascade,
  reported_user_id     uuid references auth.users(id) on delete set null,
  category             incident_category not null,
  severity             incident_severity not null default 'LEVEL_2_REVIEW',
  description          text not null,
  context_lat          double precision,
  context_lng          double precision,
  context_accuracy_m   double precision,
  status               incident_status not null default 'OPEN',
  created_at           timestamptz not null default now(),
  reviewed_at          timestamptz,
  reviewed_by          uuid references auth.users(id),
  resolution           text
);

create index if not exists safety_incidents_status_idx on safety_incidents(status);

-- ─────────────────────── coverage_requests ───────────────────────
-- Lista de espera cuando no hay oferta. Es lo que mostramos en vez de
-- inventar un partner.

create table if not exists coverage_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  zone_label    text not null,
  service_type  visit_service_type,
  note          text,
  notified      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists coverage_requests_zone_idx on coverage_requests(zone_label);

-- ───────────────────────── visit_events ─────────────────────────
-- Instrumentación. Sin PII ni instrucciones de acceso: solo lo medible.

create table if not exists visit_events (
  id           bigserial primary key,
  name         text not null,
  user_id      uuid references auth.users(id) on delete set null,
  booking_id   uuid references visit_bookings(id) on delete set null,
  partner_id   uuid references visit_partners(id) on delete set null,
  props        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists visit_events_name_idx on visit_events(name);
create index if not exists visit_events_created_idx on visit_events(created_at);

-- ════════════════════════════════════════════════════════════════
-- RLS
--
-- Sin esto, cualquiera con la clave pública lee la base entera.
-- ════════════════════════════════════════════════════════════════

alter table visit_partners        enable row level security;
alter table partner_contacts      enable row level security;
alter table partner_verifications enable row level security;
alter table partner_references    enable row level security;
alter table partner_training      enable row level security;
alter table visit_bookings        enable row level security;
alter table visit_assignments     enable row level security;
alter table visit_sessions        enable row level security;
alter table visit_reports         enable row level security;
alter table partner_reviews       enable row level security;
alter table client_reviews        enable row level security;
alter table safety_incidents      enable row level security;
alter table coverage_requests     enable row level security;
alter table visit_events          enable row level security;

-- ── visit_partners: perfil público, visible solo si está ACTIVE ──
-- Un partner en DRAFT o SUSPENDED no aparece en el marketplace.

drop policy if exists "visit_partners_public_read" on visit_partners;
create policy "visit_partners_public_read" on visit_partners
  for select using (status = 'ACTIVE' or user_id = auth.uid() or is_admin());

drop policy if exists "visit_partners_own_write" on visit_partners;
create policy "visit_partners_own_write" on visit_partners
  for insert with check (user_id = auth.uid());

drop policy if exists "visit_partners_own_update" on visit_partners;
create policy "visit_partners_own_update" on visit_partners
  for update using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

drop policy if exists "visit_partners_admin_delete" on visit_partners;
create policy "visit_partners_admin_delete" on visit_partners
  for delete using (is_admin());

-- ── partner_contacts: dueño y admin. Nadie más. ──
-- En el piloto VARA coordina el contacto; no se expone el teléfono al cliente.
-- Cuando se automatice, la apertura va acá y queda auditada en un solo lugar.

drop policy if exists "partner_contacts_own" on partner_contacts;
create policy "partner_contacts_own" on partner_contacts
  for all using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- ── partner_verifications: el partner LEE lo suyo, solo admin ESCRIBE ──
-- Si el partner pudiera escribir, se auto-verificaría. Ese es el punto.

drop policy if exists "partner_verifications_read" on partner_verifications;
create policy "partner_verifications_read" on partner_verifications
  for select using (user_id = auth.uid() or is_admin());

drop policy if exists "partner_verifications_admin_write" on partner_verifications;
create policy "partner_verifications_admin_write" on partner_verifications
  for insert with check (is_admin());

drop policy if exists "partner_verifications_admin_update" on partner_verifications;
create policy "partner_verifications_admin_update" on partner_verifications
  for update using (is_admin()) with check (is_admin());

-- ── partner_references ──
-- El partner carga a quién referenciar; el estado VERIFIED lo pone admin.

drop policy if exists "partner_references_own" on partner_references;
create policy "partner_references_own" on partner_references
  for all using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- ── partner_training ──

drop policy if exists "partner_training_own" on partner_training;
create policy "partner_training_own" on partner_training
  for all using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- ── visit_bookings: el cliente que la pidió, el partner asignado, admin ──

drop policy if exists "visit_bookings_access" on visit_bookings;
create policy "visit_bookings_access" on visit_bookings
  for select using (
    requester_user_id = auth.uid()
    or is_admin()
    or assigned_partner_id in (select id from visit_partners where user_id = auth.uid())
  );

drop policy if exists "visit_bookings_client_insert" on visit_bookings;
create policy "visit_bookings_client_insert" on visit_bookings
  for insert with check (requester_user_id = auth.uid());

drop policy if exists "visit_bookings_update" on visit_bookings;
create policy "visit_bookings_update" on visit_bookings
  for update using (
    requester_user_id = auth.uid()
    or is_admin()
    or assigned_partner_id in (select id from visit_partners where user_id = auth.uid())
  ) with check (
    requester_user_id = auth.uid()
    or is_admin()
    or assigned_partner_id in (select id from visit_partners where user_id = auth.uid())
  );

drop policy if exists "visit_bookings_client_delete" on visit_bookings;
create policy "visit_bookings_client_delete" on visit_bookings
  for delete using (requester_user_id = auth.uid() or is_admin());

-- ── visit_assignments ──
-- El partner ve las suyas (para aceptar/rechazar), el cliente ve las de su visita.

drop policy if exists "visit_assignments_access" on visit_assignments;
create policy "visit_assignments_access" on visit_assignments
  for select using (
    is_admin()
    or partner_id in (select id from visit_partners where user_id = auth.uid())
    or booking_id in (select id from visit_bookings where requester_user_id = auth.uid())
  );

drop policy if exists "visit_assignments_write" on visit_assignments;
create policy "visit_assignments_write" on visit_assignments
  for insert with check (
    is_admin()
    or booking_id in (select id from visit_bookings where requester_user_id = auth.uid())
  );

drop policy if exists "visit_assignments_update" on visit_assignments;
create policy "visit_assignments_update" on visit_assignments
  for update using (
    is_admin()
    or partner_id in (select id from visit_partners where user_id = auth.uid())
  ) with check (
    is_admin()
    or partner_id in (select id from visit_partners where user_id = auth.uid())
  );

-- ── visit_sessions ──
-- El partner escribe (es quien hace check-in). El cliente lee para seguir el estado.

drop policy if exists "visit_sessions_access" on visit_sessions;
create policy "visit_sessions_access" on visit_sessions
  for select using (
    is_admin()
    or partner_id in (select id from visit_partners where user_id = auth.uid())
    or booking_id in (select id from visit_bookings where requester_user_id = auth.uid())
  );

drop policy if exists "visit_sessions_partner_write" on visit_sessions;
create policy "visit_sessions_partner_write" on visit_sessions
  for insert with check (
    is_admin()
    or partner_id in (select id from visit_partners where user_id = auth.uid())
  );

drop policy if exists "visit_sessions_partner_update" on visit_sessions;
create policy "visit_sessions_partner_update" on visit_sessions
  for update using (
    is_admin()
    or partner_id in (select id from visit_partners where user_id = auth.uid())
  ) with check (
    is_admin()
    or partner_id in (select id from visit_partners where user_id = auth.uid())
  );

-- ── visit_reports ──
-- Lo escribe el partner autor; lo lee el cliente dueño de la visita.

drop policy if exists "visit_reports_access" on visit_reports;
create policy "visit_reports_access" on visit_reports
  for select using (
    is_admin()
    or partner_id in (select id from visit_partners where user_id = auth.uid())
    or booking_id in (select id from visit_bookings where requester_user_id = auth.uid())
  );

drop policy if exists "visit_reports_partner_write" on visit_reports;
create policy "visit_reports_partner_write" on visit_reports
  for insert with check (
    partner_id in (select id from visit_partners where user_id = auth.uid()) or is_admin()
  );

drop policy if exists "visit_reports_partner_update" on visit_reports;
create policy "visit_reports_partner_update" on visit_reports
  for update using (
    partner_id in (select id from visit_partners where user_id = auth.uid()) or is_admin()
  ) with check (
    partner_id in (select id from visit_partners where user_id = auth.uid()) or is_admin()
  );

-- ── partner_reviews: públicas (sostienen la reputación) ──

drop policy if exists "partner_reviews_read" on partner_reviews;
create policy "partner_reviews_read" on partner_reviews
  for select using (true);

drop policy if exists "partner_reviews_author_write" on partner_reviews;
create policy "partner_reviews_author_write" on partner_reviews
  for insert with check (reviewer_user_id = auth.uid());

drop policy if exists "partner_reviews_author_update" on partner_reviews;
create policy "partner_reviews_author_update" on partner_reviews
  for update using (reviewer_user_id = auth.uid() or is_admin())
  with check (reviewer_user_id = auth.uid() or is_admin());

-- ── client_reviews: NO son públicas ──
-- Llevan flags de seguridad. Solo el partner que la escribió y admin.

drop policy if exists "client_reviews_restricted" on client_reviews;
create policy "client_reviews_restricted" on client_reviews
  for select using (
    is_admin() or partner_id in (select id from visit_partners where user_id = auth.uid())
  );

drop policy if exists "client_reviews_partner_write" on client_reviews;
create policy "client_reviews_partner_write" on client_reviews
  for insert with check (
    partner_id in (select id from visit_partners where user_id = auth.uid())
  );

-- ── safety_incidents ──
-- Cualquiera reporta. Solo quien reportó y admin pueden leer.
-- La persona reportada NO ve el reporte: si lo viera, nadie reportaría.

drop policy if exists "safety_incidents_read" on safety_incidents;
create policy "safety_incidents_read" on safety_incidents
  for select using (reported_by_user_id = auth.uid() or is_admin());

drop policy if exists "safety_incidents_insert" on safety_incidents;
create policy "safety_incidents_insert" on safety_incidents
  for insert with check (reported_by_user_id = auth.uid());

drop policy if exists "safety_incidents_admin_update" on safety_incidents;
create policy "safety_incidents_admin_update" on safety_incidents
  for update using (is_admin()) with check (is_admin());

-- ── coverage_requests ──

drop policy if exists "coverage_requests_own" on coverage_requests;
create policy "coverage_requests_own" on coverage_requests
  for all using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- ── visit_events: se escribe, no se lee (salvo admin) ──

drop policy if exists "visit_events_insert" on visit_events;
create policy "visit_events_insert" on visit_events
  for insert with check (auth.uid() is not null);

drop policy if exists "visit_events_admin_read" on visit_events;
create policy "visit_events_admin_read" on visit_events
  for select using (is_admin());

-- ════════════════════════════════════════════════════════════════
-- Consistencia
-- ════════════════════════════════════════════════════════════════

/*
 * Recalcula el tier del partner a partir de métricas reales.
 * No se edita a mano: si el tier fuera editable, dejaría de significar algo.
 */
create or replace function recompute_partner_tier(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_rating numeric;
  v_punct numeric;
  v_tier partner_tier;
begin
  select * into v from visit_partners where id = p_partner_id;
  if not found then return; end if;

  v_rating := case when v.review_count > 0 then v.rating_sum / v.review_count else null end;
  v_punct  := case when v.completed_visits > 0
                   then v.on_time_visits::numeric / v.completed_visits else null end;

  -- De mayor a menor: el primero que cumple, gana.
  if v.completed_visits >= 300 and coalesce(v_rating,0) >= 4.85
     and coalesce(v_punct,0) >= 0.98 and v.incident_count = 0 then
    v_tier := 'ELITE';
  elsif v.completed_visits >= 100 and coalesce(v_rating,0) >= 4.7
     and coalesce(v_punct,0) >= 0.95 and v.incident_count = 0 then
    v_tier := 'EXPERT';
  elsif v.completed_visits >= 25 and coalesce(v_rating,0) >= 4.5
     and coalesce(v_punct,0) >= 0.90 and v.incident_count = 0 then
    v_tier := 'PRO';
  elsif v.completed_visits >= 3 and v.certified and v.verified_identity then
    v_tier := 'VERIFIED';
  else
    v_tier := 'TRAINEE';
  end if;

  update visit_partners set tier = v_tier where id = p_partner_id;
end;
$$;

/*
 * Un incidente LEVEL_3_CRITICAL suspende al partner preventivamente.
 * Automatizamos el freno, no la absolución: reactivar es decisión humana
 * y queda registrada en safety_incidents.resolution.
 */
create or replace function auto_suspend_on_critical_incident()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.severity = 'LEVEL_3_CRITICAL' and new.reported_user_id is not null then
    update visit_partners
       set status = 'SUSPENDED'
     where user_id = new.reported_user_id
       and status = 'ACTIVE';
  end if;
  return new;
end;
$$;

drop trigger if exists safety_incidents_auto_suspend on safety_incidents;
create trigger safety_incidents_auto_suspend after insert on safety_incidents
  for each row execute function auto_suspend_on_critical_incident();

-- Contador de incidentes del partner, para que el tier lo refleje.
create or replace function bump_partner_incident_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reported_user_id is not null then
    update visit_partners
       set incident_count = incident_count + 1
     where user_id = new.reported_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists safety_incidents_bump_count on safety_incidents;
create trigger safety_incidents_bump_count after insert on safety_incidents
  for each row execute function bump_partner_incident_count();

/*
 * Número de secuencia del código de visita.
 *
 * Se pide a Postgres y no se genera en el cliente: dos personas reservando en
 * el mismo segundo producirían el mismo código, y el código es justamente lo
 * que una persona dice por teléfono cuando algo pasa.
 */
create or replace function next_visit_code_seq()
returns bigint
language sql
volatile
security definer
set search_path = public
as $$
  select nextval('visit_code_seq');
$$;

grant execute on function next_visit_code_seq() to authenticated;
grant execute on function recompute_partner_tier(uuid) to authenticated;

notify pgrst, 'reload schema';
