-- PASIÓN APP · Tesorería privada (registro contable interno, no pasarela de pagos)
-- Ejecutar en Supabase SQL Editor. Importes en céntimos para evitar errores decimales.
create table if not exists public.treasury_movements (
 id uuid primary key default gen_random_uuid(),
 movement_date date not null default current_date,
 kind text not null check(kind in ('ingreso','gasto')),
 category text not null check(category in (
  'actuacion','donacion','cuota_voluntaria','subvencion','instrumentos',
  'partituras','transporte','uniformes','material','otros'
 )),
 description text not null check(char_length(btrim(description)) between 3 and 300),
 amount_cents bigint not null check(amount_cents between 1 and 999999999),
 payment_method text not null default 'otros'
  check(payment_method in ('efectivo','transferencia','tarjeta','otros')),
 reference text not null default '' check(char_length(reference)<=120),
 is_test boolean not null default false,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 reversal_of uuid unique references public.treasury_movements(id),
 constraint treasury_reversal_not_self check(reversal_of is null or reversal_of<>id)
);
create index if not exists treasury_movements_date_idx on public.treasury_movements(movement_date desc,created_at desc);
alter table public.treasury_movements enable row level security;
revoke all on public.treasury_movements from anon,authenticated;
grant select,insert on public.treasury_movements to authenticated;
drop policy if exists "Board reads treasury" on public.treasury_movements;
create policy "Board reads treasury" on public.treasury_movements
for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid())
 and p.approval_status='approved' and p.role in ('superadmin','directiva'))
);
drop policy if exists "Board records treasury" on public.treasury_movements;
create policy "Board records treasury" on public.treasury_movements
for insert to authenticated with check (
 created_by=(select auth.uid())
 and reversal_of is null
 and exists(select 1 from public.profiles p where p.id=(select auth.uid())
 and p.approval_status='approved' and p.role in ('superadmin','directiva'))
);
-- Los asientos no se pueden editar ni borrar. Una anulación crea otro asiento
-- del mismo importe y signo contrario, registrando quién lo efectuó.
create or replace function public.reverse_treasury_movement(target_id uuid,reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare original public.treasury_movements%rowtype;
declare result_id uuid;
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
  and p.approval_status='approved' and p.role in ('superadmin','directiva'))
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if char_length(btrim(coalesce(reason,'')))<5 or char_length(reason)>200
 then raise exception 'Indica un motivo de anulación de 5 a 200 caracteres'; end if;
 select * into original from public.treasury_movements m where m.id=target_id;
 if not found or original.reversal_of is not null
 then raise exception 'Movimiento original no válido'; end if;
 if exists(select 1 from public.treasury_movements m where m.reversal_of=target_id)
 then raise exception 'Este movimiento ya está anulado'; end if;
 insert into public.treasury_movements (
  movement_date,kind,category,description,amount_cents,payment_method,
  reference,is_test,created_by,reversal_of
 ) values (
  current_date,case when original.kind='ingreso' then 'gasto' else 'ingreso' end,
  original.category,'Anulación: '||left(original.description,170)||' ('||btrim(reason)||')',
  original.amount_cents,original.payment_method,original.reference,original.is_test,
  auth.uid(),target_id
 ) returning id into result_id;
 return result_id;
end $$;
revoke all on function public.reverse_treasury_movement(uuid,text) from public,anon,authenticated;
grant execute on function public.reverse_treasury_movement(uuid,text) to authenticated;
notify pgrst,'reload schema';
