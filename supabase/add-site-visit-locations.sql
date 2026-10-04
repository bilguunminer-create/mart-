-- Approximate visitor location for the admin statistics (country / region / city).
-- Apply after add-verified-site-visits.sql. Run once in the Supabase SQL Editor.
--
-- The location comes only from Vercel's edge headers (derived from the visitor's
-- IP) via the trusted /api/site-visit service; browsers cannot supply it. Until
-- this file is applied the API keeps using log_site_visit_v3 without location.
begin;
set local lock_timeout = '5s';

alter table public.site_visits
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists city text;

create index if not exists site_visits_location_idx
  on public.site_visits(created_at, country, region, city) where country is not null;

create or replace function public.log_site_visit_v4(
  p_visitor_id uuid,
  p_visit_key uuid,
  p_path text,
  p_ip_address inet,
  p_user_agent text,
  p_user_id uuid default null,
  p_auth_session_id uuid default null,
  p_country text default null,
  p_region text default null,
  p_city text default null
)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- All identity/session checks stay in v3; it raises before anything is stored.
  perform public.log_site_visit_v3(p_visitor_id, p_visit_key, p_path, p_ip_address,
    p_user_agent, p_user_id, p_auth_session_id);
  update public.site_visits set
    country = coalesce(country, nullif(left(upper(p_country), 2), '')),
    region = coalesce(region, nullif(left(upper(p_region), 3), '')),
    city = coalesce(city, nullif(left(p_city, 80), ''))
  where visit_key = p_visit_key and visitor_id = p_visitor_id;
end;
$$;
revoke all on function public.log_site_visit_v4(uuid, uuid, text, inet, text, uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.log_site_visit_v4(uuid, uuid, text, inet, text, uuid, uuid, text, text, text)
  to service_role;

-- Admin-only aggregate: top 25 locations per period; no per-visitor rows.
create or replace function public.get_site_visit_locations()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
  today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Ulaanbaatar') at time zone 'Asia/Ulaanbaatar';
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  with periods(label, since) as (
    values ('total', '-infinity'::timestamptz), ('today', today_start),
      ('last7days', now() - interval '7 days'), ('last30days', now() - interval '30 days')
  ), grouped as (
    select p.label,
      coalesce(v.country, '') as country, coalesce(v.region, '') as region, coalesce(v.city, '') as city,
      count(*) as pageviews,
      count(distinct coalesce('account:' || v.user_id::text, 'browser:' || v.visitor_id::text)) as visitors
    from periods p
    join public.site_visits v on v.created_at >= p.since
    group by p.label, 2, 3, 4
  ), ranked as (
    select *, row_number() over (partition by label order by visitors desc, pageviews desc) as rank
    from grouped
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'period', label, 'country', country, 'region', region, 'city', city,
      'pageviews', pageviews, 'visitors', visitors) order by label, rank), '[]'::jsonb)
  into result
  from ranked where rank <= 25;
  return result;
end;
$$;
revoke all on function public.get_site_visit_locations() from public, anon;
grant execute on function public.get_site_visit_locations() to authenticated;
commit;
