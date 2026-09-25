-- ════════════════════════════════════════════════════════════════════════
-- Participantes de una operación
--
-- La pestaña "Equipo" existía y renderizaba una lista siempre vacía: el
-- campo `participants` nacía en `[]` y nunca se llenaba. No era una mentira
-- como el mock de consejos, pero sí una promesa sin cumplir.
--
-- Quiénes son: el escribano, el martillero, el contador, el vendedor, la
-- contraparte. Gente real, con teléfono real. Por eso:
--
-- - Los datos de contacto son de TERCEROS, no del usuario. RLS los ata a
--   quien los cargó y no hay ninguna vista pública que los exponga.
-- - No se comparten entre operaciones aunque sea el mismo escribano. Si
--   mañana hay agenda de contactos, se construye aparte y con consentimiento.
--
-- Tabla nueva y aditiva.
-- ════════════════════════════════════════════════════════════════════════

do $$ begin create type participant_role as enum (
  'NOTARY',        -- escribano
  'BROKER',        -- martillero / inmobiliaria
  'ACCOUNTANT',    -- contador
  'LAWYER',
  'APPRAISER',     -- tasador
  'COUNTERPARTY',  -- la otra parte de la operación
  'BANK',
  'OTHER'
);
exception when duplicate_object then null; end $$;

create table if not exists operation_participants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null references operations(id) on delete cascade,

  name         text not null check (length(trim(name)) > 0),
  role         participant_role not null default 'OTHER',

  email        text,
  phone        text,
  -- "Atiende de 9 a 13", "lo recomendó Juan". Lo que ayuda a trabajar con
  -- esa persona y no entra en ningún campo estructurado.
  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists operation_participants_operation_idx
  on operation_participants(operation_id);

drop trigger if exists operation_participants_updated_at on operation_participants;
create trigger operation_participants_updated_at before update on operation_participants
  for each row execute function set_updated_at();

-- ─────────────────────── RLS ───────────────────────
-- Son datos de contacto de terceros: solo los ve quien los cargó.

alter table operation_participants enable row level security;

drop policy if exists operation_participants_select_own on operation_participants;
create policy operation_participants_select_own on operation_participants
  for select using (auth.uid() = user_id);

drop policy if exists operation_participants_insert_own on operation_participants;
create policy operation_participants_insert_own on operation_participants
  for insert with check (auth.uid() = user_id);

drop policy if exists operation_participants_update_own on operation_participants;
create policy operation_participants_update_own on operation_participants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists operation_participants_delete_own on operation_participants;
create policy operation_participants_delete_own on operation_participants
  for delete using (auth.uid() = user_id);

notify pgrst, 'reload schema';
