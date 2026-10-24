-- PASIÓN APP | Calendario y confirmaciones de asistencia
-- Ejecutar en Supabase SQL Editor.
create table if not exists public.band_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 3 and 160),
  event_type text not null check (event_type in ('ensayo','actuacion','reunion','otro')),
  description text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint event_valid_dates check (ends_at > starts_at)
);
create index if not exists band_events_starts_at_idx on public.band_events(starts_at);
alter table public.band_events enable row level security;
revoke all on public.band_events from anon,authenticated;
grant select,insert on public.band_events to authenticated;

drop policy if exists "Approved members read events" on public.band_events;
create policy "Approved members read events" on public.band_events
for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
);

drop policy if exists "Approved managers create events" on public.band_events;
create policy "Approved managers create events" on public.band_events
for insert to authenticated with check (
 created_by=(select auth.uid())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin'))
);

create table if not exists public.event_responses (
  event_id uuid not null references public.band_events(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  response text not null check (response in ('asistire','no_asistire')),
  justification text,
  updated_at timestamptz not null default now(),
  primary key(event_id,user_id),
  constraint absence_needs_reason check (
    response = 'asistire' or length(btrim(coalesce(justification,''))) >= 5
  )
);
create index if not exists event_responses_user_idx on public.event_responses(user_id);
alter table public.event_responses enable row level security;
revoke all on public.event_responses from anon,authenticated;
grant select,insert,update on public.event_responses to authenticated;

drop policy if exists "Members see only their own event responses" on public.event_responses;
create policy "Members see only their own event responses" on public.event_responses
for select to authenticated using (
 user_id=(select auth.uid()) and
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
);
drop policy if exists "Approved members answer events" on public.event_responses;
create policy "Approved members answer events" on public.event_responses
for insert to authenticated with check (
 user_id=(select auth.uid()) and
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
);
drop policy if exists "Approved members revise own responses" on public.event_responses;
create policy "Approved members revise own responses" on public.event_responses
for update to authenticated
using (
 user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
)
with check (
 user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
);
-- La directiva tendrá en un módulo posterior un resumen de respuestas mediante RPC,
-- sin exponer aquí justificaciones privadas a otros músicos.
