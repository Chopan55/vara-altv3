-- VARA producción (hmvoyigahqfqpoersimr): negociaciones + mercado. Solo agrega tablas; no borra ni modifica datos existentes.
-- negotiations: contexto y metadata de cada negociación del usuario
create table if not exists negotiations (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  operation_id  uuid references operations(id) on delete set null,
  title         text not null default 'Negociación',
  counterparty_role   text,
  counterparty_style  text,
  objetivo            text,
  target              text,
  walk_away           text,
  batna               text,
  deadline            text,
  current_offer       text,
  negotiation_history text,
  other_context       text,
  next_action         text,
  status  text default 'active' check (status in ('active', 'closed', 'paused')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- negotiation_messages: historial de análisis por negociación
create table if not exists negotiation_messages (
  id               uuid default gen_random_uuid() primary key,
  negotiation_id   uuid references negotiations(id) on delete cascade not null,
  user_id          uuid references auth.users(id) on delete cascade not null,
  mode             text not null,
  channel          text,
  input_message    text,
  result           jsonb,
  created_at       timestamptz default now() not null
);

-- RLS
alter table negotiations         enable row level security;
alter table negotiation_messages enable row level security;

create policy "users own negotiations"
  on negotiations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users own negotiation messages"
  on negotiation_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes
create index if not exists negotiations_user_idx  on negotiations(user_id, status);
create index if not exists neg_messages_neg_idx   on negotiation_messages(negotiation_id, created_at desc);

-- updated_at trigger
create or replace function update_negotiations_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists negotiations_updated_at on negotiations;
create trigger negotiations_updated_at
  before update on negotiations
  for each row execute function update_negotiations_updated_at();

-- Avisos de mercado barridos (Zonaprop vía Bright Data).
--
-- NO APLICADA: todavía no está confirmado cuál proyecto de Supabase es el de
-- producción. Hasta entonces el store de archivo (`.data/market`) cumple la
-- misma interfaz `MarketStore`.
--
-- No guarda teléfonos ni datos de vendedores: solo lo necesario para comparar
-- propiedades. Los datos son públicos pero se tratan con cuidado.

create table if not exists public.market_listings (
  id              text primary key,          -- p. ej. "zp-60443863"
  source          text not null,             -- "Zonaprop"
  country         text not null default 'AR',
  city            text,
  neighborhood    text,
  community       text,
  facts           jsonb not null,            -- ListingFacts normalizado
  first_seen_at   timestamptz not null,
  last_seen_at    timestamptz not null,
  price_history   jsonb not null default '[]'::jsonb,
  updated_at      timestamptz not null default now()
);

create index if not exists market_listings_city_idx         on public.market_listings (country, lower(city));
create index if not exists market_listings_neighborhood_idx on public.market_listings (country, lower(neighborhood));
create index if not exists market_listings_community_idx    on public.market_listings (country, lower(community));
create index if not exists market_listings_last_seen_idx    on public.market_listings (last_seen_at desc);

-- Solo el servidor (service role) lee y escribe: ninguna política pública.
alter table public.market_listings enable row level security;
