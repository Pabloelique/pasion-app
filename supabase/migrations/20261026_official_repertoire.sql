-- PASIÓN APP · Repertorio oficial con enlaces de escucha y conexión a votaciones.
-- Ejecutar DESPUÉS de 20261025_march_voting.sql.
-- No modifica las partituras ni incorpora automáticamente propuestas votadas.
create table if not exists public.band_repertoire (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(btrim(title)) between 3 and 160),
 composer text not null default '' check(char_length(composer)<=160),
 youtube_url text not null default '' check(char_length(youtube_url)<=500),
 spotify_url text not null default '' check(char_length(spotify_url)<=500),
 notes text not null default '' check(char_length(notes)<=1500),
 from_proposal uuid unique references public.march_proposals(id) on delete restrict,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists band_repertoire_title_unique on public.band_repertoire(lower(btrim(title)));
create index if not exists band_repertoire_order on public.band_repertoire(title);
alter table public.band_repertoire enable row level security;
revoke all on public.band_repertoire from anon,authenticated;
grant select,insert,update on public.band_repertoire to authenticated;
drop policy if exists "Approved members read official repertoire" on public.band_repertoire;
create policy "Approved members read official repertoire" on public.band_repertoire
for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved')
);
drop policy if exists "Board adds official repertoire" on public.band_repertoire;
create policy "Board adds official repertoire" on public.band_repertoire
for insert to authenticated with check (
 created_by=(select auth.uid())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid())
 and p.approval_status='approved' and p.role in ('directiva','superadmin'))
);
drop policy if exists "Board edits official repertoire" on public.band_repertoire;
create policy "Board edits official repertoire" on public.band_repertoire
for update to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid())
 and p.approval_status='approved' and p.role in ('directiva','superadmin'))
) with check (
 exists(select 1 from public.profiles p where p.id=(select auth.uid())
 and p.approval_status='approved' and p.role in ('directiva','superadmin'))
);

create or replace function public.guard_official_repertoire()
returns trigger language plpgsql security invoker set search_path='' as $repertoire_guard$
declare u text;
begin
 if tg_op='UPDATE' then
  if new.id is distinct from old.id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.from_proposal is distinct from old.from_proposal then
    raise exception 'No se puede modificar la procedencia ni la autoría del repertorio';
  end if;
  new.updated_at=now();
 end if;
 -- Los enlaces son opcionales: mejor dejarlos vacíos que inventar grabaciones.
 foreach u in array array[new.youtube_url,new.spotify_url] loop
  if u <> '' and (u !~ '^https://[^[:space:]]+$' or char_length(u)>500) then
   raise exception 'Los enlaces deben ser HTTPS válidos';
  end if;
 end loop;
 if new.youtube_url<>'' and
    not (new.youtube_url ilike 'https://youtube.com/%' or new.youtube_url ilike 'https://www.youtube.com/%' or new.youtube_url ilike 'https://youtu.be/%' or new.youtube_url ilike 'https://music.youtube.com/%') then
   raise exception 'El enlace de YouTube no es válido';
 end if;
 if new.spotify_url<>'' and
    not (new.spotify_url like 'https://open.spotify.com/track/%' or new.spotify_url like 'https://open.spotify.com/album/%' or new.spotify_url like 'https://open.spotify.com/episode/%' or new.spotify_url like 'https://open.spotify.com/playlist/%') then
   raise exception 'El enlace de Spotify no es válido';
 end if;
 if new.from_proposal is not null and
    not exists(select 1 from public.march_proposals pr where pr.id=new.from_proposal
      and (pr.closed_at is not null or pr.closes_at<=now())) then
   raise exception 'Solo se puede incorporar una propuesta cuya votación haya finalizado';
 end if;
 return new;
end $repertoire_guard$;
drop trigger if exists official_repertoire_integrity on public.band_repertoire;
create trigger official_repertoire_integrity before insert or update
on public.band_repertoire for each row execute function public.guard_official_repertoire();
revoke all on function public.guard_official_repertoire() from public,anon,authenticated;
notify pgrst,'reload schema';
