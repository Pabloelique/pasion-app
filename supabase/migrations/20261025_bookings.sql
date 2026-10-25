-- PASIÓN APP · Contrataciones y actuaciones
-- Gestión interna; no equivale a contrato firmado ni a factura.
create table if not exists public.band_bookings (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(btrim(title)) between 3 and 160),
 customer_name text not null check(length(btrim(customer_name)) between 3 and 180),
 location text not null default '',
 performance_date date not null,
 start_time time,
 duration_minutes integer check(duration_minutes is null or duration_minutes between 15 and 1440),
 status text not null default 'propuesta'
   check(status in ('propuesta','negociacion','confirmada','realizada','cancelada')),
 fee_cents bigint not null default 0 check(fee_cents between 0 and 999999999),
 notes text not null default '' check(length(notes)<=2500),
 contract_reference text not null default '' check(length(contract_reference)<=200),
 is_test boolean not null default false,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists band_bookings_date_idx on public.band_bookings(performance_date desc);
create table if not exists public.booking_payments (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.band_bookings(id) on delete restrict,
 paid_on date not null default current_date,
 amount_cents bigint not null check(amount_cents>0 and amount_cents<=999999999),
 method text not null default 'transferencia' check(method in ('efectivo','transferencia','tarjeta','otros')),
 reference text not null default '' check(length(reference)<=180),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists booking_payments_booking_idx on public.booking_payments(booking_id);
alter table public.band_bookings enable row level security;
alter table public.booking_payments enable row level security;
revoke all on public.band_bookings from anon,authenticated;
revoke all on public.booking_payments from anon,authenticated;
grant select,insert,update on public.band_bookings to authenticated;
grant select,insert on public.booking_payments to authenticated;
drop policy if exists "Managers read bookings" on public.band_bookings;
create policy "Managers read bookings" on public.band_bookings
for select to authenticated using(exists(select 1 from public.profiles p
 where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin')));
drop policy if exists "Managers create bookings" on public.band_bookings;
create policy "Managers create bookings" on public.band_bookings
for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.profiles p
 where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin')));
drop policy if exists "Managers update bookings" on public.band_bookings;
create policy "Managers update bookings" on public.band_bookings
for update to authenticated using(exists(select 1 from public.profiles p
 where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin')))
with check(exists(select 1 from public.profiles p
 where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin')));
drop policy if exists "Managers view booking payments" on public.booking_payments;
create policy "Managers view booking payments" on public.booking_payments
for select to authenticated using(exists(select 1 from public.profiles p
 where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin')));
drop policy if exists "Managers record booking payments" on public.booking_payments;
create policy "Managers record booking payments" on public.booking_payments
for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.profiles p
 where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 and exists(select 1 from public.band_bookings b where b.id=booking_id and b.status<>'cancelada'
   and b.is_test=false and b.fee_cents>0));
-- Cobros se registran en este libro; no se duplican automáticamente en Tesorería.

create table if not exists public.booking_changes(
 id bigint generated always as identity primary key,
 booking_id uuid not null references public.band_bookings(id) on delete cascade,
 actor_id uuid references auth.users(id),
 old_record jsonb,
 new_record jsonb not null,
 recorded_at timestamptz not null default now()
);
alter table public.booking_changes enable row level security;
revoke all on public.booking_changes from anon,authenticated;
grant select on public.booking_changes to authenticated;
drop policy if exists "Managers read booking history" on public.booking_changes;
create policy "Managers read booking history" on public.booking_changes
for select to authenticated using(exists(select 1 from public.profiles p
 where p.id=(select auth.uid()) and p.approval_status='approved' and p.role in ('directiva','superadmin')));
create or replace function public.audit_booking()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if old.created_by<>new.created_by or old.is_test<>new.is_test then
   raise exception 'No se permite cambiar creador ni tipo de dato'; end if;
  new.updated_at=now();
 end if;
 return new;
end $$;
create or replace function public.log_booking_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into public.booking_changes(booking_id,actor_id,old_record,new_record)
  values(new.id,auth.uid(),null,to_jsonb(new));
 elsif to_jsonb(old) is distinct from to_jsonb(new) then
  insert into public.booking_changes(booking_id,actor_id,old_record,new_record)
  values(new.id,auth.uid(),to_jsonb(old),to_jsonb(new));
 end if;
 return new;
end $$;
drop trigger if exists booking_update_fields on public.band_bookings;
create trigger booking_update_fields before update on public.band_bookings
for each row execute function public.audit_booking();
drop trigger if exists booking_history on public.band_bookings;
create trigger booking_history after insert or update on public.band_bookings
for each row execute function public.log_booking_change();
revoke all on function public.audit_booking() from public,anon,authenticated;
revoke all on function public.log_booking_change() from public,anon,authenticated;
notify pgrst,'reload schema';
