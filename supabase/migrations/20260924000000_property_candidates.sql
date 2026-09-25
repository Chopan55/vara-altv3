-- ════════════════════════════════════════════════════════════════════════
-- Property Candidate ≠ Transaction
--
-- Una persona mira varias propiedades. Eso NO significa que cada una sea una
-- operación. Hasta ahora VARA no distinguía las dos cosas, y por eso pedía el
-- compromiso (crear una operación) antes que la decisión (elegir cuál).
--
-- Esta migración es ADITIVA: agrega columnas con default a una tabla que ya
-- tiene datos. Ninguna fila existente cambia de significado — las propiedades
-- que ya estaban pasan a `ANALYZING`, que es donde de hecho estaban.
--
-- Reversible: `alter table properties drop column ...` no pierde nada que no
-- se haya creado acá. Las políticas RLS de `properties` ya cubren las
-- columnas nuevas, así que no hay que tocarlas.
-- ════════════════════════════════════════════════════════════════════════

do $$ begin create type property_candidate_status as enum (
  'ANALYZING',   -- la estoy mirando
  'FAVORITE',    -- me interesa
  'VISITED',     -- ya la fui a ver
  'DISCARDED',   -- la descarté
  'PROMOTED'     -- avancé: existe una operación
);
exception when duplicate_object then null; end $$;

alter table properties
  add column if not exists candidate_status property_candidate_status not null default 'ANALYZING';

-- Al promover conservamos el vínculo: el contexto previo (notas, visita,
-- análisis) no se pierde cuando nace la operación.
alter table properties
  add column if not exists promoted_operation_id uuid references operations(id) on delete set null;

alter table properties
  add column if not exists promoted_at timestamptz;

-- Notas del usuario sobre la propiedad, antes de que exista una operación.
-- Es lo que escribe mientras todavía está decidiendo.
alter table properties
  add column if not exists user_notes text;

-- Motivo del descarte. Sirve para la decisión ("ya la descarté por X") y,
-- más adelante, para entender por qué se caen las búsquedas.
alter table properties
  add column if not exists discard_reason text;

create index if not exists properties_candidate_status_idx
  on properties(user_id, candidate_status);

notify pgrst, 'reload schema';
