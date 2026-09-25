-- ════════════════════════════════════════════════════════════════════════
-- Activity Ledger
--
-- El problema que resuelve: alguien vuelve a su operación después de dos
-- semanas y no tiene forma de saber qué pasó mientras no estaba. Hoy ve un
-- estado, no una historia.
--
-- Dos decisiones que atraviesan el diseño:
--
-- 1. **Los eventos los escriben TRIGGERS, no la aplicación.** Un ledger que
--    depende de que cada pantalla se acuerde de registrar es un ledger con
--    agujeros, y un agujero en un historial es peor que no tenerlo: da
--    confianza falsa. Si la fila cambió, el evento existe.
--
-- 2. **Es append-only.** No hay política de update ni de delete. Un historial
--    que se puede editar no sirve para lo único que sirve un historial:
--    resolver un "yo no dije eso" dentro de seis meses.
--
-- Guardamos el hecho, no la interpretación: "ofertaste USD 185.000", no
-- "hiciste una oferta agresiva".
-- ════════════════════════════════════════════════════════════════════════

do $$ begin create type activity_kind as enum (
  'OPERATION_CREATED',
  'DOCUMENT_REQUESTED',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_STATUS_CHANGED',
  'DOCUMENT_REMOVED',
  'OFFER_CREATED',
  'OFFER_SENT',
  'OFFER_STATUS_CHANGED',
  'PROPERTY_PROMOTED',
  'NOTE_ADDED'
);
exception when duplicate_object then null; end $$;

create table if not exists activity_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null references operations(id) on delete cascade,

  kind         activity_kind not null,

  -- Una línea en castellano, lista para mostrar. La arma el trigger con los
  -- datos de la fila: no se calcula después ni se traduce en la pantalla,
  -- así que dice lo mismo hoy que dentro de un año.
  summary      text not null,
  detail       text,

  -- Lo que haga falta para reconstruir el hecho (monto, estado anterior).
  -- jsonb y no columnas sueltas porque cada tipo de evento guarda lo suyo.
  metadata     jsonb not null default '{}'::jsonb,

  created_at   timestamptz not null default now()
);

create index if not exists activity_events_operation_idx
  on activity_events(operation_id, created_at desc);

-- ─────────────────────── RLS ───────────────────────
-- Solo lectura para el dueño. Nadie edita ni borra un evento: los triggers
-- insertan como SECURITY DEFINER.

alter table activity_events enable row level security;

drop policy if exists activity_events_select_own on activity_events;
create policy activity_events_select_own on activity_events
  for select using (auth.uid() = user_id);

-- Sin políticas de insert/update/delete: no hay forma de escribir ni de
-- borrar un evento desde el cliente. El historial es lo que pasó.

-- ─────────────────────── Escritura ───────────────────────

create or replace function log_activity(
  p_user_id      uuid,
  p_operation_id uuid,
  p_kind         activity_kind,
  p_summary      text,
  p_detail       text default null,
  p_metadata     jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into activity_events (user_id, operation_id, kind, summary, detail, metadata)
  values (p_user_id, p_operation_id, p_kind, p_summary, p_detail, p_metadata);
end $$;

-- Formatea un monto como lo lee una persona: "USD 185.000".
create or replace function fmt_money(p_amount numeric, p_currency text)
returns text
language sql
immutable
as $$
  select p_currency || ' ' || to_char(p_amount, 'FM999G999G999D99')
$$;

-- ─────────────────────── Documentos ───────────────────────

create or replace function on_document_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    perform log_activity(
      new.user_id, new.operation_id, 'DOCUMENT_REQUESTED',
      'Agregaste el documento "' || new.name || '"',
      null,
      jsonb_build_object('document_id', new.id, 'category', new.category)
    );
    return new;
  end if;

  -- Llegó el archivo por primera vez, o se subió una versión nueva.
  if new.storage_path is distinct from old.storage_path and new.storage_path is not null then
    perform log_activity(
      new.user_id, new.operation_id, 'DOCUMENT_UPLOADED',
      case when new.version > 1
        then 'Subiste una versión nueva de "' || new.name || '"'
        else 'Subiste "' || new.name || '"' end,
      null,
      jsonb_build_object('document_id', new.id, 'version', new.version)
    );
  elsif new.status is distinct from old.status then
    perform log_activity(
      new.user_id, new.operation_id, 'DOCUMENT_STATUS_CHANGED',
      '"' || new.name || '" pasó a ' || new.status,
      null,
      jsonb_build_object('document_id', new.id, 'from', old.status, 'to', new.status)
    );
  end if;

  return new;
end $$;

drop trigger if exists operation_documents_activity on operation_documents;
create trigger operation_documents_activity
  after insert or update on operation_documents
  for each row execute function on_document_change();

-- ─────────────────────── Ofertas ───────────────────────

create or replace function on_offer_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who text;
begin
  who := case when coalesce(new.party::text, 'BUYER') = 'BUYER'
              then 'Ofertaste ' else 'Te contraofertaron ' end;

  if TG_OP = 'INSERT' then
    perform log_activity(
      new.user_id, new.operation_id,
      case when new.status = 'SENT' then 'OFFER_SENT' else 'OFFER_CREATED' end,
      case when new.status = 'SENT'
        then who || fmt_money(new.amount, new.currency)
        else 'Guardaste un borrador de oferta por ' || fmt_money(new.amount, new.currency) end,
      new.message,
      jsonb_build_object('offer_id', new.id, 'amount', new.amount, 'currency', new.currency)
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    perform log_activity(
      new.user_id, new.operation_id, 'OFFER_STATUS_CHANGED',
      'La oferta de ' || fmt_money(new.amount, new.currency) || ' pasó a ' || new.status,
      new.response_note,
      jsonb_build_object('offer_id', new.id, 'from', old.status, 'to', new.status)
    );
  end if;

  return new;
end $$;

drop trigger if exists offers_activity on offers;
create trigger offers_activity
  after insert or update on offers
  for each row execute function on_offer_change();

-- ─────────────────── Promoción de una propiedad ───────────────────

create or replace function on_property_promoted() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.promoted_operation_id is not null
     and new.promoted_operation_id is distinct from old.promoted_operation_id then
    perform log_activity(
      new.user_id, new.promoted_operation_id, 'PROPERTY_PROMOTED',
      'Avanzaste con "' || coalesce(new.title, 'esta propiedad') || '"',
      null,
      jsonb_build_object('property_id', new.id)
    );
  end if;
  return new;
end $$;

drop trigger if exists properties_promoted_activity on properties;
create trigger properties_promoted_activity
  after update on properties
  for each row execute function on_property_promoted();

-- ─────────────────── Alta de la operación ───────────────────

create or replace function on_operation_created() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform log_activity(
    new.user_id, new.id, 'OPERATION_CREATED',
    'Creaste la operación "' || new.title || '"',
    null, '{}'::jsonb
  );
  return new;
end $$;

drop trigger if exists operations_activity on operations;
create trigger operations_activity
  after insert on operations
  for each row execute function on_operation_created();

notify pgrst, 'reload schema';
