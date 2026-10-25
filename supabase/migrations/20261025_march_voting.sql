-- PASIÓN APP · Votaciones internas para incorporar nuevas marchas
-- Ejecutar en Supabase SQL Editor. Todos los importes son orientativos y voluntarios.
create table if not exists public.march_proposals (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(btrim(title)) between 3 and 160),
 description text not null default '' check(length(description)<=3000),
 estimated_cost numeric(10,2) check(estimated_cost is null or estimated_cost>=0),
 closes_at timestamptz not null,
 closed_at timestamptz,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 constraint close_after_open check(closes_at>created_at),
 constraint close_marker check(closed_at is null or closed_at>=created_at)
);
create index if not exists march_proposals_recent on public.march_proposals(created_at desc);
create table if not exists public.march_proposal_votes (
 proposal_id uuid not null references public.march_proposals(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 choice text not null check(choice in ('si','no')),
 created_at timestamptz not null default now(),
 primary key (proposal_id,user_id)
);
create index if not exists march_proposal_votes_user on public.march_proposal_votes(user_id);
alter table public.march_proposals enable row level security;
alter table public.march_proposal_votes enable row level security;
revoke all on public.march_proposals from anon,authenticated;
revoke all on public.march_proposal_votes from anon,authenticated;
grant select,insert on public.march_proposals to authenticated;
grant select,insert on public.march_proposal_votes to authenticated;
drop policy if exists "Approved members view proposals" on public.march_proposals;
create policy "Approved members view proposals" on public.march_proposals
 for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
 );
drop policy if exists "Board members can propose marches" on public.march_proposals;
create policy "Board members can propose marches" on public.march_proposals
 for insert to authenticated with check (
 created_by=(select auth.uid())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid())
 and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 );
drop policy if exists "Members view own vote" on public.march_proposal_votes;
create policy "Members view own vote" on public.march_proposal_votes
 for select to authenticated using (
 user_id=(select auth.uid())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
 );
drop policy if exists "Members can vote once while open" on public.march_proposal_votes;
create policy "Members can vote once while open" on public.march_proposal_votes
 for insert to authenticated with check (
 user_id=(select auth.uid())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
 and exists(select 1 from public.march_proposals pr where pr.id=proposal_id
 and pr.closed_at is null and pr.closes_at>now())
 );
-- Unique primary key protects one ballot per member and proposal even under concurrency.
-- No UPDATE or DELETE grants: a cast ballot cannot be changed from the client.
create or replace function public.march_vote_results()
returns table(proposal_id uuid, yes_votes bigint, no_votes bigint)
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
 and p.approval_status='approved') then
 raise exception 'Acceso denegado' using errcode='42501'; end if;
 return query
 select v.proposal_id,
 count(*) filter(where v.choice='si'),
 count(*) filter(where v.choice='no')
 from public.march_proposal_votes v
 join public.march_proposals pr on pr.id=v.proposal_id
 where pr.closed_at is not null or pr.closes_at<=now()
 group by v.proposal_id;
end $$;
create or replace function public.close_march_proposal(target_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
 and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 update public.march_proposals set closed_at=now()
 where id=target_id and closed_at is null;
 if not found then raise exception 'Propuesta inexistente o ya cerrada'; end if;
end $$;
revoke all on function public.march_vote_results() from public,anon;
revoke all on function public.close_march_proposal(uuid) from public,anon;
grant execute on function public.march_vote_results() to authenticated;
grant execute on function public.close_march_proposal(uuid) to authenticated;
notify pgrst,'reload schema';
