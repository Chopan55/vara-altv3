-- VARA · Storage (correr DESPUÉS del esquema principal)
--
-- Va aparte porque en varios proyectos las políticas sobre storage.objects
-- fallan con "must be owner of table objects" y eso aborta todo el script.
-- Si este archivo da ese error: creá los buckets desde el dashboard
-- (Storage → New bucket, ambos PRIVADOS) y listo; las políticas se pueden
-- cargar después desde Storage → Policies.

-- ── Buckets privados ──
-- Privados = se sirven con URL firmada que vence, no quedan públicos en internet.

insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- ── Políticas ──
-- El primer segmento del path es el user_id: '<user_id>/<property_id>/foto.jpg'.
-- Así cada usuario solo alcanza su propia carpeta.

drop policy if exists "property_photos_own_files" on storage.objects;
create policy "property_photos_own_files"
  on storage.objects for all
  using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents_own_files" on storage.objects;
create policy "documents_own_files"
  on storage.objects for all
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
