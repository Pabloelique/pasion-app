-- PASIÓN APP / Biblioteca privada multi-formato (PDF, imágenes, audio y documentos)
-- Requiere bucket privado existente: partituras
-- Ejecutar en Supabase SQL Editor. No convertir el bucket en público.

create table if not exists public.march_scores (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  musical_part_id bigint not null references public.musical_parts(id),
  storage_path text not null unique,
  mime_type text not null,
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint score_path_matches_part check (
    split_part(storage_path, '/', 1) = musical_part_id::text
    and storage_path !~ '\.\.'
  ),
  constraint score_file_type check (mime_type in (
    'application/pdf','image/jpeg','image/png','image/webp',
    'audio/mpeg','audio/wav','audio/x-wav','audio/mp4',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ))
);

alter table public.march_scores enable row level security;
revoke all on public.march_scores from anon, authenticated;
grant select, insert on public.march_scores to authenticated;

drop policy if exists "Active approved members can read scores by part" on public.march_scores;
create policy "Active approved members can read scores by part"
on public.march_scores for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.approval_status = 'approved'
    and (p.role in ('directiva','superadmin') or p.musical_part_id = march_scores.musical_part_id)
));

drop policy if exists "Only active board can register scores" on public.march_scores;
create policy "Only active board can register scores"
on public.march_scores for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.approval_status = 'approved'
      and p.role in ('directiva','superadmin')
  )
);

-- Los permisos sobre archivos se evalúan directamente al crear enlaces firmados.
-- La ruta es siempre: ID-HILO/UUID.extension
drop policy if exists "Board can upload private scores" on storage.objects;
create policy "Board can upload private scores"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'partituras'
  and name ~ '^[0-9]+/[0-9a-fA-F-]{36}\.(pdf|png|jpg|jpeg|webp|mp3|wav|m4a|docx)$'
  and exists (
    select 1 from public.musical_parts mp
    where mp.id::text = split_part(name, '/', 1)
  )
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.approval_status = 'approved'
      and p.role in ('directiva','superadmin')
  )
);

drop policy if exists "Members can read private scores by part" on storage.objects;
create policy "Members can read private scores by part"
on storage.objects for select to authenticated
using (
  bucket_id = 'partituras'
  and exists (
    select 1 from public.march_scores s
    join public.profiles p on p.id = (select auth.uid())
    where s.storage_path = name
      and p.approval_status = 'approved'
      and (p.role in ('directiva','superadmin') or p.musical_part_id = s.musical_part_id)
  )
);

-- Importante: no crear políticas públicas, ni permitir UPDATE/DELETE arbitrarios.
-- No subir ejecutables, HTML ni SVG aunque el bucket acepte todos los MIME.
