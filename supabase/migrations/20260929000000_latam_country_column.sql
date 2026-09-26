-- Phase 9: LATAM Native Architecture — country column
-- Adds nullable country to profiles, properties, and operations.
-- Existing rows remain valid (NULL = AR implicit).

-- Enum for CountryCode
do $$ begin
  create type country_code as enum (
    'AR', 'MX', 'CL', 'CO', 'PE', 'BR', 'UY', 'PY'
  );
exception
  when duplicate_object then null;
end $$;

-- profiles
alter table profiles
  add column if not exists country country_code;

-- properties
alter table properties
  add column if not exists country country_code;

-- operations
alter table operations
  add column if not exists country country_code,
  add column if not exists locale text;

-- Index para queries por país
create index if not exists idx_properties_country on properties (country);
create index if not exists idx_operations_country on operations (country);
