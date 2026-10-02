-- Apply after migrations/20260927135241_account_based_repeat_visit_tracking.sql.
-- Additive rollout: older clients can still record legacy pageviews. Only the
-- trusted /api/site-visit service may attest IP addresses and Auth sessions.
-- The CLI is not installed in this workspace; this is a SQL Editor migration.
begin;
set local lock_timeout = '5s';

alter table public.site_visits
  add column if not exists ip_address inet,
  add column if not exists user_agent text,
  add column if not exists auth_session_id uuid,
  add column if not exists server_verified boolean not null default false;

create index if not exists site_visits_ip_address_idx
  on public.site_visits(ip_address) where ip_address is not null;
create index if not exists site_visits_auth_session_idx
  on public.site_visits(auth_session_id) where auth_session_id is not null;

-- Keep observed login evidence after logout removes its auth.sessions row.
-- IPs describe a network connection; different accounts sharing an IP remain
-- separate identities. IP changes never constitute a new login.
create table if not exists private.site_login_sessions (
  auth_session_id uuid primary key,
  user_id uuid not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  first_ip_address inet,
  last_ip_address inet
);
create index if not exists site_login_sessions_user_idx
  on private.site_login_sessions(user_id, first_seen_at);
alter table private.site_login_sessions enable row level security;
revoke all on private.site_login_sessions from public, anon, authenticated;
alter table public.site_visits enable row level security;
revoke all on public.site_visits from public, anon, authenticated;

create or replace function public.log_site_visit_v3(
  p_visitor_id uuid,
  p_visit_key uuid,
  p_path text,
  p_ip_address inet,
  p_user_agent text,
  p_user_id uuid default null,
  p_auth_session_id uuid default null
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  saved_id bigint;
begin
  if p_visitor_id is null or p_visit_key is null then
    raise exception 'INVALID_VISITOR';
  end if;
  if (p_user_id is null) <> (p_auth_session_id is null) then
    raise exception 'INVALID_AUTH_SESSION';
  end if;
  if p_user_id is not null and not exists (
    select 1
    from auth.sessions s
    join auth.users u on u.id = s.user_id
    where s.id = p_auth_session_id and s.user_id = p_user_id
      and not coalesce(u.is_anonymous, false)
      and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)
      and (u.banned_until is null or u.banned_until <= now())
      and u.deleted_at is null
      and (s.not_after is null or s.not_after > now())
  ) then
    raise exception 'INVALID_AUTH_SESSION';
  end if;

  insert into public.site_visits(
    visitor_id, visit_key, path, ip_address, user_agent,
    user_id, auth_session_id, server_verified
  ) values (
    p_visitor_id, p_visit_key, left(coalesce(p_path, ''), 200),
    p_ip_address, left(coalesce(p_user_agent, ''), 500),
    p_user_id, p_auth_session_id, true
  )
  on conflict (visit_key) do update set
    user_id = coalesce(public.site_visits.user_id, excluded.user_id),
    auth_session_id = coalesce(public.site_visits.auth_session_id, excluded.auth_session_id),
    ip_address = coalesce(public.site_visits.ip_address, excluded.ip_address),
    user_agent = coalesce(public.site_visits.user_agent, excluded.user_agent),
    server_verified = true
  where public.site_visits.visitor_id = excluded.visitor_id
    and (public.site_visits.user_id is null or public.site_visits.user_id = excluded.user_id)
    and (public.site_visits.auth_session_id is null or public.site_visits.auth_session_id = excluded.auth_session_id)
  returning id into saved_id;

  -- A replay for a different browser/account must not create login evidence.
  if saved_id is null then
    raise exception 'VISIT_IDENTITY_CONFLICT';
  end if;
  if p_auth_session_id is not null then
    insert into private.site_login_sessions(
      auth_session_id, user_id, first_ip_address, last_ip_address
    ) values (p_auth_session_id, p_user_id, p_ip_address, p_ip_address)
    on conflict (auth_session_id) do update set
      last_seen_at = now(),
      last_ip_address = coalesce(excluded.last_ip_address, private.site_login_sessions.last_ip_address)
    where private.site_login_sessions.user_id = excluded.user_id;
  end if;
