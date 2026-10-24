-- PASIÓN APP | Reparación de permisos de importación por instrumento
-- Ejecutar en Supabase SQL Editor tras las migraciones anteriores.
-- La importación de guiones funcionaba, pero los ficheros bajo ID-HILO/UUID.ext no.
-- Esta política limita las subidas a directiva aprobada, nombres seguros y bucket privado.

update storage.buckets set public = false where id = 'partituras';

drop policy if exists "Approved board uploads scored material" on storage.objects;
create policy "Approved board uploads scored material"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'partituras'
  and name ~ '^[0-9]+/[0-9a-fA-F-]{36}\.(pdf|png|jpg|jpeg|webp|mp3|wav|m4a|docx|sib)$'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.approval_status = 'approved'
      and p.role in ('superadmin','directiva')
  )
);

-- El uploader puede necesitar SELECT del objeto recién subido antes de crear
-- el registro en march_scores. Sin él, la validación previa es circular.
-- Nunca abrir SELECT a anon ni a músicos para ficheros sin catálogo.
drop policy if exists "Approved board reads scored storage objects" on storage.objects;
create policy "Approved board reads scored storage objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'partituras'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.approval_status = 'approved'
      and p.role in ('superadmin','directiva')
  )
);
-- Las políticas de lectura específicas de músicos siguen aplicándose;
-- la directiva ya tenía acceso al repertorio completo.
