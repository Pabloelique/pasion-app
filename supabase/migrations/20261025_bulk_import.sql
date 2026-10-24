-- Importación por lotes: identificación de duplicados sin publicar archivos.
-- Ejecutar tras las migraciones de partituras y guiones completos.
alter table public.march_scores add column if not exists import_hash text;
alter table public.full_scores add column if not exists import_hash text;
create unique index if not exists march_scores_import_hash_unique on public.march_scores(musical_part_id,import_hash) where import_hash is not null;
create unique index if not exists full_scores_import_hash_unique on public.full_scores(import_hash) where import_hash is not null;
-- Nunca permitir subir directamente a un bucket público.
update storage.buckets set public=false where id='partituras';
