-- ════════════════════════════════════════════════════════════════════════
-- Ofertas
--
-- El momento de verdad de una compraventa: alguien pone un número por
-- escrito. Hasta ahora VARA acompañaba todo el proceso menos justo esto.
--
-- Una contraoferta NO pisa a la oferta original: es una fila nueva que
-- apunta a la anterior con `parent_offer_id`. La negociación queda como lo
-- que es, una cadena, y nadie puede discutir después qué se ofreció primero.
--
-- Tabla nueva y aditiva: no toca nada existente.
-- ════════════════════════════════════════════════════════════════════════

do $$ begin create type offer_status as enum (
  'DRAFT',      -- la estoy armando, nadie la vio
  'SENT',       -- la mandé, espero respuesta
  'COUNTERED',  -- me contraofertaron (la respuesta es otra fila)
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',  -- la retiré antes de que me contesten
  'EXPIRED'     -- se venció el plazo que yo mismo puse
);
exception when duplicate_object then null; end $$;

-- Quién la emitió. Una contraoferta del vendedor se guarda igual, en la
-- misma operación del comprador, porque es parte de la misma negociación.
do $$ begin create type offer_party as enum ('BUYER', 'SELLER');
exception when duplicate_object then null; end $$;

create table if not exists offers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  operation_id    uuid not null references operations(id) on delete cascade,
  property_id     uuid references properties(id) on delete set null,

  -- La oferta a la que responde, si es una contraoferta.
  parent_offer_id uuid references offers(id) on delete set null,

  party           offer_party not null default 'BUYER',
  status          offer_status not null default 'DRAFT',

  -- numeric, NO float: un centavo perdido por redondeo binario en una
  -- operación de USD 200.000 es un problema real.
  amount          numeric(14,2) not null check (amount > 0),
  currency        text not null default 'USD',

  -- Condiciones en texto libre, una por elemento. No las interpretamos:
  -- "sujeto a crédito hipotecario aprobado" es un acuerdo entre personas,
  -- no un campo que VARA deba modelar ni validar.
  conditions      text[] not null default '{}',

  -- Hasta cuándo vale. Sin esto una oferta queda abierta para siempre.
  valid_until     date,

  message         text,
  response_note   text,
  responded_at    timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists offers_operation_id_idx on offers(operation_id);
create index if not exists offers_user_status_idx on offers(user_id, status);
create index if not exists offers_parent_idx on offers(parent_offer_id);

drop trigger if exists offers_updated_at on offers;
create trigger offers_updated_at before update on offers
  for each row execute function set_updated_at();

-- ─────────────────────── RLS ───────────────────────
-- Una oferta es información sensible: revela cuánto está dispuesto a pagar
-- alguien. Solo su dueño la ve.

alter table offers enable row level security;

drop policy if exists offers_select_own on offers;
create policy offers_select_own on offers
  for select using (auth.uid() = user_id);

drop policy if exists offers_insert_own on offers;
create policy offers_insert_own on offers
  for insert with check (auth.uid() = user_id);

drop policy if exists offers_update_own on offers;
create policy offers_update_own on offers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists offers_delete_own on offers;
create policy offers_delete_own on offers
  for delete using (auth.uid() = user_id);

notify pgrst, 'reload schema';