end;
$$;
revoke all on function public.log_site_visit_v3(uuid, uuid, text, inet, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.log_site_visit_v3(uuid, uuid, text, inet, text, uuid, uuid)
  to service_role;

-- Compatibility only: these requests have no trusted network/session evidence.
create or replace function public.log_site_visit_v2(
  p_visitor_id uuid, p_visit_key uuid, p_path text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_visitor_id is null or p_visit_key is null then raise exception 'INVALID_VISITOR'; end if;
  insert into public.site_visits(visitor_id, user_id, visit_key, path)
  values(p_visitor_id, auth.uid(), p_visit_key, left(coalesce(p_path, ''), 200))
  on conflict(visit_key) do update set user_id = coalesce(public.site_visits.user_id, excluded.user_id)
  where not public.site_visits.server_verified
    and public.site_visits.visitor_id = excluded.visitor_id
    and (public.site_visits.user_id is null or public.site_visits.user_id = excluded.user_id);
end;
$$;
revoke all on function public.log_site_visit_v2(uuid, uuid, text) from public;
grant execute on function public.log_site_visit_v2(uuid, uuid, text) to anon, authenticated;

create or replace function public.log_site_visit(p_visitor_id uuid, p_path text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.log_site_visit_v2(p_visitor_id, gen_random_uuid(), p_path);
end;
$$;
revoke all on function public.log_site_visit(uuid, text) from public;
grant execute on function public.log_site_visit(uuid, text) to anon, authenticated;

create or replace function public.get_site_visit_stats()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
  today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Ulaanbaatar') at time zone 'Asia/Ulaanbaatar';
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  with identities as (
    select id, created_at, ip_address, server_verified, auth_session_id,
      case when user_id is not null then 'account:' || user_id::text
        else 'browser:' || visitor_id::text end as identity
    from public.site_visits
  ), ranked as (
    select *, row_number() over(partition by identity order by created_at, id) as visit_number
    from identities
  ), logins as (
    select *, row_number() over(partition by user_id order by first_seen_at, auth_session_id) as login_number
    from private.site_login_sessions
  ), periods(label, since) as (
    values ('total', '-infinity'::timestamptz), ('today', today_start),
      ('last7days', now() - interval '7 days'), ('last30days', now() - interval '30 days')
  ), counts as (
    select p.label, count(r.id) as views, count(distinct r.identity) as visitors,
      count(r.id) filter(where r.visit_number = 1) as new_visitors,
      count(r.id) filter(where r.visit_number > 1) as repeat_visits,
      count(distinct r.ip_address) filter(where r.server_verified) as unique_ips,
      count(r.id) filter(where not r.server_verified or r.auth_session_id is null) as unverified_pageviews,
      (select count(*) from logins l where l.first_seen_at >= p.since) as verified_login_sessions,
      (select count(*) from logins l where l.first_seen_at >= p.since and l.login_number > 1) as repeat_logins
    from periods p left join ranked r on r.created_at >= p.since
    group by p.label, p.since
  )
  select jsonb_object_agg(key, value) into result
  from counts c cross join lateral (
    values (c.label || '_pageviews', c.views), (c.label || '_unique_visitors', c.visitors),
      (c.label || '_new_visitors', c.new_visitors), (c.label || '_repeat_visits', c.repeat_visits),
      (c.label || '_unique_ips', c.unique_ips),
      (c.label || '_verified_login_sessions', c.verified_login_sessions),
      (c.label || '_repeat_logins', c.repeat_logins),
      (c.label || '_unverified_pageviews', c.unverified_pageviews)
  ) fields(key, value);
  return result;
end;
$$;
revoke all on function public.get_site_visit_stats() from public, anon;
grant execute on function public.get_site_visit_stats() to authenticated;

create or replace function public.get_recent_site_visits(p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  select coalesce(jsonb_agg(to_jsonb(v) order by v.created_at desc, v.id desc), '[]'::jsonb)
  into result from (
    select id, created_at, path, visitor_id, user_id, host(ip_address) as ip_address,
      auth_session_id, server_verified,
      case when not server_verified then 'legacy'
        when auth_session_id is not null then 'verified' else 'guest' end as identity_status
    from public.site_visits
    order by created_at desc, id desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ) v;
  return result;
end;
$$;
revoke all on function public.get_recent_site_visits(integer) from public, anon;
grant execute on function public.get_recent_site_visits(integer) to authenticated;
commit;
