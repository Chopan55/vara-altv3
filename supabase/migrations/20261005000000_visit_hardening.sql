-- ════════════════════════════════════════════════════════════════════════
-- VARA Visit — endurecimiento de seguridad (Corte 0)
--
-- Por qué existe: RLS decide qué FILAS ve y escribe cada uno, pero no QUÉ
-- COLUMNAS ni QUÉ TRANSICIONES. Con las políticas originales:
--   · cualquier usuario podía hacerse ADMIN (profiles.role),
--   · un partner podía autoverificarse y autoactivarse,
--   · el partner asignado podía LEER el PIN que prueba que el cliente lo autorizó,
--   · el contador de intentos del PIN lo mandaba el cliente,
--   · cualquiera podía suspender a cualquier partner con un incidente falso.
--
-- Principio: lo que importa se valida en la base, no en el navegador.
--   · triggers de guarda: cada actor solo puede tocar lo que le corresponde;
--   · funciones RPC (SECURITY DEFINER) para lo que no puede hacer el cliente solo
--     (verificar PIN, ver PIN, aprobar partner, resetear PIN);
--   · audit_events de solo inserción.
--
-- "Externo" = llamada desde la API con rol authenticated/anon. El SQL Editor y
-- service_role son internos y no pasan por estas guardas (arreglos de emergencia).
--
-- Pendiente a propósito (cortes siguientes):
--   · access_instructions y dirección completa se ven apenas hay asignación
--     (se rediseñan con la cadena de custodia de accesos, Corte 3);
--   · el precio lo manda el cliente (cálculo server-side en Corte 2);
--   · checklist obligatorio de check-out se valida solo en TypeScript;
--   · el PIN no vence por horario (requiere zona horaria por jurisdicción);
--   · contadores completed_visits / on_time_visits (Corte 4).
--
-- Idempotente. Requiere 20260919000000 y 20260921000000 aplicadas.
-- ════════════════════════════════════════════════════════════════════════

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- ───────────────────────────── Helpers ─────────────────────────────

/* true cuando la llamada viene de la API pública (no del SQL Editor ni de service_role). */
create or replace function private.is_external()
returns boolean language sql stable as $$
  select current_user in ('authenticated', 'anon')
$$;

create or replace function private.deny(p_msg text)
returns void language plpgsql as $$
begin
  raise exception '%', p_msg using errcode = '42501';
end $$;

/* Datos de una reserva sin pasar por RLS. Para guardas que corren como el llamador. */
create or replace function private.booking_ctx(p_booking_id uuid)
returns table (requester_user_id uuid, assigned_partner_id uuid, partner_user_id uuid, status vara_visit_status)
language sql stable security definer set search_path = public as $$
  select b.requester_user_id, b.assigned_partner_id, vp.user_id, b.status
  from visit_bookings b
  left join visit_partners vp on vp.id = b.assigned_partner_id
  where b.id = p_booking_id
$$;

create or replace function private.session_status_of(p_booking_id uuid)
returns session_status language sql stable security definer set search_path = public as $$
  select status from visit_sessions where booking_id = p_booking_id
$$;

create or replace function private.partner_is_active(p_partner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from visit_partners where id = p_partner_id and status = 'ACTIVE')
$$;

create or replace function private.partner_owned_by(p_partner_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user_id is not null
     and exists (select 1 from visit_partners where id = p_partner_id and user_id = p_user_id)
$$;

/* Mismo grafo que ALLOWED_TRANSITIONS en src/types/varaVisit.ts. Mantener sincronizados. */
create or replace function private.visit_transition_allowed(p_from vara_visit_status, p_to vara_visit_status)
returns boolean language sql immutable as $$
  select case p_from
    when 'REQUESTED'         then p_to in ('SEARCHING_PARTNER','ASSIGNED','CANCELLED')
    when 'SEARCHING_PARTNER' then p_to in ('ASSIGNED','CANCELLED')
    when 'ASSIGNED'          then p_to in ('CONFIRMED','SEARCHING_PARTNER','CANCELLED')
    when 'CONFIRMED'         then p_to in ('PARTNER_EN_ROUTE','ARRIVED','CANCELLED','INCIDENT_REVIEW')
    when 'PARTNER_EN_ROUTE'  then p_to in ('ARRIVED','CANCELLED','INCIDENT_REVIEW')
    when 'ARRIVED'           then p_to in ('IN_PROGRESS','CANCELLED','INCIDENT_REVIEW')
    when 'IN_PROGRESS'       then p_to in ('COMPLETED','INCIDENT_REVIEW')
    when 'COMPLETED'         then p_to in ('INCIDENT_REVIEW')
    when 'INCIDENT_REVIEW'   then p_to in ('COMPLETED','CANCELLED')
    else false
  end
$$;

/* PIN de 4 dígitos con aleatoriedad criptográfica (gen_random_uuid usa el CSPRNG de Postgres). */
create or replace function private.generate_pin()
returns text language sql volatile as $$
  select lpad(
    ((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 10000)::text,
    4, '0')
$$;

-- ──────────────────────── Audit log (append-only) ────────────────────────

create table if not exists audit_events (
  id            bigserial primary key,
  at            timestamptz not null default now(),
  -- Sin FK: la auditoría tiene que sobrevivir al borrado de un usuario.
  actor_user_id uuid,
  actor_role    text not null default 'SYSTEM',
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  booking_id    uuid,
  -- Sin PII, sin coordenadas, sin instrucciones de acceso.
  metadata      jsonb not null default '{}'::jsonb
);

create index if not exists audit_events_entity_idx  on audit_events(entity_type, entity_id);
create index if not exists audit_events_booking_idx on audit_events(booking_id);
create index if not exists audit_events_at_idx      on audit_events(at);

alter table audit_events enable row level security;

drop policy if exists "audit_events_admin_read" on audit_events;
create policy "audit_events_admin_read" on audit_events
  for select using (is_admin());

revoke insert, update, delete, truncate on audit_events from anon, authenticated;

create or replace function private.audit_events_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_events es append-only' using errcode = '42501';
end $$;

drop trigger if exists audit_events_no_change on audit_events;
create trigger audit_events_no_change before update or delete on audit_events
  for each row execute function private.audit_events_immutable();

drop trigger if exists audit_events_no_truncate on audit_events;
create trigger audit_events_no_truncate before truncate on audit_events
  for each statement execute function private.audit_events_immutable();

create or replace function private.actor_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role::text from profiles where id = auth.uid()), 'SYSTEM')
$$;

