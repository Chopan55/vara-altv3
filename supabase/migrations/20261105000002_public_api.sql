-- ════════════════════════════════════════════════════════════════════════
-- API pública: claves de API y webhooks
--
-- Claves: se generan en el navegador y se muestran UNA vez. Acá se guarda solo
-- el SHA-256. La API las valida con funciones SECURITY DEFINER que devuelven
-- únicamente las operaciones del dueño de la clave: no se abre ninguna tabla.
--
-- Webhooks: cada evento del registro de actividad (documento subido, oferta,
-- etc.) se envía a los endpoints del dueño, firmado con HMAC-SHA256 del cuerpo
-- usando el secreto del endpoint (header X-Vara-Signature: sha256=<hex>).
-- El envío usa pg_net (extensión de Supabase). Si no está activada, no se envía
-- nada y nada se rompe: activala en Database → Extensions → pg_net.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────── Claves de API ───────────────────────────

create table if not exists api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  -- Primeros caracteres visibles ("vara_live_ab12…") para reconocerla en la lista.
  prefix       text not null,
  key_hash     text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists api_keys_user_idx on api_keys(user_id);
alter table api_keys enable row level security;

drop policy if exists api_keys_own_select on api_keys;
create policy api_keys_own_select on api_keys for select using (user_id = auth.uid());
drop policy if exists api_keys_own_insert on api_keys;
create policy api_keys_own_insert on api_keys for insert
  with check (user_id = auth.uid() and revoked_at is null and last_used_at is null);
drop policy if exists api_keys_own_update on api_keys;
create policy api_keys_own_update on api_keys for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists api_keys_own_delete on api_keys;
create policy api_keys_own_delete on api_keys for delete using (user_id = auth.uid());

-- Desde la app solo se puede revocar o renombrar; la clave en sí no cambia.
create or replace function api_keys_guard() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.key_hash is distinct from old.key_hash or new.prefix is distinct from old.prefix
       or new.user_id is distinct from old.user_id or new.last_used_at is distinct from old.last_used_at
       or (old.revoked_at is not null and new.revoked_at is null)) then
    raise exception 'Una clave solo se puede renombrar o revocar';
  end if;
  return new;
end $$;
drop trigger if exists api_keys_guard on api_keys;
create trigger api_keys_guard before update on api_keys for each row execute function api_keys_guard();

-- Dueño de una clave activa. Interna: no se expone.
create or replace function api_key_owner(p_hash text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  update api_keys set last_used_at = now()
   where key_hash = p_hash and revoked_at is null
   returning user_id into v_user;
  return v_user;
end $$;
revoke all on function api_key_owner(text) from public, anon, authenticated;

create or replace function public.api_list_operations(p_key_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := api_key_owner(p_key_hash);
begin
  if v_user is null then return null; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'title', o.title, 'type', o.type, 'status', o.status,
      'province_code', o.province_code, 'created_at', o.created_at, 'updated_at', o.updated_at)
      order by o.created_at desc), '[]'::jsonb)
    from operations o where o.user_id = v_user);
end $$;

create or replace function public.api_get_operation(p_key_hash text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := api_key_owner(p_key_hash);
begin
  if v_user is null then return jsonb_build_object('error', 'unauthenticated'); end if;
  return (select jsonb_build_object(
      'id', o.id, 'title', o.title, 'type', o.type, 'status', o.status,
      'province_code', o.province_code, 'created_at', o.created_at, 'updated_at', o.updated_at)
    from operations o where o.id = p_operation_id and o.user_id = v_user);
end $$;

grant execute on function public.api_list_operations(text) to anon, authenticated;
grant execute on function public.api_get_operation(text, uuid) to anon, authenticated;

-- ─────────────────────────── Webhooks ───────────────────────────

create table if not exists webhook_endpoints (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  url         text not null check (url ~ '^https://[^\s/$.?#].[^\s]*$'),
  secret      text not null check (length(secret) >= 32),
  -- Vacío = todos los eventos. Valores: los de activity_kind.
  events      text[] not null default '{}',
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

create index if not exists webhook_endpoints_user_idx on webhook_endpoints(user_id);
alter table webhook_endpoints enable row level security;

drop policy if exists webhook_endpoints_own on webhook_endpoints;
create policy webhook_endpoints_own on webhook_endpoints for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Cuerpo y firma de cada envío. Separado del envío para poder probarlo.
create or replace function webhook_deliveries(p_event activity_events)
returns table (endpoint_id uuid, url text, body text, signature text)
language sql stable security definer set search_path = public, extensions as $$
  with payload as (
    select jsonb_build_object(
      'id', p_event.id,
      'event', p_event.kind,
      'operation_id', p_event.operation_id,
      'summary', p_event.summary,
      'created_at', p_event.created_at)::text as body
  )
  select w.id, w.url, payload.body,
         'sha256=' || encode(hmac(payload.body, w.secret, 'sha256'), 'hex')
    from webhook_endpoints w, payload
   where w.user_id = p_event.user_id
     and w.revoked_at is null
     and (cardinality(w.events) = 0 or p_event.kind::text = any (w.events));
$$;
revoke all on function webhook_deliveries(activity_events) from public, anon, authenticated;

create or replace function activity_events_webhooks() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare d record;
begin
  -- Sin pg_net no hay envío, y el registro de actividad sigue funcionando igual.
  if to_regproc('net.http_post') is null then
    return new;
  end if;
  for d in select * from webhook_deliveries(new) loop
    begin
      execute 'select net.http_post(url := $1, body := $2::jsonb, headers := $3)'
        using d.url, d.body,
              jsonb_build_object('Content-Type', 'application/json',
                                 'X-Vara-Event', new.kind::text,
                                 'X-Vara-Signature', d.signature);
    exception when others then
      -- Un endpoint caído nunca frena la operación del usuario.
      null;
    end;
  end loop;
  return new;
end $$;

drop trigger if exists activity_events_webhooks on activity_events;
create trigger activity_events_webhooks after insert on activity_events
  for each row execute function activity_events_webhooks();

notify pgrst, 'reload schema';
