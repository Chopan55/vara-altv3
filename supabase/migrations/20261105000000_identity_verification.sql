-- ════════════════════════════════════════════════════════════════════════
-- Trust Passport: verificación de identidad (manual)
--
-- El usuario sube DNI y selfie; una persona de VARA revisa y aprueba o rechaza.
-- Es el mismo criterio que con los Visit Partners: subir documentos no te
-- verifica, te verifica VARA. Nadie puede marcarse verificado solo.
--
-- La contraparte de una operación compartida ve SOLO señales (sí/no), nunca los
-- archivos: get_operation_trust devuelve booleanos y nada más.
--
-- Los archivos van al bucket privado `identity`
-- (20261105000001_identity_storage.sql, aparte por permisos de storage).
-- ════════════════════════════════════════════════════════════════════════

create table if not exists identity_verifications (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  status           text not null default 'SUBMITTED'
                   check (status in ('SUBMITTED', 'VERIFIED', 'REJECTED')),
  document_path    text not null,
  selfie_path      text not null,
  submitted_at     timestamptz not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid references auth.users(id),
  rejection_reason text,
  updated_at       timestamptz not null default now()
);

alter table identity_verifications enable row level security;

drop policy if exists identity_select on identity_verifications;
create policy identity_select on identity_verifications
  for select using (user_id = auth.uid() or is_admin());

drop policy if exists identity_insert on identity_verifications;
create policy identity_insert on identity_verifications
  for insert with check (user_id = auth.uid() and status = 'SUBMITTED');

drop policy if exists identity_update on identity_verifications;
create policy identity_update on identity_verifications
  for update using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- El usuario solo puede (re)enviar sus archivos; el veredicto es de VARA.
create or replace function identity_verifications_guard() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if is_admin() then
    if new.status is distinct from old.status and new.status in ('VERIFIED', 'REJECTED') then
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
    end if;
    return new;
  end if;
  if old.status = 'VERIFIED' then
    raise exception 'La identidad ya está verificada';
  end if;
  if new.status <> 'SUBMITTED'
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by
     or new.user_id is distinct from old.user_id then
    raise exception 'La verificación la decide VARA';
  end if;
  -- Reenviar limpia el rechazo anterior.
  new.rejection_reason := null;
  new.submitted_at := now();
  return new;
end $$;

drop trigger if exists identity_verifications_guard on identity_verifications;
create trigger identity_verifications_guard before update on identity_verifications
  for each row execute function identity_verifications_guard();

-- ─────────────────── Pasaporte visible para la contraparte ───────────────────
-- Dueño y miembros aceptados de una operación ven las señales de los demás.
-- Solo booleanos y conteos: ni archivos, ni teléfono, ni email.

create or replace function public.get_operation_trust(p_operation_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from operations where id = p_operation_id;
  if v_owner is null then return null; end if;
  if auth.uid() is distinct from v_owner and not exists (
    select 1 from operation_members m
     where m.operation_id = p_operation_id and m.member_user_id = auth.uid() and m.revoked_at is null
  ) then
    return null;
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId', u.id,
      'isOwner', u.id = v_owner,
      'role', coalesce(m.role::text, 'OWNER'),
      'name', nullif(trim(coalesce(p.full_name, '')), ''),
      'emailVerified', u.email_confirmed_at is not null,
      'hasPhone', nullif(trim(coalesce(p.phone, '')), '') is not null,
      'identityVerified', coalesce(iv.status = 'VERIFIED', false),
      'operationsCount', (select count(*) from operations o where o.user_id = u.id)
    )), '[]'::jsonb)
    from auth.users u
    left join profiles p on p.id = u.id
    left join identity_verifications iv on iv.user_id = u.id
    left join operation_members m
      on m.operation_id = p_operation_id and m.member_user_id = u.id and m.revoked_at is null
    where u.id = v_owner or m.id is not null
  );
end $$;

revoke all on function public.get_operation_trust(uuid) from public, anon;
grant execute on function public.get_operation_trust(uuid) to authenticated;

notify pgrst, 'reload schema';
