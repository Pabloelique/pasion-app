-- PASIÓN APP: permitir que el formulario público muestre los hilos.
-- Solo concede lectura a la lista de instrumentos, NO a los perfiles.
grant select on public.musical_parts to anon;
drop policy if exists "Public can read musical parts" on public.musical_parts;
create policy "Public can read musical parts"
on public.musical_parts for select to anon using (true);
