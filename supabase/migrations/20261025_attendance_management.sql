-- PASIÓN APP: attendance register
create table if not exists public.attendance_marks (
 event_id uuid not null references public.band_events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null check(status in ('presente','ausente','justificada')),
 note text,
 marked_by uuid not null references auth.users(id),
 marked_at timestamptz not null default now(),
 primary key (event_id,user_id)
);
alter table public.attendance_marks enable row level security;
revoke all on public.attendance_marks from anon,authenticated;
