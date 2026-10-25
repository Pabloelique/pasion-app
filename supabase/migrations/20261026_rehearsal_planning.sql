-- PASIÓN APP | Planificación de ensayos y seguimiento de marchas
-- Ejecutar después de 20261025_calendar_events.sql y biblioteca de partituras.
-- No duplica ni publica archivos de partituras.
create table if not exists public.rehearsal_pieces (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.band_events(id) on delete cascade,
 march_title text not null check (char_length(btrim(march_title)) between 2 and 180),
 objective text not null default '' check(char_length(objective)<=1000),
 progress text not null default 'pendiente'
   check(progress in ('pendiente','trabajando','mejorando','lista')),
 position integer not null default 1 check(position between 1 and 500),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists rehearsal_pieces_event_idx on public.rehearsal_pieces(event_id,position);
alter table public.rehearsal_pieces enable row level security;
revoke all on public.rehearsal_pieces from anon,authenticated;
grant select,insert,update,delete on public.rehearsal_pieces to authenticated;
drop policy if exists "Approved members see rehearsal repertoire" on public.rehearsal_pieces;
create policy "Approved members see rehearsal repertoire" on public.rehearsal_pieces
for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
 and exists(select 1 from public.band_events e where e.id=event_id and e.event_type='ensayo')
);
drop policy if exists "Managers add rehearsal pieces" on public.rehearsal_pieces;
create policy "Managers add rehearsal pieces" on public.rehearsal_pieces
for insert to authenticated with check (
 created_by=(select auth.uid())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 and exists(select 1 from public.band_events e where e.id=event_id and e.event_type='ensayo')
);
drop policy if exists "Managers update rehearsal pieces" on public.rehearsal_pieces;
create policy "Managers update rehearsal pieces" on public.rehearsal_pieces
for update to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin'))
) with check (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 and exists(select 1 from public.band_events e where e.id=event_id and e.event_type='ensayo')
);
drop policy if exists "Managers remove rehearsal pieces" on public.rehearsal_pieces;
create policy "Managers remove rehearsal pieces" on public.rehearsal_pieces
for delete to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin'))
);
-- Nunca proporciona acceso nuevo a los PDF: los permisos de la biblioteca no cambian.
notify pgrst, 'reload schema';
