-- Two-way support chat between a signed-in customer and the store admin. One
-- ongoing thread per customer (not per-order) -- simplest model for a small
-- store's "contact us" style chat. Admin sees every thread in one inbox and
-- can reply to any of them; a customer only ever sees their own thread.
--
-- Run this once in the Supabase SQL Editor.

create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  customer_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('customer', 'admin')),
  message text not null,
  created_at timestamptz not null default now(),
  read_by_admin boolean not null default false,
  read_by_customer boolean not null default false
);

create index if not exists support_messages_customer_id_idx on public.support_messages (customer_id, created_at);

alter table public.support_messages enable row level security;
-- No table-level policies: every access goes through the functions below.

-- Customer sends a message to the store.
create or replace function public.send_support_message(p_message text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  msg text := btrim(coalesce(p_message, ''));
begin
  if uid is null then raise exception 'LOGIN_REQUIRED'; end if;
  if length(msg) = 0 or length(msg) > 2000 then raise exception 'INVALID_MESSAGE'; end if;
  insert into public.support_messages (customer_id, sender, message, read_by_admin, read_by_customer)
  values (uid, 'customer', msg, false, true);
end $$;
revoke all on function public.send_support_message(text) from public, anon;
grant execute on function public.send_support_message(text) to authenticated;

-- Customer reads their own thread; marks admin replies as read in the same call.
create or replace function public.get_my_support_messages()
returns setof public.support_messages
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'LOGIN_REQUIRED'; end if;
  update public.support_messages
    set read_by_customer = true
    where customer_id = uid and sender = 'admin' and read_by_customer = false;
  return query
    select * from public.support_messages where customer_id = uid order by created_at asc;
end $$;
revoke all on function public.get_my_support_messages() from public, anon;
grant execute on function public.get_my_support_messages() to authenticated;

-- Admin replies to a specific customer's thread.
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
end $$;
revoke all on function public.admin_send_support_message(uuid, text) from public, anon;
grant execute on function public.admin_send_support_message(uuid, text) to authenticated;

-- Admin reads one customer's full thread; marks customer messages as read in the same call.
create or replace function public.admin_get_support_thread(p_customer_id uuid)
returns setof public.support_messages
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  update public.support_messages
    set read_by_admin = true
    where customer_id = p_customer_id and sender = 'customer' and read_by_admin = false;
  return query
    select * from public.support_messages where customer_id = p_customer_id order by created_at asc;
end $$;
revoke all on function public.admin_get_support_thread(uuid) from public, anon;
grant execute on function public.admin_get_support_thread(uuid) to authenticated;

-- Admin inbox: every thread, newest activity first, with an unread-from-customer count.
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
      'unread_count', t.unread_count
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
  ), '[]'::jsonb);
end $$;
revoke all on function public.admin_list_support_threads() from public, anon;
grant execute on function public.admin_list_support_threads() to authenticated;
