-- ════════════════════════════════════════════════════════════════════════
-- Bucket para las fotos del reporte de visita
--
-- El reporte de VARA Visit tenía un campo `photo_paths` que se guardaba
-- siempre vacío: el partner podía escribir observaciones pero no mostrar
-- nada. En una visita donde la persona dueña no estuvo presente, la foto es
-- la única prueba de en qué estado quedó la propiedad.
--
-- Bucket propio y no `property-photos` a propósito: una foto de aviso está
-- pensada para publicarse, y una foto de visita muestra el interior de la
-- casa de alguien, a veces con gente adentro. Mezclarlas en el mismo lugar
-- es exactamente cómo se filtra algo por accidente.
--
-- PRIVADO. Se sirve con URL firmada que vence.
--
-- Si este archivo falla con "must be owner of table objects" (pasa en
-- algunos proyectos), creá el bucket a mano desde el dashboard —Storage →
-- New bucket, privado— y cargá la política después.
-- ════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', false)
on conflict (id) do nothing;

-- El primer segmento del path es el user_id del partner que la sacó:
-- '<user_id>/<booking_id>/foto.jpg'.
drop policy if exists "visit_photos_own_files" on storage.objects;
create policy "visit_photos_own_files"
  on storage.objects for all
  using (
    bucket_id = 'visit-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'visit-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
