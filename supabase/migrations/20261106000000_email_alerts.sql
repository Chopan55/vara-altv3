-- Alertas por email: resumen diario de lo que vence o tiene problemas.
--
-- Opt-in: nadie recibe nada hasta activarlo en /configuracion.
-- El envío lo hace el servidor (cron) con la clave secreta; el usuario solo
-- ve y cambia SU fila. La baja sin sesión (link del email) pasa por una
-- función SECURITY DEFINER que solo apaga el envío del token dado.

create table if not exists alert_preferences (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  email_digest      boolean not null default false,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  last_sent_at      timestamptz,
  last_digest_key   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists alert_preferences_updated_at on alert_preferences;
create trigger alert_preferences_updated_at before update on alert_preferences
  for each row execute function set_updated_at();

alter table alert_preferences enable row level security;

drop policy if exists "alert_preferences_own" on alert_preferences;
create policy "alert_preferences_own" on alert_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- El usuario no puede escribir el registro de envíos ni elegir su token.
revoke insert, update on alert_preferences from anon, authenticated;
grant insert (user_id, email_digest) on alert_preferences to authenticated;
grant update (email_digest) on alert_preferences to authenticated;
revoke all on alert_preferences from anon;

-- Baja con un clic desde el email, sin iniciar sesión.
create or replace function alerts_unsubscribe(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update alert_preferences set email_digest = false where unsubscribe_token = p_token;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function alerts_unsubscribe(uuid) from public;
grant execute on function alerts_unsubscribe(uuid) to anon, authenticated;
