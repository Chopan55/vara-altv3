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
