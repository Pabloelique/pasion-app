-- PASIÓN APP · Endurecimiento de notificaciones (sin borrar datos).
-- Ejecutar tras 20261026_internal_notifications.sql.
-- Una notificación solo puede pasar de pendiente a leída, una única vez.
create or replace function public.guard_notification_read()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $notification_guard$
begin
 if old.id is distinct from new.id
    or old.user_id is distinct from new.user_id
    or old.kind is distinct from new.kind
    or old.source_id is distinct from new.source_id
    or old.title is distinct from new.title
    or old.message is distinct from new.message
    or old.destination is distinct from new.destination
    or old.created_at is distinct from new.created_at
 then
   raise exception 'El contenido de una notificación es inmutable';
 end if;
 if old.read_at is not null and old.read_at is distinct from new.read_at then
   raise exception 'Una notificación leída no puede volver a estar pendiente';
 end if;
 if old.read_at is null and new.read_at is null then
   return new;
 end if;
 if new.read_at is null
    or new.read_at > now() + interval '1 minute'
    or new.read_at < old.created_at - interval '1 minute'
 then
   raise exception 'Fecha de lectura no válida';
 end if;
 return new;
end
$notification_guard$;

drop trigger if exists guard_notification_read_trigger on public.app_notifications;
create trigger guard_notification_read_trigger
before update on public.app_notifications
for each row execute function public.guard_notification_read();

revoke all on function public.guard_notification_read() from public,anon,authenticated;
-- Las políticas de lectura y actualización por propietario de la primera migración continúan vigentes.
