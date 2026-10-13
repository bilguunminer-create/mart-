-- Access log, shown in the admin Статистик tab ("хэн, хэзээ орсон").
-- One row per storefront page load (anonymous visitors included), plus one
-- row per customer login/signup and per admin PIN login.
--
-- Who a row belongs to is decided server-side from the caller's JWT
-- (auth.uid()), never from the request body, so a visitor cannot log events
-- under someone else's account. Each browser is identified by the same random
-- visitor_id already used for site_visits, so an anonymous device's visits can
-- be tied to the account it later logs in with. No IP address is stored.
--
-- Anyone can INSERT through log_access(); nobody can read raw rows except a
-- signed-in store admin through get_access_log(). Visits are also still
-- written to site_visits so the existing visitor counters keep working.
--
-- Run this once in the Supabase SQL Editor (project rebtikccivjcsxieeyxe),
-- after add-site-visit-tracking.sql.

create table if not exists public.access_log (
  id bigint generated always as identity primary key,
  event text not null check (event in ('visit', 'login', 'signup', 'admin_login')),
  visitor_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  path text,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now()
);

create index if not exists access_log_created_at_idx on public.access_log (created_at desc);
create index if not exists access_log_user_id_idx on public.access_log (user_id);

alter table public.access_log enable row level security;
-- No table-level policies: every access goes through the two functions below.

create or replace function public.log_access(
  p_event text,
  p_visitor_id uuid,
  p_path text default null,
  p_user_agent text default null,
  p_referrer text default null
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_email text;
begin
  if p_visitor_id is null then raise exception 'INVALID_VISITOR'; end if;
  if p_event is null or p_event not in ('visit', 'login', 'signup', 'admin_login') then
    raise exception 'INVALID_EVENT';
  end if;
  if p_event <> 'visit' and uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_event = 'admin_login' and not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;

  if uid is not null then
    select u.email into v_email from auth.users u where u.id = uid;
  end if;

  insert into public.access_log (event, visitor_id, user_id, email, path, user_agent, referrer)
  values (
    p_event, p_visitor_id, uid, v_email,
    left(coalesce(p_path, ''), 200),
    left(coalesce(p_user_agent, ''), 300),
    left(coalesce(p_referrer, ''), 300)
  );

  if p_event = 'visit' then
    insert into public.site_visits (visitor_id, path)
    values (p_visitor_id, left(coalesce(p_path, ''), 200));
  end if;
end $$;
revoke all on function public.log_access(text, uuid, text, text, text) from public;
grant execute on function public.log_access(text, uuid, text, text, text) to anon, authenticated;

create or replace function public.get_access_log(p_limit int default 300)
returns table (
  id bigint, event text, visitor_id uuid, user_id uuid, email text, name text,
  path text, user_agent text, referrer text, created_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  return query
    select l.id, l.event, l.visitor_id, l.user_id, l.email, cp.name::text,
           l.path, l.user_agent, l.referrer, l.created_at
    from public.access_log l
    left join public.customer_profiles cp on cp.user_id = l.user_id
    order by l.created_at desc
    limit least(greatest(coalesce(p_limit, 300), 1), 1000);
end $$;
revoke all on function public.get_access_log(int) from public, anon;
grant execute on function public.get_access_log(int) to authenticated;
