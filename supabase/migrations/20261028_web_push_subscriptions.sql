-- PASIÓN APP | Suscripciones Web Push por dispositivo.
-- Se ejecuta DESPUÉS de las migraciones de perfiles y notificaciones.
-- No publica secretos VAPID ni claves de servicio.
create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(length(endpoint) between 20 and 2000),
 p256dh text not null check(length(p256dh) between 20 and 500),
 auth_key text not null check(length(auth_key) between 8 and 500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon,authenticated;
grant select,insert,update,delete on public.push_subscriptions to authenticated;

drop policy if exists "Owners read own push devices" on public.push_subscriptions;
create policy "Owners read own push devices" on public.push_subscriptions
 for select to authenticated using (
  user_id=(select auth.uid())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
 );
drop policy if exists "Owners register push devices" on public.push_subscriptions;
create policy "Owners register push devices" on public.push_subscriptions
 for insert to authenticated with check (
  user_id=(select auth.uid())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
 );
drop policy if exists "Owners refresh own push devices" on public.push_subscriptions;
create policy "Owners refresh own push devices" on public.push_subscriptions
 for update to authenticated using (
  user_id=(select auth.uid())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
 ) with check (
  user_id=(select auth.uid())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
 );
drop policy if exists "Owners remove own push devices" on public.push_subscriptions;
create policy "Owners remove own push devices" on public.push_subscriptions
 for delete to authenticated using(user_id=(select auth.uid()));

-- Los avisos internos existentes se mantienen como fuente de verdad.
-- CONFIGURACIÓN MANUAL EN SUPABASE:
-- Database > Webhooks > Create a new hook
-- tabla: public.app_notifications / evento: INSERT
-- destino: https://pasion-app.vercel.app/api/push/dispatch
-- método: POST
-- cabecera: x-pasion-push-secret: [PUSH_WEBHOOK_SECRET de Vercel]
-- El endpoint valida la cabecera y consulta las notificaciones con service_role.
notify pgrst,'reload schema';
