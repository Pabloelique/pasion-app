-- PASIÓN APP · Ampliación de instrumentos y biblioteca de guiones completos
-- Ejecutar DESPUÉS de 20261025_score_library.sql.
insert into public.musical_parts(name) values
 ('Trompeta 3'), ('Trombón 2'), ('Bombardino 2'),
 ('Tuba en Do'), ('Tuba en Si bemol'),
 ('Corneta Do/Reb'), ('Trombón de pistones')
on conflict (name) do nothing;

-- Los ficheros .sib se admiten para archivo, pero sin visor web nativo.
alter table public.march_scores drop constraint if exists score_file_type;
alter table public.march_scores add constraint score_file_type check (mime_type in (
 'application/pdf','image/jpeg','image/png','image/webp',
 'audio/mpeg','audio/wav','audio/x-wav','audio/mp4',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/octet-stream'
));

create table if not exists public.full_scores (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 1 and 160),
 storage_path text not null unique,
 mime_type text not null,
 uploaded_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 constraint full_score_path check (storage_path ~ '^guiones/[0-9a-fA-F-]{36}\.(pdf|mp3|wav|m4a|sib)$'),
 constraint full_score_type check (mime_type in ('application/pdf','audio/mpeg','audio/wav','audio/x-wav','audio/mp4','application/octet-stream'))
);
alter table public.full_scores enable row level security;
revoke all on public.full_scores from anon, authenticated;
grant select,insert on public.full_scores to authenticated;
drop policy if exists "Only board can read full scores" on public.full_scores;
create policy "Only board can read full scores" on public.full_scores for select to authenticated
using(exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin')));
drop policy if exists "Only board can register full scores" on public.full_scores;
create policy "Only board can register full scores" on public.full_scores for insert to authenticated
with check(uploaded_by=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin')));

drop policy if exists "Board can upload complete scores" on storage.objects;
create policy "Board can upload complete scores" on storage.objects for insert to authenticated
with check(bucket_id='partituras' and name ~ '^guiones/[0-9a-fA-F-]{36}\.(pdf|mp3|wav|m4a|sib)$'
and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin')));

drop policy if exists "Board can read complete scores" on storage.objects;
create policy "Board can read complete scores" on storage.objects for select to authenticated
using(bucket_id='partituras' and exists(
 select 1 from public.full_scores s join public.profiles p on p.id=(select auth.uid())
 where s.storage_path=name and p.approval_status='approved' and p.role in ('directiva','superadmin')
));

-- Sibelius en hilos: mismo control privado de roles, ruta y afiliación.
drop policy if exists "Board can upload Sibelius scores" on storage.objects;
create policy "Board can upload Sibelius scores" on storage.objects for insert to authenticated
with check(bucket_id='partituras' and name ~ '^[0-9]+/[0-9a-fA-F-]{36}\.sib$'
and exists(select 1 from public.musical_parts mp where mp.id::text=split_part(name,'/',1))
and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin')));
