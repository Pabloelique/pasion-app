-- PASIÓN APP: reparar importación de partituras por instrumentos.
-- Mantiene el bucket privado, sin permisos para anon ni acceso entre hilos.
-- Ejecutar después de las migraciones de biblioteca y de importación.

-- La subida a Supabase Storage puede requerir SELECT sobre el objeto
-- recién insertado antes de que exista su entrada en march_scores.
-- Se permite esa lectura únicamente al directivo autenticado que lo subió.
drop policy if exists "Board reads own uploaded scores" on storage.objects;
create policy "Board reads own uploaded scores"
on storage.objects for select to authenticated
using (
  bucket_id = 'partituras'
  and owner_id = (select auth.uid())::text
  and (
    name ~ '^[0-9]+/[0-9a-fA-F-]{36}\.(pdf|png|jpg|jpeg|webp|mp3|wav|m4a|docx|sib)$'
    or name ~ '^guiones/[0-9a-fA-F-]{36}\.(pdf|mp3|wav|m4a|sib)$'
  )
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.approval_status = 'approved'
      and p.role in ('directiva','superadmin')
  )
);

-- Unificar inserciones por instrumentos en una única política, evitando
-- que una política antigua de Storage o un formato se quede fuera.
drop policy if exists "Board can upload private scores" on storage.objects;
drop policy if exists "Board can upload Sibelius scores" on storage.objects;
create policy "Board can upload private scores"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'partituras'
  and name ~ '^[0-9]+/[0-9a-fA-F-]{36}\.(pdf|png|jpg|jpeg|webp|mp3|wav|m4a|docx|sib)$'
  and exists (
    select 1 from public.musical_parts mp
    where mp.id::text = split_part(name, '/', 1)
  )
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.approval_status = 'approved'
      and p.role in ('directiva','superadmin')
  )
);
