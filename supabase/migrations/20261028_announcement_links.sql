begin;
alter table public.board_posts add column if not exists link_path text;
alter table public.board_posts drop constraint if exists board_posts_internal_link;
alter table public.board_posts add constraint board_posts_internal_link check(
 link_path is null or link_path in ('/panel/votaciones','/panel/calendario','/panel/partituras','/panel/repertorio','/panel/tablon','/panel/notificaciones')
 or link_path ~* '^/panel/(votaciones#votacion-|calendario#evento-|tablon#anuncio-|notificaciones#aviso-)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);
notify pgrst,'reload schema';
commit;
