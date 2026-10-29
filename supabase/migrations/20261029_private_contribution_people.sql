-- Only an approved superadmin may identify responses to a contribution consultation.
begin;
create or replace function public.march_contribution_people(target_contest uuid)
returns table(user_id uuid,member_name text,willing boolean,answered_at timestamptz)
language plpgsql security definer set search_path='' as $people$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
 and p.approval_status='approved' and p.role='superadmin')
 then raise exception 'Solo el superadmin puede consultar quién responde a las aportaciones' using errcode='42501';end if;
 if not exists(select 1 from public.march_contests c where c.id=target_contest and c.published_at is not null)
 then raise exception 'Consulta no publicada o inexistente';end if;
 return query select a.user_id,trim(concat_ws(' ',p.first_name,p.last_name)),a.willing,a.created_at
 from public.march_contest_contributions a join public.profiles p on p.id=a.user_id
 where a.contest_id=target_contest order by a.created_at,p.last_name,p.first_name;
end $people$;
revoke all on function public.march_contribution_people(uuid) from public,anon;
grant execute on function public.march_contribution_people(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
