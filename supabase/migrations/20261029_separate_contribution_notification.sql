-- Publish contributions as a distinct notice; keep the original vote notice immutable.
begin;
alter table public.app_notifications drop constraint app_notifications_kind_check;
alter table public.app_notifications add constraint app_notifications_kind_check
 check(kind in ('ensayo','actuacion','evento','comunicado','votacion','ausencia','aportacion'));
create or replace function public.publish_march_contest(p_contest_id uuid,p_composer text,p_cost numeric)
returns void language plpgsql security definer set search_path='' as $$
declare v_closes timestamptz; v_published timestamptz; v_winner uuid; v_top bigint; v_ties bigint;
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
 and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 select closes_at,published_at into v_closes,v_published
 from public.march_contests where id=p_contest_id for update;
 if not found or v_closes>now() or v_published is not null then
 raise exception 'La votación no está terminada o ya fue publicada'; end if;
 if length(btrim(coalesce(p_composer,''))) not between 2 and 160
 or p_cost is null or p_cost<0 or p_cost>99999999.99
 then raise exception 'Introduce un autor y un importe válidos'; end if;
 select o.id,coalesce(count(v.user_id),0) into v_winner,v_top
 from public.march_contest_options o left join public.march_contest_votes v
 on v.contest_id=o.contest_id and v.option_id=o.id
 where o.contest_id=p_contest_id
 group by o.id order by count(v.user_id) desc,o.id limit 1;
 select count(*) into v_ties from (
 select o.id from public.march_contest_options o
 left join public.march_contest_votes v on v.contest_id=o.contest_id and v.option_id=o.id
 where o.contest_id=p_contest_id group by o.id having count(v.user_id)=v_top
 ) tie;
 if v_top=0 or v_ties<>1 then raise exception 'Empate o votación sin votos: haz una votación de desempate'; end if;
 update public.march_contests set winning_option_id=v_winner,composer=btrim(p_composer),
 estimated_cost=p_cost,published_at=now() where id=p_contest_id;
 insert into public.app_notifications(user_id,kind,source_id,title,message,destination)
 select p.id,'aportacion',p_contest_id,'Consulta de aportación voluntaria',
 left((select title from public.march_contest_options where id=v_winner),160),'/panel/votaciones'
 from public.profiles p where p.approval_status='approved'
 on conflict(user_id,kind,source_id) do nothing;
end $$;
revoke all on function public.publish_march_contest(uuid,text,numeric) from public,anon;
grant execute on function public.publish_march_contest(uuid,text,numeric) to authenticated;


create or replace function public.delete_march_contest(p_contest_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
 and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if not exists(select 1 from public.march_contests where id=p_contest_id)
 then raise exception 'Votación inexistente'; end if;
 delete from public.app_notifications where source_id=p_contest_id and kind in ('votacion','aportacion');
 delete from public.march_contests where id=p_contest_id;
end $$;
revoke all on function public.delete_march_contest(uuid) from public,anon;
grant execute on function public.delete_march_contest(uuid) to authenticated;
notify pgrst,'reload schema';



notify pgrst,'reload schema';
commit;
