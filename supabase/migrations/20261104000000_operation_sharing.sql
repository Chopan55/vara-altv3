-- ════════════════════════════════════════════════════════════════════════
-- Acceso compartido a una operación
--
-- El dueño invita por email a la contraparte, el escribano o la inmobiliaria.
-- El invitado entra con su cuenta, abre el link y queda como miembro.
--
-- Decisión de seguridad: NO se agregan políticas de lectura a `operations` ni a
-- `operation_documents`. RLS no filtra columnas, y esas tablas tienen notas
-- privadas y rutas de archivos. Los miembros leen a través de funciones
-- SECURITY DEFINER que devuelven solo campos seguros y verifican la membresía
-- en cada llamada. Solo lectura: un miembro no modifica nada de la operación.
--
-- Tabla y funciones nuevas; aditiva. Si no se corre, la app lo detecta y avisa.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists operation_members (
  id              uuid primary key default gen_random_uuid(),
  operation_id    uuid not null references operations(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  invited_email   text not null check (position('@' in invited_email) > 1),
  role            participant_role not null default 'OTHER',
  -- Secreto del link de invitación. Sin el token no se acepta nada.
  invite_token    uuid not null unique default gen_random_uuid(),
  member_user_id  uuid references auth.users(id) on delete cascade,
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists operation_members_operation_idx on operation_members(operation_id);
create index if not exists operation_members_member_idx on operation_members(member_user_id);
create unique index if not exists operation_members_unique_email
  on operation_members(operation_id, lower(invited_email)) where revoked_at is null;

alter table operation_members enable row level security;

-- El dueño de la operación administra sus invitaciones.
drop policy if exists operation_members_owner_select on operation_members;
create policy operation_members_owner_select on operation_members
  for select using (owner_id = auth.uid());

drop policy if exists operation_members_owner_insert on operation_members;
create policy operation_members_owner_insert on operation_members
  for insert with check (
    owner_id = auth.uid()
    and member_user_id is null and accepted_at is null and revoked_at is null
    and exists (select 1 from operations o where o.id = operation_id and o.user_id = auth.uid())
  );

drop policy if exists operation_members_owner_delete on operation_members;
create policy operation_members_owner_delete on operation_members
  for delete using (owner_id = auth.uid());

-- Revocar = update de revoked_at. El dueño no puede asignarse un miembro a mano:
-- eso solo pasa con el token, en accept_operation_invite.
drop policy if exists operation_members_owner_update on operation_members;
create policy operation_members_owner_update on operation_members
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function operation_members_guard() returns trigger
language plpgsql as $$
begin
  -- accept_operation_invite corre como dueño de la base: ahí sí se asigna el miembro.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.member_user_id is distinct from old.member_user_id
     or new.accepted_at is distinct from old.accepted_at
     or new.invite_token is distinct from old.invite_token
     or new.operation_id is distinct from old.operation_id
     or new.owner_id is distinct from old.owner_id
     or new.invited_email is distinct from old.invited_email then
    raise exception 'Solo se puede cambiar el rol o revocar la invitación';
  end if;
  return new;
end $$;

drop trigger if exists operation_members_guard on operation_members;
create trigger operation_members_guard before update on operation_members
  for each row execute function operation_members_guard();

-- El invitado ve su propia membresía.
drop policy if exists operation_members_member_select on operation_members;
create policy operation_members_member_select on operation_members
  for select using (member_user_id = auth.uid());

-- ─────────────────────── Aceptar una invitación ───────────────────────

create or replace function public.accept_operation_invite(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  m       operation_members%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'NOT_SIGNED_IN');
  end if;

  select * into m from operation_members where invite_token = p_token;
  if not found or m.revoked_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'INVALID');
  end if;
  if m.owner_id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'OWNER');
  end if;
  if m.member_user_id is not null then
    if m.member_user_id = v_uid then
      return jsonb_build_object('ok', true, 'operationId', m.operation_id);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'USED');
  end if;

  select email into v_email from auth.users where id = v_uid;
  if lower(coalesce(v_email, '')) <> lower(m.invited_email) then
    return jsonb_build_object('ok', false, 'reason', 'EMAIL_MISMATCH', 'invitedEmail', m.invited_email);
  end if;

  update operation_members set member_user_id = v_uid, accepted_at = now() where id = m.id;

  return jsonb_build_object('ok', true, 'operationId', m.operation_id);
end $$;

-- ─────────────────────── Lectura para miembros ───────────────────────

create or replace function public.get_shared_operation(p_operation_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_role participant_role;
  v_op   jsonb;
  v_docs jsonb;
begin
  select role into v_role from operation_members
   where operation_id = p_operation_id and member_user_id = auth.uid() and revoked_at is null;
  if not found then
    return null;
  end if;

  select jsonb_build_object(
           'id', o.id, 'type', o.type, 'status', o.status, 'title', o.title,
           'province', o.province, 'city', o.city, 'currentStageKey', o.current_stage_key,
           'updatedAt', o.updated_at,
           'ownerName', nullif(trim(coalesce(p.full_name, '')), ''))
    into v_op
    from operations o left join profiles p on p.id = o.user_id
   where o.id = p_operation_id;

  -- Sin notas ni rutas de archivo: solo el estado del checklist documental.
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', d.name, 'category', d.category, 'status', d.status, 'updatedAt', d.updated_at)
           order by d.created_at), '[]'::jsonb)
    into v_docs
    from operation_documents d where d.operation_id = p_operation_id;

  return jsonb_build_object('role', v_role, 'operation', v_op, 'documents', v_docs);
end $$;

create or replace function public.list_shared_operations()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'operationId', o.id, 'title', o.title, 'type', o.type, 'role', m.role,
           'acceptedAt', m.accepted_at) order by m.accepted_at desc), '[]'::jsonb)
    from operation_members m join operations o on o.id = m.operation_id
   where m.member_user_id = auth.uid() and m.revoked_at is null;
$$;

revoke all on function public.accept_operation_invite(uuid) from public, anon;
revoke all on function public.get_shared_operation(uuid) from public, anon;
revoke all on function public.list_shared_operations() from public, anon;
grant execute on function public.accept_operation_invite(uuid) to authenticated;
grant execute on function public.get_shared_operation(uuid) to authenticated;
grant execute on function public.list_shared_operations() to authenticated;

notify pgrst, 'reload schema';
