-- Site visit tracking, shown in the admin Статистик tab ("сайтыг хэдэн хүн
-- үзсэн"). No third-party analytics service -- just a row per storefront
-- pageview, aggregated into counts an admin can read.
--
-- Privacy: no IP address or any other identifying data is stored. Each
-- browser generates its own random visitor_id (a plain UUID, stored in
-- localStorage on the client) so "unique visitors" can be counted without
-- fingerprinting or cookies. Anyone can INSERT a visit row (that's the whole
-- point -- it's how a pageview is logged), but nobody can read raw rows;
-- only the aggregate counts are exposed, and only to a signed-in admin.
--
-- Run this once in the Supabase SQL Editor.

create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  path text,
  created_at timestamptz not null default now()
);

create index if not exists site_visits_created_at_idx on public.site_visits (created_at);
create index if not exists site_visits_visitor_id_idx on public.site_visits (visitor_id);

alter table public.site_visits enable row level security;
-- No table-level policies: every access goes through the two functions below.

create or replace function public.log_site_visit(p_visitor_id uuid, p_path text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_visitor_id is null then raise exception 'INVALID_VISITOR'; end if;
  insert into public.site_visits (visitor_id, path)
  values (p_visitor_id, left(coalesce(p_path, ''), 200));
end $$;
revoke all on function public.log_site_visit(uuid, text) from public;
grant execute on function public.log_site_visit(uuid, text) to anon, authenticated;

create or replace function public.get_site_visit_stats()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Ulaanbaatar') at time zone 'Asia/Ulaanbaatar';
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'total_pageviews', (select count(*) from public.site_visits),
    'total_unique_visitors', (select count(distinct visitor_id) from public.site_visits),
    'today_pageviews', (select count(*) from public.site_visits where created_at >= today_start),
    'today_unique_visitors', (select count(distinct visitor_id) from public.site_visits where created_at >= today_start),
    'last7days_pageviews', (select count(*) from public.site_visits where created_at >= now() - interval '7 days'),
    'last7days_unique_visitors', (select count(distinct visitor_id) from public.site_visits where created_at >= now() - interval '7 days'),
    'last30days_pageviews', (select count(*) from public.site_visits where created_at >= now() - interval '30 days'),
    'last30days_unique_visitors', (select count(distinct visitor_id) from public.site_visits where created_at >= now() - interval '30 days')
  );
end $$;
revoke all on function public.get_site_visit_stats() from public, anon;
grant execute on function public.get_site_visit_stats() to authenticated;
