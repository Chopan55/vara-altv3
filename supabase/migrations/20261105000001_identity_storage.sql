-- VARA · Storage de verificación de identidad (correr DESPUÉS de 20261105000000)
--
-- Aparte, como 20260919000001_storage.sql: si da "must be owner of table objects",
-- creá el bucket `identity` PRIVADO desde el dashboard (Storage → New bucket) y
-- cargá estas políticas desde Storage → Policies.
--
-- Path: '<user_id>/<archivo>'. El usuario alcanza solo su carpeta; un admin de
-- VARA puede leer para revisar. Nadie más.

insert into storage.buckets (id, name, public)
values ('identity', 'identity', false)
on conflict (id) do nothing;

drop policy if exists "identity_own_files" on storage.objects;
create policy "identity_own_files"
  on storage.objects for all
  using (
    bucket_id = 'identity'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  )
  with check (
    bucket_id = 'identity'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
