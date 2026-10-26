-- PASIÓN APP — INVENTARIO PREVIO A LIMPIEZA (SOLO LECTURA)
-- Ejecuta en Supabase SQL Editor. NO modifica, elimina ni renombra nada.
-- Exporta cada resultado como CSV y guárdalo de forma privada.
-- ATENCIÓN: "candidato" NO significa que sea seguro eliminarlo.

-- 1. Cuántos registros existen por tabla de PASIÓN APP.
select 'profiles' as tabla,count(*) as registros from public.profiles
union all select 'musical_parts',count(*) from public.musical_parts
union all select 'march_scores',count(*) from public.march_scores
union all select 'full_scores',count(*) from public.full_scores
union all select 'band_events',count(*) from public.band_events
union all select 'event_responses',count(*) from public.event_responses
union all select 'attendance_marks',count(*) from public.attendance_marks
union all select 'attendance_changes',count(*) from public.attendance_changes
union all select 'board_posts',count(*) from public.board_posts
union all select 'board_comments',count(*) from public.board_comments
union all select 'march_proposals',count(*) from public.march_proposals
union all select 'march_proposal_votes',count(*) from public.march_proposal_votes
union all select 'treasury_movements',count(*) from public.treasury_movements
union all select 'band_bookings',count(*) from public.band_bookings
union all select 'booking_payments',count(*) from public.booking_payments
union all select 'booking_changes',count(*) from public.booking_changes
union all select 'band_inventory',count(*) from public.band_inventory
union all select 'inventory_changes',count(*) from public.inventory_changes
union all select 'rehearsal_pieces',count(*) from public.rehearsal_pieces
union all select 'app_notifications',count(*) from public.app_notifications
union all select 'band_repertoire',count(*) from public.band_repertoire
order by tabla;

-- 2. Resumen de cuentas (NO modifica usuarios).
select role,approval_status,count(*) as cuentas from public.profiles
group by role,approval_status order by role,approval_status;

-- 3. Registros etiquetados explícitamente como prueba.
select 'tesoreria' as origen,id::text as registro_id,
 description as titulo,created_at,is_test
from public.treasury_movements where is_test is true
union all
select 'actuaciones',id::text,title,created_at,is_test
from public.band_bookings where is_test is true
order by origen,created_at;

-- 4. Referencias sospechosas SOLO PARA REVISIÓN HUMANA.
-- Un registro real puede llamarse "Prueba de sonido" o similar.
select 'usuario' as origen,id::text as registro_id,
 concat_ws(' ',first_name,last_name) as titulo,created_at
from public.profiles where concat_ws(' ',first_name,last_name) ~* '(test|prueba|demo|fictici)'
union all
select 'evento',id::text,title,created_at
from public.band_events where title ~* '(test|prueba|demo|fictici)'
union all
select 'tablón',id::text,title,created_at
from public.board_posts where title ~* '(test|prueba|demo|fictici)'
union all
select 'votación',id::text,title,created_at
from public.march_proposals where title ~* '(test|prueba|demo|fictici)'
union all
select 'inventario',id::text,title,created_at
from public.band_inventory where title ~* '(test|prueba|demo|fictici)'
union all
select 'repertorio',id::text,title,created_at
from public.band_repertoire where title ~* '(test|prueba|demo|fictici)'
union all
select 'partitura',id::text,title,created_at
from public.march_scores where title ~* '(test|prueba|demo|fictici)'
union all
select 'guion',id::text,title,created_at
from public.full_scores where title ~* '(test|prueba|demo|fictici)'
order by origen,created_at;

-- 5. Recursos de Supabase Storage: solo metadatos, no archivos reales.
select bucket_id,count(*) as archivos,
 coalesce(sum((metadata->>'size')::bigint),0) as bytes_aproximados
from storage.objects
where bucket_id='partituras'
group by bucket_id;

-- 6. Avisos sobre relaciones: marcadores de prueba con cobros u otros datos.
select b.id,b.title,b.is_test,count(p.id) as cobros,
 coalesce(sum(p.amount_cents),0) as importe_cobrado_centimos
from public.band_bookings b left join public.booking_payments p on p.booking_id=b.id
where b.is_test is true or b.title ~* '(test|prueba|demo|fictici)'
group by b.id,b.title,b.is_test
order by b.title;

-- FIN. No se ejecuta DELETE, UPDATE, TRUNCATE ni modificación de esquema.