create or replace function private.audit_log(
  p_action text, p_entity_type text, p_entity_id uuid,
  p_booking_id uuid default null, p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_id, booking_id, metadata)
  values (auth.uid(), private.actor_role(), p_action, p_entity_type, p_entity_id, p_booking_id,
          coalesce(p_metadata, '{}'::jsonb));
end $$;

-- ───────────────────────── profiles: el rol no se toca ─────────────────────────
-- Antes: `for all using (auth.uid() = id)` → cualquiera hacía
--   update profiles set role = 'ADMIN'
-- y pasaba todos los is_admin() del sistema.

drop policy if exists "profiles_own" on profiles;
drop policy if exists "profiles_select_own" on profiles;
drop policy if exists "profiles_insert_own" on profiles;
drop policy if exists "profiles_update_own" on profiles;

create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function private.profiles_guard()
returns trigger language plpgsql as $$
begin
  if not private.is_external() then return new; end if;
  if tg_op = 'INSERT' then
    new.role := 'CLIENT';
  elsif new.role is distinct from old.role then
    perform private.deny('profiles.role solo lo cambia un proceso interno');
  end if;
  return new;
end $$;

drop trigger if exists profiles_a_guard on profiles;
create trigger profiles_a_guard before insert or update on profiles
  for each row execute function private.profiles_guard();

