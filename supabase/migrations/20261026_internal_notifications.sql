-- PASIÓN APP · Notificaciones privadas por usuario.
-- Ejecutar después de las migraciones de calendario, tablón y votaciones.
-- Los avisos se crean para nuevas publicaciones, no para datos anteriores.
create table if not exists public.app_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('ensayo','actuacion','evento','comunicado','votacion')),
 source_id uuid not null,
 title text not null check(length(title) between 1 and 180),
 message text not null default '' check(length(message)<=500),
 destination text not null check(destination in ('/panel/calendario','/panel/tablon','/panel/votaciones')),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(user_id,kind,source_id)
);
create index if not exists app_notifications_user_date_idx on public.app_notifications(user_id,created_at desc);
alter table public.app_notifications enable row level security;
revoke all on public.app_notifications from anon,authenticated;
grant select on public.app_notifications to authenticated;
grant update(read_at) on public.app_notifications to authenticated;
drop policy if exists "Members read own notifications" on public.app_notifications;
create policy "Members read own notifications" on public.app_notifications
for select to authenticated using(user_id=(select auth.uid())
and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved'));
drop policy if exists "Members mark own notifications read" on public.app_notifications;
create policy "Members mark own notifications read" on public.app_notifications
for update to authenticated using(user_id=(select auth.uid())
and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved'))
with check(user_id=(select auth.uid())
and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved'));

create or replace function public.notify_band_event()
returns trigger language plpgsql security definer set search_path='' as $event_notify$
begin
 insert into public.app_notifications(user_id,kind,source_id,title,message,destination)
 select p.id,
 case when new.event_type='ensayo' then 'ensayo'
      when new.event_type='actuacion' then 'actuacion' else 'evento' end,
 new.id,
 case when new.event_type='ensayo' then 'Nuevo ensayo'
      when new.event_type='actuacion' then 'Nueva actuación'
      else 'Nueva actividad' end,
 left(new.title,160),
 '/panel/calendario'
 from public.profiles p
 where p.approval_status='approved' and p.id<>new.created_by
 on conflict(user_id,kind,source_id) do nothing;
 return new;
end $event_notify$;
create or replace function public.notify_important_post()
returns trigger language plpgsql security definer set search_path='' as $post_notify$
begin
 if new.priority='importante' then
  insert into public.app_notifications(user_id,kind,source_id,title,message,destination)
  select p.id,'comunicado',new.id,
   'Comunicado importante',left(new.title,160),'/panel/tablon'
  from public.profiles p
  where p.approval_status='approved' and p.id<>new.author_id
  on conflict(user_id,kind,source_id) do nothing;
 end if;
 return new;
end $post_notify$;
create or replace function public.notify_march_vote()
returns trigger language plpgsql security definer set search_path='' as $vote_notify$
begin
 insert into public.app_notifications(user_id,kind,source_id,title,message,destination)
 select p.id,'votacion',new.id,'Nueva votación de marchas',
 left(new.title,160),'/panel/votaciones'
 from public.profiles p
 where p.approval_status='approved' and p.id<>new.created_by
 on conflict(user_id,kind,source_id) do nothing;
 return new;
end $vote_notify$;

drop trigger if exists notifications_on_band_event on public.band_events;
create trigger notifications_on_band_event after insert on public.band_events
for each row execute function public.notify_band_event();
drop trigger if exists notifications_on_important_post on public.board_posts;
create trigger notifications_on_important_post after insert on public.board_posts
for each row execute function public.notify_important_post();
drop trigger if exists notifications_on_march_vote on public.march_proposals;
create trigger notifications_on_march_vote after insert on public.march_proposals
for each row execute function public.notify_march_vote();

revoke all on function public.notify_band_event() from public,anon,authenticated;
revoke all on function public.notify_important_post() from public,anon,authenticated;
revoke all on function public.notify_march_vote() from public,anon,authenticated;
notify pgrst,'reload schema';
