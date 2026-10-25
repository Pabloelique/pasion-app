-- PASIÓN APP · Tablón interno de anuncios y conversación
-- Ejecutar en Supabase SQL Editor.
create table if not exists public.board_posts (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 3 and 160),
 content text not null check (char_length(btrim(content)) between 3 and 4000),
 priority text not null default 'normal' check(priority in ('normal','importante')),
 author_id uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists board_posts_created_idx on public.board_posts(created_at desc);
alter table public.board_posts enable row level security;
revoke all on public.board_posts from anon,authenticated;
grant select,insert on public.board_posts to authenticated;
drop policy if exists "Approved members can read board posts" on public.board_posts;
create policy "Approved members can read board posts" on public.board_posts
 for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved'));
drop policy if exists "Only approved board can publish posts" on public.board_posts;
create policy "Only approved board can publish posts" on public.board_posts
 for insert to authenticated with check (
 author_id=(select auth.uid()) and
 exists(select 1 from public.profiles p where p.id=(select auth.uid())
 and p.approval_status='approved' and p.role in ('directiva','superadmin')));

create table if not exists public.board_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.board_posts(id) on delete cascade,
 author_id uuid not null default auth.uid() references auth.users(id),
 content text not null check(char_length(btrim(content)) between 1 and 1500),
 created_at timestamptz not null default now()
);
create index if not exists board_comments_post_idx on public.board_comments(post_id,created_at);
alter table public.board_comments enable row level security;
revoke all on public.board_comments from anon,authenticated;
grant select,insert on public.board_comments to authenticated;
drop policy if exists "Approved members read board comments" on public.board_comments;
create policy "Approved members read board comments" on public.board_comments
 for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved'));
drop policy if exists "Approved members write board comments" on public.board_comments;
create policy "Approved members write board comments" on public.board_comments
 for insert to authenticated with check (
 author_id=(select auth.uid()) and
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
 and exists(select 1 from public.board_posts bp where bp.id=post_id));

-- Mostrar nombres de autores sin abrir públicamente los perfiles.
create or replace function public.board_people()
returns table (id uuid,display_name text)
language plpgsql security definer set search_path='' as $$
begin
 if not exists (select 1 from public.profiles p where p.id=auth.uid()
 and p.approval_status='approved') then
 raise exception 'Acceso denegado' using errcode='42501';
 end if;
 return query select p.id, trim(p.first_name||' '||p.last_name)
 from public.profiles p where p.approval_status='approved';
end $$;
revoke all on function public.board_people() from public,anon;
grant execute on function public.board_people() to authenticated;
