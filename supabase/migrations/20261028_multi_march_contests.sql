-- PASIÓN APP · Concursos de marchas: 24h de votos, ganador y consulta voluntaria publicada por directiva.
-- Se conservan las votaciones antiguas de sí/no.
create table if not exists public.march_contests(
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(btrim(title)) between 3 and 160),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 closes_at timestamptz not null default (now()+interval '24 hours'),
 winning_option_id uuid,
 composer text,
 estimated_cost numeric(10,2) check(estimated_cost is null or estimated_cost>=0),
 published_at timestamptz,
 constraint contest_publish_fields check(published_at is null or
  (winning_option_id is not null and length(btrim(coalesce(composer,'')))>=2 and estimated_cost is not null))
);
create table if not exists public.march_contest_options(
 id uuid primary key default gen_random_uuid(),
 contest_id uuid not null references public.march_contests(id) on delete cascade,
 title text not null check(length(btrim(title)) between 3 and 160),
 unique(contest_id,id)
);
alter table public.march_contests add constraint march_contest_winner_fk
 foreign key(id,winning_option_id) references public.march_contest_options(contest_id,id);
create table if not exists public.march_contest_votes(
 contest_id uuid not null,
 option_id uuid not null,
 user_id uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(contest_id,user_id),
 foreign key(contest_id,option_id) references public.march_contest_options(contest_id,id) on delete cascade
);
create table if not exists public.march_contest_contributions(
 contest_id uuid not null references public.march_contests(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id),
 willing boolean not null,
 created_at timestamptz not null default now(),
 primary key(contest_id,user_id)
);
create index if not exists march_contests_created_idx on public.march_contests(created_at desc);
create index if not exists march_contest_votes_option_idx on public.march_contest_votes(contest_id,option_id);
alter table public.march_contests enable row level security;
alter table public.march_contest_options enable row level security;
alter table public.march_contest_votes enable row level security;
alter table public.march_contest_contributions enable row level security;
revoke all on public.march_contests,public.march_contest_options,public.march_contest_votes,public.march_contest_contributions from anon,authenticated;
grant select on public.march_contests,public.march_contest_options to authenticated;
grant select,insert on public.march_contest_votes,public.march_contest_contributions to authenticated;
create or replace function public.is_approved_band_member()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.approval_status='approved');
$$;
revoke all on function public.is_approved_band_member() from public,anon;
grant execute on function public.is_approved_band_member() to authenticated;
create policy "Members read contests" on public.march_contests
 for select to authenticated using(public.is_approved_band_member());
create policy "Members read contest options" on public.march_contest_options
 for select to authenticated using(public.is_approved_band_member());
create policy "Members read own contest votes" on public.march_contest_votes
 for select to authenticated using(user_id=auth.uid() and public.is_approved_band_member());
create policy "Vote once during contest" on public.march_contest_votes
 for insert to authenticated with check(user_id=auth.uid() and public.is_approved_band_member()
 and exists(select 1 from public.march_contests c where c.id=contest_id and c.closes_at>now()));
create policy "Members read own willingness" on public.march_contest_contributions
 for select to authenticated using(user_id=auth.uid() and public.is_approved_band_member());
create policy "Members can express willingness after publication" on public.march_contest_contributions
 for insert to authenticated with check(user_id=auth.uid() and public.is_approved_band_member()
 and exists(select 1 from public.march_contests c where c.id=contest_id and c.published_at is not null));

