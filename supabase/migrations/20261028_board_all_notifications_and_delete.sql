-- Todos los comunicados nuevos generan avisos; directiva puede eliminarlos.
begin;
create or replace function public.notify_important_post()
returns trigger language plpgsql security definer set search_path='' as $post_notify$
begin
 insert into public.app_notifications(user_id,kind,source_id,title,message,destination)
 select p.id,'comunicado',new.id,
  case when new.priority='importante' then 'Comunicado importante' else 'Nuevo comunicado' end,
  left(new.title,160),'/panel/tablon'
 from public.profiles p
 where p.approval_status='approved' and p.id<>new.author_id
 on conflict(user_id,kind,source_id) do nothing;
 return new;
end $post_notify$;

create or replace function public.delete_board_post(p_post_id uuid)
returns void language plpgsql security definer set search_path='' as $delete_post$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
  and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 then raise exception 'Solo la directiva puede eliminar anuncios' using errcode='42501'; end if;
 perform 1 from public.board_posts where id=p_post_id for update;
 if not found then raise exception 'El anuncio ya no existe'; end if;
 delete from public.app_notifications where kind='comunicado' and source_id=p_post_id;
 -- Las respuestas se eliminan por la relación ON DELETE CASCADE.
 delete from public.board_posts where id=p_post_id;
end $delete_post$;
revoke all on function public.delete_board_post(uuid) from public,anon;
grant execute on function public.delete_board_post(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
