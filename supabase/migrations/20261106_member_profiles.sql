-- PASIÓN APP · Perfil de cada músico: foto, marcha favorita, redes, sobre mí y ficha visible para los compañeros.
-- Requiere: 20261106_reminders_birthdays.sql (cumpleaños).

alter table public.profiles add column if not exists favorite_march text;
alter table public.profiles add column if not exists facebook text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles drop constraint if exists profiles_public_fields_check;
alter table public.profiles add constraint profiles_public_fields_check check (
 (favorite_march is null or char_length(favorite_march) between 1 and 120)
 and (bio is null or char_length(bio) between 1 and 280)
 and (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$')
 and (tiktok is null or tiktok ~ '^[A-Za-z0-9._]{1,30}$')
 and (facebook is null or facebook ~ '^[A-Za-z0-9.]{1,50}$')
 and (avatar_url is null or avatar_url ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')
);

-- Fotos de perfil: bucket privado, solo visible para miembros aprobados.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Members read avatars" on storage.objects;
create policy "Members read avatars" on storage.objects for select to authenticated
 using (bucket_id='avatars' and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role<>'viewer'));
drop policy if exists "Members upload own avatar" on storage.objects;
create policy "Members upload own avatar" on storage.objects for insert to authenticated
 with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' and p.role<>'viewer'));
drop policy if exists "Members delete own avatar" on storage.objects;
create policy "Members delete own avatar" on storage.objects for delete to authenticated
 using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

create or replace function public.update_my_profile(
 p_first_name text,p_last_name text,p_favorite_march text,p_bio text,
 p_instagram text,p_tiktok text,p_facebook text,p_avatar_path text)
returns void language plpgsql security definer set search_path='' as $$
declare clean text;
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.approval_status='approved' and p.role<>'viewer')
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if char_length(btrim(coalesce(p_first_name,''))) not between 1 and 60 or char_length(btrim(coalesce(p_last_name,''))) not between 1 and 80
 then raise exception 'Escribe tu nombre y apellidos'; end if;
 if p_avatar_path is not null and p_avatar_path not like auth.uid()::text||'/%'
 then raise exception 'Foto no válida'; end if;
 update public.profiles set
  first_name=btrim(p_first_name),
  last_name=btrim(p_last_name),
  favorite_march=nullif(btrim(coalesce(p_favorite_march,'')),''),
  bio=nullif(btrim(coalesce(p_bio,'')),''),
  instagram=nullif(btrim(coalesce(p_instagram,'')),''),
  tiktok=nullif(btrim(coalesce(p_tiktok,'')),''),
  facebook=nullif(btrim(coalesce(p_facebook,'')),''),
  avatar_url=p_avatar_path
 where id=auth.uid();
end $$;

-- Ficha pública para los compañeros: nunca muestra el año de nacimiento ni datos de contacto privados.
create or replace function public.member_profiles()
returns table(id uuid,first_name text,last_name text,part_name text,role text,avatar_path text,favorite_march text,bio text,
 instagram text,tiktok text,facebook text,birthday_day integer,birthday_month integer,member_since timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.approval_status='approved' and p.role<>'viewer')
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 return query
 select p.id,p.first_name,p.last_name,mp.name,p.role,p.avatar_url,p.favorite_march,p.bio,p.instagram,p.tiktok,p.facebook,
  extract(day from b.birth_date)::int,extract(month from b.birth_date)::int,coalesce(p.approved_at,p.created_at)
 from public.profiles p
 left join public.musical_parts mp on mp.id=p.musical_part_id
 left join public.member_birthdays b on b.user_id=p.id
 where p.approval_status='approved' and p.role<>'viewer'
 order by mp.name nulls last,p.first_name,p.last_name;
end $$;

revoke all on function public.update_my_profile(text,text,text,text,text,text,text,text) from public,anon;
revoke all on function public.member_profiles() from public,anon;
grant execute on function public.update_my_profile(text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.member_profiles() to authenticated;
