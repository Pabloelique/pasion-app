-- PASIÓN APP · Inventario privado de instrumentos y material
-- Ejecutar desde Supabase SQL Editor.
create table if not exists public.band_inventory (
 id uuid primary key default gen_random_uuid(),
 asset_code text not null unique check(length(btrim(asset_code)) between 2 and 40),
 title text not null check(length(btrim(title)) between 3 and 150),
 category text not null check(category in ('corneta','trompeta','trombon','bombardino','tuba','percusion','uniforme','accesorio','otro')),
 condition text not null default 'bueno' check(condition in ('nuevo','bueno','revision','reparacion','baja')),
 owner_type text not null default 'agrupacion' check(owner_type in ('agrupacion','cedido')),
 assigned_to uuid references auth.users(id) on delete set null,
 purchase_date date,
 purchase_price_cents bigint check(purchase_price_cents is null or purchase_price_cents>=0),
 next_maintenance date,
 notes text not null default '' check(length(notes)<=1500),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists band_inventory_category_idx on public.band_inventory(category);
create index if not exists band_inventory_assigned_idx on public.band_inventory(assigned_to);
alter table public.band_inventory enable row level security;
revoke all on public.band_inventory from anon,authenticated;
grant select,insert,update on public.band_inventory to authenticated;
drop policy if exists "Approved board reads inventory" on public.band_inventory;
create policy "Approved board reads inventory" on public.band_inventory for select to authenticated
using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('superadmin','directiva')));
drop policy if exists "Approved board adds inventory" on public.band_inventory;
create policy "Approved board adds inventory" on public.band_inventory for insert to authenticated
with check(created_by=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('superadmin','directiva')));
drop policy if exists "Approved board edits inventory" on public.band_inventory;
create policy "Approved board edits inventory" on public.band_inventory for update to authenticated
using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('superadmin','directiva')))
with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('superadmin','directiva'))
and (assigned_to is null or exists(select 1 from public.profiles p where p.id=assigned_to and p.approval_status='approved')));

create table if not exists public.inventory_changes (
 id bigint generated always as identity primary key,
 asset_id uuid not null references public.band_inventory(id) on delete cascade,
 actor_id uuid references auth.users(id),
 old_data jsonb,
 new_data jsonb not null,
 changed_at timestamptz not null default now()
);
alter table public.inventory_changes enable row level security;
revoke all on public.inventory_changes from anon,authenticated;
grant select on public.inventory_changes to authenticated;
drop policy if exists "Approved board reads inventory history" on public.inventory_changes;
create policy "Approved board reads inventory history" on public.inventory_changes for select to authenticated
using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('superadmin','directiva')));

create or replace function public.audit_inventory_changes()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
   new.updated_at=now();
   if to_jsonb(old) is distinct from to_jsonb(new) then
     insert into public.inventory_changes(asset_id,actor_id,old_data,new_data)
     values(new.id,auth.uid(),to_jsonb(old),to_jsonb(new));
   end if;
 else
   insert into public.inventory_changes(asset_id,actor_id,old_data,new_data)
   values(new.id,auth.uid(),null,to_jsonb(new));
 end if;
 return new;
end $$;
drop trigger if exists inventory_audit_trigger on public.band_inventory;
create trigger inventory_audit_trigger before insert or update on public.band_inventory
for each row execute function public.audit_inventory_changes();

create or replace function public.inventory_people()
returns table(id uuid,display_name text)
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.approval_status='approved' and p.role in ('superadmin','directiva'))
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 return query select p.id,trim(concat_ws(' ',p.first_name,p.last_name))
 from public.profiles p where p.approval_status='approved' order by p.last_name,p.first_name;
end $$;
revoke all on function public.inventory_people() from public,anon,authenticated;
revoke all on function public.audit_inventory_changes() from public,anon,authenticated;
grant execute on function public.inventory_people() to authenticated;
notify pgrst,'reload schema';
