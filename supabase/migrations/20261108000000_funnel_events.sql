-- Embudo de producto: visita → analiza → crea operación → vuelve → invita.
--
-- Sin datos personales: un identificador anónimo por navegador (uuid al azar
-- guardado en el navegador), el nombre del paso y unos pocos datos técnicos.
-- Nadie lee ni escribe la tabla directo: se escribe con track_event y solo un
-- ADMIN ve los totales con funnel_summary.

create table if not exists funnel_events (
  id         bigserial primary key,
  anon_id    uuid not null,
  name       text not null check (name in (
               'visit', 'analyze_start', 'analyze_done', 'share', 'shared_view',
               'operation_created', 'invite_sent')),
  env        text not null default 'unknown' check (env in ('production', 'staging', 'development', 'unknown')),
  path       text check (char_length(path) <= 200),
  props      jsonb not null default '{}'::jsonb
               check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 1024),
  created_at timestamptz not null default now()
);

create index if not exists funnel_events_env_created_idx on funnel_events (env, created_at);
create index if not exists funnel_events_anon_created_idx on funnel_events (anon_id, created_at);

alter table funnel_events enable row level security;
-- Sin políticas: ni anon ni authenticated pueden leer o escribir la tabla.
revoke all on funnel_events from anon, authenticated;

-- Registrar un paso. Corta en 300 eventos por hora por navegador.
create or replace function track_event(
  p_anon uuid, p_name text, p_env text default 'unknown', p_path text default null, p_props jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_anon is null then return; end if;
  if (select count(*) from funnel_events
        where anon_id = p_anon and created_at > now() - interval '1 hour') >= 300 then
    return;
  end if;
  insert into funnel_events (anon_id, name, env, path, props)
  values (p_anon, p_name, coalesce(p_env, 'unknown'), left(p_path, 200), coalesce(p_props, '{}'::jsonb));
end $$;

revoke all on function track_event(uuid, text, text, text, jsonb) from public;
grant execute on function track_event(uuid, text, text, text, jsonb) to anon, authenticated;

-- Totales del embudo en producción, últimos p_days días. Solo ADMIN.
-- "Volvió en su primera semana": de quienes llegaron hace 7 días o más (dentro
-- del período), cuántos volvieron otro día dentro de sus primeros 7 días.
create or replace function funnel_summary(p_days int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_days  int := greatest(1, least(coalesce(p_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_result jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with ev as (
    select anon_id, name, props from funnel_events where env = 'production' and created_at >= v_since
  ),
  firsts as (
    select anon_id, min(created_at) as first_at from funnel_events where env = 'production' group by anon_id
  ),
  cohort as (
    select anon_id, first_at from firsts where first_at >= v_since and first_at <= now() - interval '7 days'
  ),
  returned as (
    select c.anon_id from cohort c
    where exists (
      select 1 from funnel_events e
      where e.anon_id = c.anon_id and e.env = 'production'
        and e.created_at::date > c.first_at::date
        and e.created_at <= c.first_at + interval '7 days'
    )
  )
  select jsonb_build_object(
    'days',         v_days,
    'visitors',     (select count(distinct anon_id) from ev where name = 'visit'),
    'analyzed',     (select count(distinct anon_id) from ev where name = 'analyze_done'),
    'operations',   (select count(distinct anon_id) from ev where name = 'operation_created'),
    'invited',      (select count(distinct anon_id) from ev where name = 'invite_sent'),
    'shares',       (select count(*) from ev where name = 'share'),
    'shared_views', (select count(*) from ev where name = 'shared_view'),
    'from_share',   (select count(distinct anon_id) from ev where name = 'visit' and props->>'ref' = 'share'),
    'cohort_7d',    (select count(*) from cohort),
    'returned_7d',  (select count(*) from returned)
  ) into v_result;
  return v_result;
end $$;

revoke all on function funnel_summary(int) from public;
grant execute on function funnel_summary(int) to authenticated;
