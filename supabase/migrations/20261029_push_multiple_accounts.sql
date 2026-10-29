begin;
-- La suscripción pertenece a una cuenta y un dispositivo, no solo al dispositivo.
alter table public.push_subscriptions drop constraint push_subscriptions_endpoint_key;
alter table public.push_subscriptions add constraint push_subscriptions_user_endpoint_key unique(user_id,endpoint);
-- Se conservan los registros y todas las políticas de acceso por propietario.
notify pgrst,'reload schema';
commit;
