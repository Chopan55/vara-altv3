-- Pedidos de contacto de la portada ("Hablá con una persona").
-- Solo INSERT para anon y authenticated; nadie lee desde la API (se mira desde el panel de Supabase).
-- Idempotente.

create table if not exists contact_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  email      text not null check (char_length(email) between 5 and 120),
  message    text not null check (char_length(message) between 10 and 1000),
  created_at timestamptz not null default now()
);

alter table contact_requests enable row level security;

revoke all on contact_requests from anon, authenticated;
grant insert on contact_requests to anon, authenticated;

drop policy if exists "contact_requests_insert" on contact_requests;
create policy "contact_requests_insert" on contact_requests
  for insert to anon, authenticated with check (true);

notify pgrst, 'reload schema';
