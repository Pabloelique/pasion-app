-- PASIÓN APP · Integridad del inventario existente. No borra ni modifica registros previos.
-- Ejecutar después de 20261025_inventory.sql.
create or replace function public.guard_inventory_integrity()
returns trigger language plpgsql security invoker set search_path='' as $inventory_guard$
begin
 if tg_op='UPDATE' then
  if new.id is distinct from old.id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
   raise exception 'No se permite alterar identidad ni autoría del inventario';
  end if;
  new.updated_at=now();
 end if;
 if new.assigned_to is not null and not exists (
    select 1 from public.profiles p
    where p.id=new.assigned_to and p.approval_status='approved'
 ) then
   raise exception 'El material solo puede asignarse a miembros aprobados';
 end if;
 return new;
end $inventory_guard$;
drop trigger if exists guard_inventory_integrity_trigger on public.band_inventory;
create trigger guard_inventory_integrity_trigger
before insert or update on public.band_inventory
for each row execute function public.guard_inventory_integrity();
revoke all on function public.guard_inventory_integrity() from public,anon,authenticated;
