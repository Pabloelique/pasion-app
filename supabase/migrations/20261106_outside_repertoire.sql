-- PASIÓN APP · Apartado «Fuera de repertorio» en Partituras.
-- Marchas que no tocamos pero que un hilo puede consultar. Mismos permisos que el resto:
-- cada partitura la ve solo su hilo (y la directiva).
alter table public.march_scores add column if not exists outside_repertoire boolean not null default false;
