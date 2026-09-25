-- VARA · esquema inicial (idempotente)
-- Correr en Supabase → SQL Editor → Run. Se puede correr varias veces sin romper nada.
--
-- Las políticas de Storage van aparte, en 20260919000001_storage.sql:
-- en muchos proyectos requieren permisos de owner y abortarían todo el script.

-- ─────────────────────────── Enums ───────────────────────────

do $$ begin
  create type operation_type as enum ('BUY_PROPERTY','SELL_PROPERTY','LAND_PURCHASE','COMMERCIAL_PROPERTY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type operation_status as enum ('ACTIVE','PAUSED','COMPLETED','DRAFT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('TODO','IN_PROGRESS','BLOCKED','DONE','NOT_APPLICABLE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('HIGH','MEDIUM','LOW');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_status as enum ('PENDING','RECEIVED','IN_REVIEW','APPROVED','REJECTED','EXPIRED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_category as enum ('ESCRITURA','PLANOS','INFORMES','IMPUESTOS','EXPENSAS','SERVICIOS','CERTIFICADOS','CONTRATOS','RESERVA','TASACIONES','OTROS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type property_type as enum ('HOUSE','APARTMENT','PH','LAND','GARAGE','LOCAL','OFFICE','FIELD');
exception when duplicate_object then null; end $$;

do $$ begin
  create type currency_code as enum ('USD','ARS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type risk_severity as enum ('HIGH','MEDIUM','LOW');
exception when duplicate_object then null; end $$;

do $$ begin
  create type risk_category as enum ('DOCUMENTAL','DOMINIAL','FISCAL','LEGAL','FINANCIERO','OPERATIVO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type property_source as enum ('IMPORTED','MANUAL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type visit_status as enum ('PENDIENTE','CONFIRMADA','RECHAZADA','REALIZADA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type publish_status as enum ('SOLICITADO','EN_PROCESO','PUBLICADO','RECHAZADO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type relation_type as enum ('SALE_FUNDS_PURCHASE','SALE_MUST_CLOSE_BEFORE_PURCHASE','PURCHASE_DEPENDS_ON_SALE','SAME_MOVE','USER_LINKED');
exception when duplicate_object then null; end $$;

-- ─────────────────────── Utilidad: updated_at ───────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ─────────────────────────── profiles ───────────────────────────

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  province    text,
  phone       text,
  onboarded   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Crea el profile automáticamente al registrarse.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────── properties ───────────────────────────

create table if not exists properties (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  source           property_source not null default 'MANUAL',
  source_url       text,
  portal           text,
  title            text not null default '',
  type             property_type not null default 'HOUSE',
  price            numeric(14,2),
  currency         currency_code not null default 'USD',
  address          text,
  neighborhood     text,
  city             text,
  province         text,
  surface_total    numeric(10,2),
  surface_covered  numeric(10,2),
  rooms            smallint,
  bedrooms         smallint,
  bathrooms        smallint,
  garage           boolean not null default false,
  description      text,
  features         text[] not null default '{}',
  expenses         numeric(12,2),
  age_years        smallint,
  remote_images    text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists properties_user_id_idx on properties(user_id);

drop trigger if exists properties_updated_at on properties;
create trigger properties_updated_at before update on properties
  for each row execute function set_updated_at();

-- ─────────────────────── property_photos ───────────────────────

create table if not exists property_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  property_id  uuid references properties(id) on delete cascade,
  storage_path text not null,
  label        text not null default 'Sin etiquetar',
  is_cover     boolean not null default false,
  position     smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists property_photos_property_id_idx on property_photos(property_id);
create index if not exists property_photos_user_id_idx on property_photos(user_id);
create unique index if not exists property_photos_one_cover_idx
  on property_photos(property_id) where is_cover;

-- ─────────────────────────── operations ───────────────────────────

create table if not exists operations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  property_id       uuid references properties(id) on delete set null,
  type              operation_type not null,
  status            operation_status not null default 'ACTIVE',
  title             text not null default '',
  subtitle          text,
  province          text not null default '',
  province_code     text not null default '',
  city              text,
  current_stage_key text,
  stages_state      jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists operations_user_id_idx on operations(user_id);

drop trigger if exists operations_updated_at on operations;
create trigger operations_updated_at before update on operations
  for each row execute function set_updated_at();

-- ─────────────────────── operation_tasks ───────────────────────

create table if not exists operation_tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  operation_id  uuid not null references operations(id) on delete cascade,
  stage_key     text not null,
  task_key      text not null,
  title         text not null,
  description   text,
  why           text,
  status        task_status not null default 'TODO',
  priority      task_priority not null default 'MEDIUM',
  notes         text,
  due_date      date,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (operation_id, stage_key, task_key)
);

create index if not exists operation_tasks_operation_id_idx on operation_tasks(operation_id);

drop trigger if exists operation_tasks_updated_at on operation_tasks;
create trigger operation_tasks_updated_at before update on operation_tasks
  for each row execute function set_updated_at();

-- ───────────────────── operation_documents ─────────────────────

create table if not exists operation_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  operation_id  uuid not null references operations(id) on delete cascade,
  task_id       uuid references operation_tasks(id) on delete set null,
  name          text not null,
  category      document_category not null default 'OTROS',
  status        document_status not null default 'PENDING',
  storage_path  text,
  version       smallint not null default 1,
  notes         text,
  document_date date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists operation_documents_operation_id_idx on operation_documents(operation_id);

drop trigger if exists operation_documents_updated_at on operation_documents;
create trigger operation_documents_updated_at before update on operation_documents
  for each row execute function set_updated_at();

-- ─────────────────────── operation_risks ───────────────────────

create table if not exists operation_risks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  operation_id    uuid not null references operations(id) on delete cascade,
  severity        risk_severity not null,
  category        risk_category not null,
  label           text not null,
  detail          text,
  evidence        text,
  recommendation  text,
  resolved        boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists operation_risks_operation_id_idx on operation_risks(operation_id);

-- ───────────────────── operation_relations ─────────────────────

create table if not exists operation_relations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  from_operation_id uuid not null references operations(id) on delete cascade,
  to_operation_id   uuid not null references operations(id) on delete cascade,
  type              relation_type not null,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  constraint no_self_relation check (from_operation_id <> to_operation_id),
  unique (from_operation_id, to_operation_id, type)
);

-- ─────────────────────── visit_requests ───────────────────────

create table if not exists visit_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  property_id   uuid references properties(id) on delete cascade,
  buyer_name    text not null,
  buyer_phone   text,
  buyer_email   text,
  visit_date    date not null,
  visit_time    time,
  message       text,
  status        visit_status not null default 'PENDIENTE',
  agent         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists visit_requests_user_id_idx on visit_requests(user_id);

drop trigger if exists visit_requests_updated_at on visit_requests;
create trigger visit_requests_updated_at before update on visit_requests
  for each row execute function set_updated_at();

-- ────────────────────── publish_requests ──────────────────────

create table if not exists publish_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  property_id   uuid not null references properties(id) on delete cascade,
  portal        text not null,
  status        publish_status not null default 'SOLICITADO',
  listing_url   text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (property_id, portal)
);

create index if not exists publish_requests_user_id_idx on publish_requests(user_id);

drop trigger if exists publish_requests_updated_at on publish_requests;
create trigger publish_requests_updated_at before update on publish_requests
  for each row execute function set_updated_at();

-- ═══════════════════ Row Level Security ═══════════════════
-- Sin esto, cualquiera con la clave pública lee la base entera.

alter table profiles            enable row level security;
alter table properties          enable row level security;
alter table property_photos     enable row level security;
alter table operations          enable row level security;
alter table operation_tasks     enable row level security;
alter table operation_documents enable row level security;
alter table operation_risks     enable row level security;
alter table operation_relations enable row level security;
alter table visit_requests      enable row level security;
alter table publish_requests    enable row level security;

drop policy if exists "profiles_own" on profiles;
create policy "profiles_own" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "properties_own" on properties;
create policy "properties_own" on properties
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "property_photos_own" on property_photos;
create policy "property_photos_own" on property_photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "operations_own" on operations;
create policy "operations_own" on operations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "operation_tasks_own" on operation_tasks;
create policy "operation_tasks_own" on operation_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "operation_documents_own" on operation_documents;
create policy "operation_documents_own" on operation_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "operation_risks_own" on operation_risks;
create policy "operation_risks_own" on operation_risks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "operation_relations_own" on operation_relations;
create policy "operation_relations_own" on operation_relations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "visit_requests_own" on visit_requests;
create policy "visit_requests_own" on visit_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "publish_requests_own" on publish_requests;
create policy "publish_requests_own" on publish_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Refresca el cache de la API para que las tablas aparezcan enseguida.
notify pgrst, 'reload schema';