-- Publicar todos los candidatos de forma atómica; fija exactamente 24 horas desde la creación.
create or replace function public.create_march_contest(p_title text,p_titles text[])
returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
  and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if length(btrim(coalesce(p_title,''))) not between 3 and 160
 or coalesce(array_length(p_titles,1),0) not between 2 and 15
 or exists(select 1 from unnest(p_titles) v where v is null or length(btrim(v)) not between 3 and 160)
 or (select count(distinct lower(btrim(v))) from unnest(p_titles) v)<>array_length(p_titles,1)
 then raise exception 'Escribe entre 2 y 15 marchas distintas con nombres válidos'; end if;
 insert into public.march_contests(title,created_by) values(btrim(p_title),auth.uid()) returning id into cid;
 insert into public.march_contest_options(contest_id,title)
 select cid,btrim(v) from unnest(p_titles) v;
 insert into public.app_notifications(user_id,kind,source_id,title,message,destination)
 select p.id,'votacion',cid,'Nueva votación de marchas',left(btrim(p_title),160),'/panel/votaciones'
 from public.profiles p where p.approval_status='approved' and p.id<>auth.uid()
 on conflict(user_id,kind,source_id) do nothing;
 return cid;
end $$;
revoke all on function public.create_march_contest(text,text[]) from public,anon;
grant execute on function public.create_march_contest(text,text[]) to authenticated;

-- Los resultados no se publican mientras la votación siga abierta.
create or replace function public.march_contest_results()
returns table(contest_id uuid,option_id uuid,vote_count bigint)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_approved_band_member() then raise exception 'Acceso denegado'; end if;
 return query select o.contest_id,o.id,count(v.user_id)
 from public.march_contest_options o
 join public.march_contests c on c.id=o.contest_id
 left join public.march_contest_votes v on v.contest_id=o.contest_id and v.option_id=o.id
 where c.closes_at<=now()
 group by o.contest_id,o.id;
end $$;
revoke all on function public.march_contest_results() from public,anon;
grant execute on function public.march_contest_results() to authenticated;

-- La selección del ganador se calcula en servidor: empate o 0 votos bloquea publicación.
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
 select p.id,'votacion',p_contest_id,'Consulta de aportación voluntaria',
 left((select title from public.march_contest_options where id=v_winner),160),'/panel/votaciones'
 from public.profiles p where p.approval_status='approved'
 on conflict(user_id,kind,source_id) do update set title=excluded.title,
 message=excluded.message,created_at=now(),read_at=null;
end $$;
revoke all on function public.publish_march_contest(uuid,text,numeric) from public,anon;
grant execute on function public.publish_march_contest(uuid,text,numeric) to authenticated;

create or replace function public.march_contest_contribution_totals()
returns table(contest_id uuid,yes_count bigint,no_count bigint)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_approved_band_member() then raise exception 'Acceso denegado'; end if;
 return query select c.id,
 count(a.user_id) filter(where a.willing),
 count(a.user_id) filter(where not a.willing)
 from public.march_contests c left join public.march_contest_contributions a on a.contest_id=c.id
 where c.published_at is not null group by c.id;
end $$;
revoke all on function public.march_contest_contribution_totals() from public,anon;
grant execute on function public.march_contest_contribution_totals() to authenticated;

create or replace function public.delete_march_contest(p_contest_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
 and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if not exists(select 1 from public.march_contests where id=p_contest_id)
 then raise exception 'Votación inexistente'; end if;
 delete from public.app_notifications where source_id=p_contest_id and kind='votacion';
 delete from public.march_contests where id=p_contest_id;
end $$;
revoke all on function public.delete_march_contest(uuid) from public,anon;
grant execute on function public.delete_march_contest(uuid) to authenticated;
notify pgrst,'reload schema';


-- Eliminar también votaciones antiguas de Sí/No (con sus votos y avisos).
create or replace function public.delete_legacy_march_proposal(p_proposal_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
 and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if not exists(select 1 from public.march_proposals where id=p_proposal_id)
 then raise exception 'Votación inexistente'; end if;
 if exists(select 1 from public.band_repertoire where from_proposal=p_proposal_id)
 then raise exception 'Esta propuesta está vinculada al repertorio oficial. Desvincúlala antes de eliminarla'; end if;
 delete from public.app_notifications where source_id=p_proposal_id and kind='votacion';
 delete from public.march_proposals where id=p_proposal_id;
end $$;
revoke all on function public.delete_legacy_march_proposal(uuid) from public,anon;
grant execute on function public.delete_legacy_march_proposal(uuid) to authenticated;
