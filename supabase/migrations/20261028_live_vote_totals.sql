begin;
-- Solo totales agregados para miembros aprobados; se mantienen privados los votos individuales.
create or replace function public.march_contest_results()
returns table(contest_id uuid,option_id uuid,vote_count bigint)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_approved_band_member() then raise exception 'Acceso denegado'; end if;
 return query select o.contest_id,o.id,count(v.user_id)
 from public.march_contest_options o
 left join public.march_contest_votes v on v.contest_id=o.contest_id and v.option_id=o.id
 group by o.contest_id,o.id;
end $$;
create or replace function public.march_vote_results()
returns table(proposal_id uuid,yes_votes bigint,no_votes bigint)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_approved_band_member() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 return query select pr.id,
 count(v.user_id) filter(where v.choice='si'),
 count(v.user_id) filter(where v.choice='no')
 from public.march_proposals pr
 left join public.march_proposal_votes v on v.proposal_id=pr.id
 group by pr.id;
end $$;
notify pgrst,'reload schema';
commit;