create or replace function private.profiles_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    perform private.audit_log('ROLE_CHANGED', 'profile', new.id, null,
      jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  return new;
end $$;

drop trigger if exists profiles_z_audit on profiles;
create trigger profiles_z_audit after update on profiles
  for each row execute function private.profiles_audit();

-- ───────────────────────── visit_partners ─────────────────────────
-- El partner edita su perfil, no su verificación, nivel, métricas ni estado.

create or replace function private.visit_partners_guard()
returns trigger language plpgsql as $$
declare
  v_admin boolean;
begin
  if not private.is_external() then return new; end if;
  v_admin := is_admin();

  if tg_op = 'INSERT' then
    if not v_admin then
      new.status := 'DRAFT';
      new.tier := 'TRAINEE';
      new.onboarding_status := 'IN_PROGRESS';
      new.verified_identity := false;
      new.verified_document := false;
      new.verified_phone := false;
      new.verified_email := false;
      new.certified := false;
      new.total_visits := 0;
      new.completed_visits := 0;
      new.cancelled_visits := 0;
      new.on_time_visits := 0;
      new.rating_sum := 0;
      new.review_count := 0;
      new.incident_count := 0;
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    perform private.deny('visit_partners.user_id es inmutable');
  end if;

  if v_admin then
    -- Activar a alguien que nunca estuvo activo pasa por admin_approve_partner,
    -- que chequea los requisitos contra el estado real.
    if new.status = 'ACTIVE' and old.status in ('DRAFT', 'PENDING_APPROVAL') then
      perform private.deny('Usá admin_approve_partner para activar un partner nuevo');
    end if;
    return new;
  end if;

  if (new.tier, new.verified_identity, new.verified_document, new.verified_phone, new.verified_email,
      new.certified, new.total_visits, new.completed_visits, new.cancelled_visits, new.on_time_visits,
      new.rating_sum, new.review_count, new.incident_count)
     is distinct from
     (old.tier, old.verified_identity, old.verified_document, old.verified_phone, old.verified_email,
      old.certified, old.total_visits, old.completed_visits, old.cancelled_visits, old.on_time_visits,
      old.rating_sum, old.review_count, old.incident_count) then
    perform private.deny('Verificación, nivel y métricas no las edita el partner');
  end if;

  if new.status is distinct from old.status then
    if not ((old.status, new.status) in (
        ('DRAFT', 'PENDING_APPROVAL'),
        ('ACTIVE', 'PAUSED_BY_PARTNER'),
        ('PAUSED_BY_PARTNER', 'ACTIVE'))) then
      perform private.deny('Transición de estado no permitida para el partner');
    end if;
  end if;

  if new.onboarding_status is distinct from old.onboarding_status then
    if not (old.onboarding_status in ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW')
            and new.onboarding_status in ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW')) then
      perform private.deny('onboarding_status lo resuelve VARA');
    end if;
  end if;

  return new;
end $$;

drop trigger if exists visit_partners_a_guard on visit_partners;
create trigger visit_partners_a_guard before insert or update on visit_partners
  for each row execute function private.visit_partners_guard();

/* Quien crea un perfil de partner pasa a rol PARTNER. Lo hace la base, no el cliente. */
create or replace function private.visit_partners_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles set role = 'PARTNER' where id = new.user_id and role = 'CLIENT';
  perform private.audit_log('PARTNER_CREATED', 'visit_partner', new.id, null, '{}'::jsonb);
  return new;
end $$;

drop trigger if exists visit_partners_z_after_insert on visit_partners;
create trigger visit_partners_z_after_insert after insert on visit_partners
  for each row execute function private.visit_partners_after_insert();

create or replace function private.visit_partners_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform private.audit_log('PARTNER_STATUS', 'visit_partner', new.id, null,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.tier is distinct from old.tier then
    perform private.audit_log('PARTNER_TIER', 'visit_partner', new.id, null,
      jsonb_build_object('from', old.tier, 'to', new.tier));
  end if;
  if (new.verified_identity, new.verified_document, new.certified)
     is distinct from (old.verified_identity, old.verified_document, old.certified) then
    perform private.audit_log('PARTNER_VERIFICATION', 'visit_partner', new.id, null,
      jsonb_build_object('identity', new.verified_identity, 'document', new.verified_document,
                         'certified', new.certified));
  end if;
  return new;
end $$;

drop trigger if exists visit_partners_z_audit on visit_partners;
create trigger visit_partners_z_audit after update on visit_partners
  for each row execute function private.visit_partners_audit();

-- ──────────────── partner_training / references / contacts ────────────────

create or replace function private.partner_training_guard()
returns trigger language plpgsql as $$
begin
  if not private.is_external() or is_admin() then return new; end if;

  if not private.partner_owned_by(new.partner_id, auth.uid()) then
    perform private.deny('partner_training: el partner no es tuyo');
  end if;

  if tg_op = 'INSERT' then
    new.certification_status := 'NOT_STARTED';
    new.quiz_score := null;
    new.quiz_attempts := 0;
    new.certification_date := null;
    new.expiration_date := null;
    return new;
  end if;

  if new.partner_id is distinct from old.partner_id or new.user_id is distinct from old.user_id then
    perform private.deny('partner_training: claves inmutables');
  end if;
  if new.certification_date is distinct from old.certification_date
     or new.expiration_date is distinct from old.expiration_date then
    perform private.deny('La fecha de certificación la fija VARA');
  end if;
  -- El partner puede avanzar o fallar, nunca certificarse ni vencerse a sí mismo.
  if new.certification_status is distinct from old.certification_status
     and new.certification_status in ('CERTIFIED', 'EXPIRED') then
    perform private.deny('Certificar es decisión de VARA');
  end if;
  if old.certification_status in ('CERTIFIED', 'EXPIRED')
     and new.certification_status is distinct from old.certification_status then
    perform private.deny('Una certificación vigente no la baja el partner');
  end if;
  return new;
end $$;

drop trigger if exists partner_training_a_guard on partner_training;
create trigger partner_training_a_guard before insert or update on partner_training
  for each row execute function private.partner_training_guard();

/* partner_training.certification_status manda; visit_partners.certified es su espejo. */
create or replace function private.partner_training_mirror()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update visit_partners
     set certified = (new.certification_status = 'CERTIFIED')
   where id = new.partner_id
     and certified is distinct from (new.certification_status = 'CERTIFIED');
  return new;
end $$;

drop trigger if exists partner_training_z_mirror on partner_training;
create trigger partner_training_z_mirror after insert or update on partner_training
  for each row execute function private.partner_training_mirror();

create or replace function private.partner_references_guard()
returns trigger language plpgsql as $$
begin
  if not private.is_external() or is_admin() then return new; end if;

  if not private.partner_owned_by(new.partner_id, auth.uid()) then
    perform private.deny('partner_references: el partner no es tuyo');
  end if;

  if tg_op = 'INSERT' then
    new.status := 'PENDING';
    new.requested_at := null;
    new.responded_at := null;
    new.answers := null;
    return new;
  end if;

  if new.partner_id is distinct from old.partner_id or new.user_id is distinct from old.user_id then
    perform private.deny('partner_references: claves inmutables');
  end if;
  if new.answers is distinct from old.answers or new.responded_at is distinct from old.responded_at then
    perform private.deny('Las respuestas de una referencia las carga VARA');
  end if;
  if new.status is distinct from old.status then
    if not (old.status = 'PENDING' and new.status = 'REQUESTED') then
      perform private.deny('El estado de una referencia lo resuelve VARA');
    end if;
    new.requested_at := now();
  elsif new.requested_at is distinct from old.requested_at then
    perform private.deny('requested_at lo fija el sistema');
  end if;
  return new;
end $$;

drop trigger if exists partner_references_a_guard on partner_references;
create trigger partner_references_a_guard before insert or update on partner_references
  for each row execute function private.partner_references_guard();

create or replace function private.partner_contacts_guard()
returns trigger language plpgsql as $$
begin
  if not private.is_external() or is_admin() then return new; end if;
  if not private.partner_owned_by(new.partner_id, auth.uid()) then
    perform private.deny('partner_contacts: el partner no es tuyo');
  end if;
  return new;
end $$;

drop trigger if exists partner_contacts_a_guard on partner_contacts;
create trigger partner_contacts_a_guard before insert or update on partner_contacts
  for each row execute function private.partner_contacts_guard();

-- ───────────────────────── PIN: server-side ─────────────────────────
-- Antes: confirmation_pin vivía en visit_bookings. RLS filtra filas, no columnas:
-- el partner asignado (que puede leer la reserva) podía leer el PIN que se supone
-- que solo tiene el cliente. Ahora vive en una tabla sin ninguna política: solo
-- las funciones de abajo (SECURITY DEFINER) la tocan.
--
-- Texto plano a propósito: el cliente tiene que poder verlo. La protección es
-- que nadie más lo lee, que se bloquea a los 3 intentos y que se usa una vez.

create table if not exists visit_pins (
  booking_id    uuid primary key references visit_bookings(id) on delete cascade,
  pin           text not null,
  attempts      int not null default 0,
  locked_at     timestamptz,
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now()
);

alter table visit_pins enable row level security;
revoke all on visit_pins from anon, authenticated;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'visit_bookings'
               and column_name = 'confirmation_pin') then
    insert into visit_pins (booking_id, pin)
      select id, confirmation_pin from visit_bookings where confirmation_pin is not null
      on conflict (booking_id) do nothing;
    alter table visit_bookings drop column confirmation_pin;
  end if;
end $$;

-- Reservas viejas sin PIN (si las hubiera) reciben uno.
insert into visit_pins (booking_id, pin)
  select b.id, private.generate_pin() from visit_bookings b
  where not exists (select 1 from visit_pins p where p.booking_id = b.id);

create or replace function public.get_booking_pin(p_booking_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  ctx record;
  v_pin text;
begin
  select * into ctx from private.booking_ctx(p_booking_id);
  if not found or auth.uid() is null or ctx.requester_user_id is distinct from auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if ctx.status in ('COMPLETED', 'CANCELLED', 'INCIDENT_REVIEW') then return null; end if;

  select pin into v_pin from visit_pins where booking_id = p_booking_id;
  perform private.audit_log('PIN_VIEWED', 'visit_booking', p_booking_id, p_booking_id, '{}'::jsonb);
  return v_pin;
end $$;

/*
 * Verifica el PIN que dice el partner. El contador de intentos es de la base:
 * antes lo mandaba el cliente (previousAttempts) y reseteándolo a 0 se probaban
 * los 10.000 PIN posibles.
 *
 * Devuelve jsonb en vez de lanzar error: si lanzara, el intento fallido se
 * desharía junto con la transacción y el contador nunca subiría.
 * MAX_PIN_ATTEMPTS = 3 (espejo de src/types/varaVisit.ts).
 */
create or replace function public.verify_visit_pin(p_booking_id uuid, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  ctx record;
  v_sess record;
  v_pin record;
  v_clean text := btrim(coalesce(p_pin, ''));
  v_attempts int;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  select * into ctx from private.booking_ctx(p_booking_id);
  if not found or ctx.partner_user_id is distinct from v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if ctx.status not in ('CONFIRMED', 'PARTNER_EN_ROUTE', 'ARRIVED') then
    return jsonb_build_object('ok', false, 'reason', 'NOT_READY', 'attemptsLeft', 0);
  end if;

  select * into v_sess from visit_sessions where booking_id = p_booking_id;
  if not found or v_sess.status <> 'CHECKED_IN' then
    return jsonb_build_object('ok', false, 'reason', 'NOT_CHECKED_IN', 'attemptsLeft', 0);
  end if;

  select * into v_pin from visit_pins where booking_id = p_booking_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NO_PIN', 'attemptsLeft', 0);
  end if;

  if v_pin.confirmed_at is not null then
    return jsonb_build_object('ok', true);
  end if;
  if v_pin.locked_at is not null or v_pin.attempts >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'TOO_MANY_ATTEMPTS', 'attemptsLeft', 0);
  end if;

  -- Un error de tipeo no consume intento.
  if v_clean !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'reason', 'MALFORMED', 'attemptsLeft', 3 - v_pin.attempts);
  end if;

  if v_clean = v_pin.pin then
    update visit_pins set confirmed_at = now() where booking_id = p_booking_id;
    update visit_sessions
       set confirmation_pin_status = 'CONFIRMED', pin_attempts = v_pin.attempts
     where booking_id = p_booking_id;
    perform private.audit_log('PIN_CONFIRMED', 'visit_booking', p_booking_id, p_booking_id,
      jsonb_build_object('attempts', v_pin.attempts));
    return jsonb_build_object('ok', true);
  end if;

  v_attempts := v_pin.attempts + 1;
  update visit_pins
     set attempts = v_attempts,
         locked_at = case when v_attempts >= 3 then now() else null end
   where booking_id = p_booking_id;
  update visit_sessions
     set pin_attempts = v_attempts,
         confirmation_pin_status = case when v_attempts >= 3 then 'FAILED'::pin_status else 'PENDING'::pin_status end
   where booking_id = p_booking_id;
  perform private.audit_log('PIN_FAILED', 'visit_booking', p_booking_id, p_booking_id,
    jsonb_build_object('attempts', v_attempts, 'locked', v_attempts >= 3));

  return jsonb_build_object(
    'ok', false,
    'reason', case when v_attempts >= 3 then 'TOO_MANY_ATTEMPTS' else 'WRONG_PIN' end,
    'attemptsLeft', greatest(0, 3 - v_attempts));
end $$;

/* Después de un bloqueo, soporte de VARA genera un PIN nuevo. */
create or replace function public.admin_reset_pin(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update visit_pins
     set pin = private.generate_pin(), attempts = 0, locked_at = null, confirmed_at = null
   where booking_id = p_booking_id;
  update visit_sessions
     set confirmation_pin_status = 'PENDING', pin_attempts = 0
   where booking_id = p_booking_id;
  perform private.audit_log('PIN_RESET', 'visit_booking', p_booking_id, p_booking_id, '{}'::jsonb);
end $$;

-- ───────────────────────── visit_bookings ─────────────────────────

create or replace function private.visit_bookings_guard()
returns trigger language plpgsql as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_ctx record;
  v_is_requester boolean;
  v_is_partner boolean;
  v_session session_status;
  v_ok boolean := false;
begin
  if not private.is_external() then return new; end if;
  v_admin := is_admin();

  if tg_op = 'INSERT' then
    if new.status not in ('REQUESTED', 'SEARCHING_PARTNER', 'ASSIGNED') then
      perform private.deny('Una reserva nueva no puede nacer en ese estado');
    end if;
    if new.assigned_partner_id is not null then
      if new.status <> 'ASSIGNED' then
        perform private.deny('Reserva con partner debe nacer ASSIGNED');
      end if;
      if not private.partner_is_active(new.assigned_partner_id) then
        perform private.deny('El partner elegido no está activo');
      end if;
    elsif new.status = 'ASSIGNED' then
      perform private.deny('ASSIGNED requiere partner');
    end if;
    new.cancellation_reason := null;
    return new;
  end if;

  if new.id <> old.id or new.visit_code <> old.visit_code
     or new.requester_user_id <> old.requester_user_id then
    perform private.deny('Identificadores de la reserva inmutables');
  end if;

  select * into v_ctx from private.booking_ctx(old.id);
  v_is_requester := v_uid is not null and old.requester_user_id = v_uid;
  v_is_partner := v_uid is not null and v_ctx.partner_user_id = v_uid;

  if not v_admin then
    if (new.service_type, new.price, new.currency, new.assignment_mode, new.requested_date,
        new.requested_time, new.duration_minutes, new.location_label, new.property_id, new.operation_id)
       is distinct from
       (old.service_type, old.price, old.currency, old.assignment_mode, old.requested_date,
        old.requested_time, old.duration_minutes, old.location_label, old.property_id, old.operation_id) then
      perform private.deny('Precio, servicio, fecha y lugar no se editan una vez creada la reserva');
    end if;

    if (new.instructions, new.access_instructions, new.guests_expected)
       is distinct from (old.instructions, old.access_instructions, old.guests_expected) then
      if not v_is_requester or old.status in ('COMPLETED', 'CANCELLED') then
        perform private.deny('Solo quien pidió la visita edita las instrucciones');
      end if;
    end if;
  end if;

  if new.assigned_partner_id is distinct from old.assigned_partner_id then
    if v_admin then
      if new.assigned_partner_id is not null and not private.partner_is_active(new.assigned_partner_id) then
        perform private.deny('El partner asignado no está activo');
      end if;
    else
      perform private.deny('Solo VARA asigna partners (para rechazar usá reject_assignment)');
    end if;
  end if;

  if new.status is distinct from old.status then
    if not private.visit_transition_allowed(old.status, new.status) then
      perform private.deny('Transición de estado inválida: ' || old.status || ' → ' || new.status);
    end if;
    if new.status = 'ASSIGNED' and new.assigned_partner_id is null then
      perform private.deny('ASSIGNED requiere partner');
    end if;

    if not v_admin then
      v_session := private.session_status_of(old.id);

      if v_is_requester and new.status = 'CANCELLED'
         and old.status in ('REQUESTED', 'SEARCHING_PARTNER', 'ASSIGNED', 'CONFIRMED',
                            'PARTNER_EN_ROUTE', 'ARRIVED') then
        v_ok := true;
      end if;

      if v_is_partner then
        v_ok := v_ok or (
             (old.status = 'ASSIGNED' and new.status = 'CONFIRMED')
          or (old.status = 'CONFIRMED' and new.status = 'PARTNER_EN_ROUTE')
          or (old.status in ('CONFIRMED', 'PARTNER_EN_ROUTE') and new.status = 'ARRIVED'
              and v_session is not distinct from 'CHECKED_IN')
          or (old.status = 'ARRIVED' and new.status = 'IN_PROGRESS'
              and v_session is not distinct from 'IN_PROGRESS')
          or (old.status = 'IN_PROGRESS' and new.status = 'COMPLETED'
              and v_session is not distinct from 'CHECKED_OUT')
          or (new.status = 'CANCELLED' and old.status in ('ASSIGNED', 'CONFIRMED', 'PARTNER_EN_ROUTE'))
        );
      end if;

      if v_ok is not true then
        perform private.deny('Ese actor no puede hacer esa transición: ' || old.status || ' → ' || new.status);
      end if;
    end if;
  elsif new.cancellation_reason is distinct from old.cancellation_reason and not v_admin then
    perform private.deny('El motivo de cancelación se fija al cancelar');
  end if;

  return new;
end $$;

drop trigger if exists visit_bookings_a_guard on visit_bookings;
create trigger visit_bookings_a_guard before insert or update on visit_bookings
  for each row execute function private.visit_bookings_guard();

/*
 * Rechazar una asignación es una RPC y no un update directo.
 *
 * Postgres exige que la fila NUEVA siga siendo visible para quien actualiza
 * (política de SELECT). Al rechazar, assigned_partner_id pasa a null y el
 * partner deja de ver la reserva, así que el update directo fallaba. Era un bug
 * latente del diseño original. Como RPC además se validan estado y actor, y
 * queda registrado en visit_assignments y en el audit log.
 */
create or replace function public.reject_assignment(p_booking_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  ctx record;
begin
  select * into ctx from private.booking_ctx(p_booking_id);
  if not found or auth.uid() is null or ctx.partner_user_id is distinct from auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if ctx.status <> 'ASSIGNED' then
    raise exception 'Solo se rechaza una asignación pendiente (estado actual: %)', ctx.status
      using errcode = '42501';
  end if;

  update visit_assignments
     set rejected_at = now(), rejection_reason = p_reason
   where booking_id = p_booking_id and partner_id = ctx.assigned_partner_id and rejected_at is null;

  update visit_bookings
     set status = 'SEARCHING_PARTNER', assigned_partner_id = null
   where id = p_booking_id;

  perform private.audit_log('ASSIGNMENT_REJECTED', 'visit_booking', p_booking_id, p_booking_id, '{}'::jsonb);
end $$;

create or replace function private.visit_bookings_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into visit_pins (booking_id, pin) values (new.id, private.generate_pin())
      on conflict (booking_id) do nothing;
    perform private.audit_log('BOOKING_CREATED', 'visit_booking', new.id, new.id,
      jsonb_build_object('service', new.service_type, 'status', new.status));
    return new;
  end if;

  if new.status is distinct from old.status then
    perform private.audit_log('BOOKING_STATUS', 'visit_booking', new.id, new.id,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.assigned_partner_id is distinct from old.assigned_partner_id then
    perform private.audit_log('BOOKING_PARTNER', 'visit_booking', new.id, new.id,
      jsonb_build_object('from', old.assigned_partner_id, 'to', new.assigned_partner_id));
  end if;
  return new;
end $$;

drop trigger if exists visit_bookings_z_after on visit_bookings;
create trigger visit_bookings_z_after after insert or update on visit_bookings
  for each row execute function private.visit_bookings_after();

-- ───────────────────────── visit_assignments ─────────────────────────

drop policy if exists "visit_assignments_write" on visit_assignments;
create policy "visit_assignments_write" on visit_assignments
  for insert with check (
    is_admin()
    or (
      -- El cliente solo registra la asignación del partner que él mismo eligió al crear.
      booking_id in (select id from visit_bookings where requester_user_id = auth.uid())
      and partner_id = (select b.assigned_partner_id from visit_bookings b where b.id = booking_id)
    )
  );

create or replace function private.visit_assignments_guard()
returns trigger language plpgsql as $$
begin
  if not private.is_external() or is_admin() then return new; end if;
  if (new.booking_id, new.partner_id, new.assigned_at)
     is distinct from (old.booking_id, old.partner_id, old.assigned_at) then
    perform private.deny('La asignación no se reescribe');
  end if;
  return new;
end $$;

drop trigger if exists visit_assignments_a_guard on visit_assignments;
create trigger visit_assignments_a_guard before update on visit_assignments
  for each row execute function private.visit_assignments_guard();

-- ───────────────────────── visit_sessions ─────────────────────────
-- La hora de check-in/out la pone la base. El estado del PIN solo lo mueve
-- verify_visit_pin. Arrancar la visita sin PIN confirmado es imposible.

create or replace function private.visit_sessions_guard()
returns trigger language plpgsql as $$
declare
  ctx record;
begin
  if not private.is_external() then return new; end if;

  select * into ctx from private.booking_ctx(new.booking_id);

  if tg_op = 'INSERT' then
    if not found then
      perform private.deny('Sesión sin reserva');
    end if;
    if not is_admin() then
      if ctx.partner_user_id is distinct from auth.uid()
         or new.partner_id is distinct from ctx.assigned_partner_id then
        perform private.deny('Solo el partner asignado abre la sesión');
      end if;
      if ctx.status not in ('ASSIGNED', 'CONFIRMED', 'PARTNER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS') then
        perform private.deny('La reserva no admite sesión en este estado');
      end if;
      new.status := 'NOT_STARTED';
      new.confirmation_pin_status := 'PENDING';
      new.pin_attempts := 0;
      new.check_in_at := null;  new.check_in_lat := null;  new.check_in_lng := null;  new.check_in_accuracy_m := null;
      new.check_out_at := null; new.check_out_lat := null; new.check_out_lng := null; new.check_out_accuracy_m := null;
      new.duration_minutes := null;
      new.checklist_state := '{}'::jsonb;
    end if;
    return new;
  end if;

  if new.id <> old.id or new.booking_id <> old.booking_id or new.partner_id <> old.partner_id then
    perform private.deny('Claves de la sesión inmutables');
  end if;
  if is_admin() then return new; end if;

  if ctx.partner_user_id is distinct from auth.uid() then
    perform private.deny('Solo el partner asignado toca la sesión');
  end if;
  if (new.confirmation_pin_status, new.pin_attempts)
     is distinct from (old.confirmation_pin_status, old.pin_attempts) then
    perform private.deny('El PIN solo se confirma con verify_visit_pin');
  end if;

  if new.status is distinct from old.status then
    if old.status = 'NOT_STARTED' and new.status = 'CHECKED_IN' then
      if ctx.status not in ('CONFIRMED', 'PARTNER_EN_ROUTE') then
        perform private.deny('No se puede hacer check-in con la reserva en ' || ctx.status);
      end if;
      new.check_in_at := now();
      new.check_out_at := null; new.check_out_lat := null; new.check_out_lng := null; new.check_out_accuracy_m := null;
      new.duration_minutes := null;
    elsif old.status = 'CHECKED_IN' and new.status = 'IN_PROGRESS' then
      if old.confirmation_pin_status is distinct from 'CONFIRMED' then
        perform private.deny('La visita no arranca sin PIN confirmado');
      end if;
      if (new.check_in_at, new.check_in_lat, new.check_in_lng, new.check_in_accuracy_m)
         is distinct from (old.check_in_at, old.check_in_lat, old.check_in_lng, old.check_in_accuracy_m) then
        perform private.deny('El check-in no se reescribe');
      end if;
      new.check_out_at := null; new.check_out_lat := null; new.check_out_lng := null; new.check_out_accuracy_m := null;
      new.duration_minutes := null;
    elsif old.status = 'IN_PROGRESS' and new.status = 'CHECKED_OUT' then
      if (new.check_in_at, new.check_in_lat, new.check_in_lng, new.check_in_accuracy_m)
         is distinct from (old.check_in_at, old.check_in_lat, old.check_in_lng, old.check_in_accuracy_m) then
        perform private.deny('El check-in no se reescribe');
      end if;
      new.check_out_at := now();
      new.duration_minutes := greatest(0, ceil(extract(epoch from (now() - old.check_in_at)) / 60))::int;
    else
      perform private.deny('Transición de sesión inválida: ' || old.status || ' → ' || new.status);
    end if;
  else
    if (new.check_in_at, new.check_in_lat, new.check_in_lng, new.check_in_accuracy_m,
        new.check_out_at, new.check_out_lat, new.check_out_lng, new.check_out_accuracy_m, new.duration_minutes)
       is distinct from
       (old.check_in_at, old.check_in_lat, old.check_in_lng, old.check_in_accuracy_m,
        old.check_out_at, old.check_out_lat, old.check_out_lng, old.check_out_accuracy_m, old.duration_minutes) then
      perform private.deny('Check-in y check-out solo cambian con la transición de estado');
    end if;
    if new.checklist_state is distinct from old.checklist_state
       and old.status not in ('CHECKED_IN', 'IN_PROGRESS') then
      perform private.deny('El checklist solo se edita durante la visita');
    end if;
  end if;

  return new;
end $$;

drop trigger if exists visit_sessions_a_guard on visit_sessions;
create trigger visit_sessions_a_guard before insert or update on visit_sessions
  for each row execute function private.visit_sessions_guard();

create or replace function private.visit_sessions_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform private.audit_log('SESSION_STATUS', 'visit_session', new.id, new.booking_id,
      jsonb_build_object('from', old.status, 'to', new.status,
                         'hasLocation', (new.check_in_lat is not null or new.check_out_lat is not null)));
  end if;
  return new;
end $$;

drop trigger if exists visit_sessions_z_audit on visit_sessions;
create trigger visit_sessions_z_audit after update on visit_sessions
  for each row execute function private.visit_sessions_audit();

-- ───────────────────────── visit_reports ─────────────────────────

drop policy if exists "visit_reports_partner_write" on visit_reports;
create policy "visit_reports_partner_write" on visit_reports
  for insert with check (
    is_admin()
    or (
      partner_id in (select id from visit_partners where user_id = auth.uid())
      and booking_id in (
        select id from visit_bookings
        where assigned_partner_id = partner_id
          and status in ('IN_PROGRESS', 'COMPLETED', 'INCIDENT_REVIEW')
      )
    )
  );

drop policy if exists "visit_reports_partner_update" on visit_reports;
create policy "visit_reports_partner_update" on visit_reports
  for update using (
    is_admin()
    or (
      partner_id in (select id from visit_partners where user_id = auth.uid())
      and booking_id in (
        select id from visit_bookings
        where assigned_partner_id = partner_id
          and status in ('IN_PROGRESS', 'COMPLETED', 'INCIDENT_REVIEW')
      )
    )
  ) with check (
    is_admin()
    or (
      partner_id in (select id from visit_partners where user_id = auth.uid())
      and booking_id in (
        select id from visit_bookings
        where assigned_partner_id = partner_id
          and status in ('IN_PROGRESS', 'COMPLETED', 'INCIDENT_REVIEW')
      )
    )
  );

-- ───────────────────────── Reviews ─────────────────────────
-- Antes: cualquier usuario podía calificar a cualquier partner en cualquier
-- reserva, y editar después su calificación. Ahora: solo quien pidió una visita
-- COMPLETADA, una vez, y las métricas las actualiza un trigger.

drop policy if exists "partner_reviews_author_write" on partner_reviews;
create policy "partner_reviews_author_write" on partner_reviews
  for insert with check (
    reviewer_user_id = auth.uid()
    and booking_id in (
      select id from visit_bookings
      where requester_user_id = auth.uid()
        and status = 'COMPLETED'
        and assigned_partner_id = partner_id
    )
  );

drop policy if exists "partner_reviews_author_update" on partner_reviews;
drop policy if exists "partner_reviews_admin_update" on partner_reviews;
create policy "partner_reviews_admin_update" on partner_reviews
  for update using (is_admin()) with check (is_admin());

drop policy if exists "client_reviews_partner_write" on client_reviews;
create policy "client_reviews_partner_write" on client_reviews
  for insert with check (
    partner_id in (select id from visit_partners where user_id = auth.uid())
    and booking_id in (
      select id from visit_bookings
      where assigned_partner_id = partner_id
        and requester_user_id = client_user_id
        and status in ('COMPLETED', 'INCIDENT_REVIEW')
    )
  );

create or replace function private.recompute_partner_tier(p_partner_id uuid)
returns void language plpgsql security definer set search_path = public as $$
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

  update visit_partners set tier = v_tier where id = p_partner_id and tier is distinct from v_tier;
end $$;

drop function if exists public.recompute_partner_tier(uuid);

create or replace function private.partner_reviews_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update visit_partners
     set rating_sum = rating_sum + new.overall_rating,
         review_count = review_count + 1
   where id = new.partner_id;
  perform private.recompute_partner_tier(new.partner_id);
  perform private.audit_log('PARTNER_REVIEWED', 'visit_partner', new.partner_id, new.booking_id,
    jsonb_build_object('overall', new.overall_rating));
  return new;
end $$;

drop trigger if exists partner_reviews_z_after on partner_reviews;
create trigger partner_reviews_z_after after insert on partner_reviews
  for each row execute function private.partner_reviews_after_insert();

-- ───────────────────────── Incidentes ─────────────────────────
-- Antes: cualquiera podía reportar un LEVEL_3 contra cualquier usuario y el
-- trigger suspendía a esa persona. Ahora el reporte tiene que ser sobre la
-- contraparte de una reserva en la que el que reporta participa.

create or replace function private.safety_incidents_guard()
returns trigger language plpgsql as $$
declare
  ctx record;
  v_other uuid;
begin
  if not private.is_external() or is_admin() then return new; end if;

  new.status := 'OPEN';
  new.reviewed_at := null;
  new.reviewed_by := null;
  new.resolution := null;

  if new.booking_id is null then
    if new.reported_user_id is not null then
      perform private.deny('Un reporte sin reserva no puede apuntar a una persona');
    end if;
    return new;
  end if;

  select * into ctx from private.booking_ctx(new.booking_id);
  if not found then
    perform private.deny('Reserva inexistente');
  end if;

  if auth.uid() = ctx.requester_user_id then
    v_other := ctx.partner_user_id;
  elsif auth.uid() = ctx.partner_user_id then
    v_other := ctx.requester_user_id;
  else
    perform private.deny('Solo quienes participan de la visita la reportan');
  end if;

  if new.reported_user_id is not null and new.reported_user_id is distinct from v_other then
    perform private.deny('Solo se reporta a la contraparte de la visita');
  end if;
  return new;
end $$;

drop trigger if exists safety_incidents_a_guard on safety_incidents;
create trigger safety_incidents_a_guard before insert on safety_incidents
  for each row execute function private.safety_incidents_guard();

drop trigger if exists safety_incidents_auto_suspend on safety_incidents;
drop trigger if exists safety_incidents_bump_count on safety_incidents;
drop function if exists public.auto_suspend_on_critical_incident();
drop function if exists public.bump_partner_incident_count();

/*
 * Automatizamos el freno, no la absolución: un incidente crítico suspende
 * preventivamente y reactivar es decisión humana de un admin. Ya no es
 * abusable porque la guarda de arriba exige que el reporte sea real.
 */
create or replace function private.safety_incidents_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.reported_user_id is not null then
    update visit_partners set incident_count = incident_count + 1
     where user_id = new.reported_user_id;
    if new.severity = 'LEVEL_3_CRITICAL' then
      update visit_partners set status = 'SUSPENDED'
       where user_id = new.reported_user_id and status = 'ACTIVE';
    end if;
  end if;

  if new.booking_id is not null then
    update visit_bookings set status = 'INCIDENT_REVIEW'
     where id = new.booking_id and private.visit_transition_allowed(status, 'INCIDENT_REVIEW');
  end if;

  perform private.audit_log('INCIDENT_REPORTED', 'safety_incident', new.id, new.booking_id,
    jsonb_build_object('category', new.category, 'severity', new.severity));
  return new;
end $$;

drop trigger if exists safety_incidents_z_after on safety_incidents;
create trigger safety_incidents_z_after after insert on safety_incidents
  for each row execute function private.safety_incidents_after_insert();

-- ───────────────────────── visit_events ─────────────────────────
-- Instrumentación, no auditoría: solo se puede escribir a nombre propio.

drop policy if exists "visit_events_insert" on visit_events;
create policy "visit_events_insert" on visit_events
  for insert with check (user_id = auth.uid());

-- ───────────────────────── Aprobación de partners ─────────────────────────

/*
 * Aprobar a un partner chequea el estado real en la base. Antes el chequeo
 * vivía en el navegador del admin y un update directo lo salteaba.
 */
create or replace function public.admin_approve_partner(p_partner_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p visit_partners;
  v partner_verifications;
  v_missing text[] := '{}';
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into p from visit_partners where id = p_partner_id;
  if not found then
    return jsonb_build_object('ok', false, 'missing', jsonb_build_array('No existe el partner'));
  end if;
  select * into v from partner_verifications where partner_id = p_partner_id;

  if not p.verified_identity then v_missing := array_append(v_missing, 'Identidad verificada'); end if;
  if not p.certified then v_missing := array_append(v_missing, 'Capacitación aprobada'); end if;
  if v.reference_check_status is distinct from 'VERIFIED' then v_missing := array_append(v_missing, 'Referencias verificadas'); end if;
  if v.interview_status is distinct from 'VERIFIED' then v_missing := array_append(v_missing, 'Entrevista aprobada'); end if;
  if coalesce(v.supervised_visits_completed, 0) < 3 then v_missing := array_append(v_missing, '3 visitas supervisadas'); end if;

  if array_length(v_missing, 1) is not null then
    return jsonb_build_object('ok', false, 'missing', to_jsonb(v_missing));
  end if;

  update visit_partners set status = 'ACTIVE', onboarding_status = 'APPROVED' where id = p_partner_id;
  update partner_verifications set overall_status = 'APPROVED' where partner_id = p_partner_id;
  perform private.recompute_partner_tier(p_partner_id);
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── Permisos de las RPC ─────────────────────────

revoke all on function public.get_booking_pin(uuid)        from public, anon;
revoke all on function public.verify_visit_pin(uuid, text) from public, anon;
revoke all on function public.admin_reset_pin(uuid)        from public, anon;
revoke all on function public.admin_approve_partner(uuid)  from public, anon;
revoke all on function public.reject_assignment(uuid, text) from public, anon;
grant execute on function public.reject_assignment(uuid, text) to authenticated;
grant execute on function public.get_booking_pin(uuid)        to authenticated;
grant execute on function public.verify_visit_pin(uuid, text) to authenticated;
grant execute on function public.admin_reset_pin(uuid)        to authenticated;
grant execute on function public.admin_approve_partner(uuid)  to authenticated;

revoke execute on function next_visit_code_seq() from public, anon;

notify pgrst, 'reload schema';
