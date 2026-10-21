-- Hotfix: la app guarda `operations.country`, pero la base de producción nunca recibió esa columna
-- (error PGRST204 "Could not find the 'country' column of 'operations' in the schema cache").
-- Solo AGREGA una columna opcional y refresca la caché de la API. No borra ni modifica datos. Idempotente.
-- NO se ejecutó contra producción: aplicarlo en el SQL Editor del proyecto correcto (VARA MVP).

alter table operations
  add column if not exists country varchar(2);

create index if not exists idx_operations_country on operations (country);

notify pgrst, 'reload schema';
