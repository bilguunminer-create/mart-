-- Admin device tokens for new-order push notifications (Capacitor + Firebase Cloud
-- Messaging). Run this once in the Supabase SQL Editor for the project used by this app
-- (https://rebtikccivjcsxieeyxe.supabase.co). Requires the same `private.is_store_admin()`
-- helper already used by the rest of this schema.

create table if not exists public.admin_push_tokens (
  token text primary key,
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android',
  created_at timestamptz not null default now()
);

alter table public.admin_push_tokens enable row level security;
-- No table-level policies: all access goes through the security-definer functions below,
-- and the api/notify-new-order.ts serverless function, which reads this table with the
-- service-role key (server-side only, never exposed to the browser).

-- Called by the native admin/inventory app once it has this device's FCM token.
create or replace function public.register_admin_push_token(p_token text, p_platform text default 'android')
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_store_admin() then raise exception 'ADMIN_ONLY'; end if;
  if p_token is null or length(trim(p_token)) = 0 then raise exception 'INVALID_TOKEN'; end if;
  insert into public.admin_push_tokens (token, admin_user_id, platform)
  values (trim(p_token), auth.uid(), coalesce(p_platform, 'android'))
  on conflict (token) do update
    set admin_user_id = excluded.admin_user_id, platform = excluded.platform, created_at = now();
end $$;
revoke all on function public.register_admin_push_token(text, text) from public, anon;
grant execute on function public.register_admin_push_token(text, text) to authenticated;

-- Called on logout / uninstall so a stale device stops being pushed to. No admin check:
-- it only ever deletes the caller's own token, which is safe for any signed-in user.
create or replace function public.unregister_admin_push_token(p_token text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.admin_push_tokens where token = trim(p_token) and admin_user_id = auth.uid();
end $$;
revoke all on function public.unregister_admin_push_token(text) from public, anon;
grant execute on function public.unregister_admin_push_token(text) to authenticated;
