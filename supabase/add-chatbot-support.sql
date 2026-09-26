-- Adds an AI assistant to the existing support chat while preserving human
-- takeover. Run once in the Supabase SQL Editor before deploying the frontend.

begin;

alter table public.support_messages
  drop constraint if exists support_messages_sender_check;
alter table public.support_messages
  add constraint support_messages_sender_check
  check (sender in ('customer', 'admin', 'bot'));

create table if not exists public.support_thread_state (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  bot_enabled boolean not null default true,
  needs_human boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.support_thread_state enable row level security;
revoke all on table public.support_thread_state from public, anon, authenticated;
grant select, insert, update on table public.support_thread_state to service_role;

-- Vercel's server-only service key writes AI replies through the Data API.
grant select, insert, update on table public.support_messages to service_role;
grant usage, select on sequence public.support_messages_id_seq to service_role;
grant select on table public.store_settings to service_role;

create or replace function public.get_my_support_status()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  state public.support_thread_state;
begin
  if uid is null then raise exception 'LOGIN_REQUIRED'; end if;
  insert into public.support_thread_state (customer_id)
  values (uid)
  on conflict (customer_id) do nothing;
  select * into state from public.support_thread_state where customer_id = uid;
  return jsonb_build_object(
    'bot_enabled', state.bot_enabled,
    'needs_human', state.needs_human
  );
end $$;
revoke all on function public.get_my_support_status() from public, anon;
grant execute on function public.get_my_support_status() to authenticated;

create or replace function public.admin_set_support_bot_state(p_customer_id uuid, p_bot_enabled boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  if p_customer_id is null then raise exception 'INVALID_CUSTOMER'; end if;
  insert into public.support_thread_state (customer_id, bot_enabled, needs_human, updated_at)
  values (p_customer_id, coalesce(p_bot_enabled, false), false, now())
  on conflict (customer_id) do update
    set bot_enabled = excluded.bot_enabled,
        needs_human = false,
        updated_at = now();
end $$;
revoke all on function public.admin_set_support_bot_state(uuid, boolean) from public, anon;
grant execute on function public.admin_set_support_bot_state(uuid, boolean) to authenticated;

-- A human reply takes ownership of the thread until the admin explicitly
-- re-enables the AI assistant.
create or replace function public.admin_send_support_message(p_customer_id uuid, p_message text)
returns void
language plpgsql security definer set search_path = '' as $$
declare msg text := btrim(coalesce(p_message, ''));
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  if p_customer_id is null then raise exception 'INVALID_CUSTOMER'; end if;
  if length(msg) = 0 or length(msg) > 2000 then raise exception 'INVALID_MESSAGE'; end if;
  insert into public.support_messages (customer_id, sender, message, read_by_admin, read_by_customer)
  values (p_customer_id, 'admin', msg, true, false);
  insert into public.support_thread_state (customer_id, bot_enabled, needs_human, updated_at)
  values (p_customer_id, false, false, now())
  on conflict (customer_id) do update
    set bot_enabled = false, needs_human = false, updated_at = now();
end $$;
revoke all on function public.admin_send_support_message(uuid, text) from public, anon;
grant execute on function public.admin_send_support_message(uuid, text) to authenticated;

create or replace function public.admin_list_support_threads()
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'customer_id', t.customer_id,
      'customer_name', coalesce(cp.name, ''),
      'customer_phone', coalesce(cp.phone, ''),
      'customer_email', u.email,
      'last_message', t.last_message,
      'last_sender', t.last_sender,
      'last_at', t.last_at,
      'unread_count', t.unread_count,
      'bot_enabled', coalesce(st.bot_enabled, true),
      'needs_human', coalesce(st.needs_human, false)
    ) order by t.last_at desc)
    from (
      select
        customer_id,
        (array_agg(message order by created_at desc))[1] as last_message,
        (array_agg(sender order by created_at desc))[1] as last_sender,
        max(created_at) as last_at,
        count(*) filter (where sender = 'customer' and not read_by_admin) as unread_count
      from public.support_messages
      group by customer_id
    ) t
    left join public.customer_profiles cp on cp.user_id = t.customer_id
    left join auth.users u on u.id = t.customer_id
    left join public.support_thread_state st on st.customer_id = t.customer_id
  ), '[]'::jsonb);
end $$;
revoke all on function public.admin_list_support_threads() from public, anon;
grant execute on function public.admin_list_support_threads() to authenticated;

commit;
