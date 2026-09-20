-- Product reviews & ratings, with admin moderation before anything goes public.
-- Run this once in the Supabase SQL Editor for the project used by this app
-- (https://rebtikccivjcsxieeyxe.supabase.co). Requires the same `private.is_store_admin()`
-- helper already used by the rest of this schema (admin_inventory_*, store_order_status, etc.).

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  customer_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (product_id, customer_id)
);

create index if not exists product_reviews_product_status_idx
  on public.product_reviews (product_id, status, created_at desc);

alter table public.product_reviews enable row level security;
-- No table-level policies: all access goes through the security-definer functions below,
-- which is the pattern already used for orders, inventory, and store settings in this project.

-- A signed-in customer submits or edits their own review for a product; it always
-- re-enters moderation (status resets to 'pending') so an edited review is re-checked.
create or replace function public.submit_product_review(p_product_id text, p_rating integer, p_comment text)
returns public.product_reviews
language plpgsql security definer set search_path = '' as $$
declare uid uuid = auth.uid(); v_name text; v_comment text; result public.product_reviews;
begin
  if uid is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_product_id is null or length(trim(p_product_id)) = 0 then raise exception 'INVALID_PRODUCT'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'INVALID_RATING'; end if;
  v_comment = trim(coalesce(p_comment, ''));
  if length(v_comment) < 1 or length(v_comment) > 1000 then raise exception 'INVALID_COMMENT'; end if;

  select name into v_name from public.customer_profiles where user_id = uid;

  insert into public.product_reviews (product_id, customer_id, customer_name, rating, comment, status)
  values (trim(p_product_id), uid, coalesce(v_name, 'Хэрэглэгч'), p_rating, v_comment, 'pending')
  on conflict (product_id, customer_id) do update
    set rating = excluded.rating, comment = excluded.comment, customer_name = excluded.customer_name,
        status = 'pending', reviewed_at = null, created_at = now()
  returning * into result;
  return result;
end $$;
revoke all on function public.submit_product_review(text, integer, text) from public, anon;
grant execute on function public.submit_product_review(text, integer, text) to authenticated;

-- A signed-in customer reads back their own review for a product (any status), to show
-- "your review is pending" instead of a blank form after they already submitted one.
create or replace function public.read_my_product_review(p_product_id text)
returns public.product_reviews
language sql security definer set search_path = '' as $$
  select * from public.product_reviews
  where product_id = trim(p_product_id) and customer_id = auth.uid()
  limit 1;
$$;
revoke all on function public.read_my_product_review(text) from public, anon;
grant execute on function public.read_my_product_review(text) to authenticated;

-- Public read of approved reviews. Pass p_product_id for one product's reviews, or null
-- for the site-wide feed (used by the homepage testimonial ticker).
create or replace function public.read_product_reviews(p_product_id text default null, p_limit integer default 50)
returns setof public.product_reviews
language sql security definer set search_path = '' as $$
  select * from public.product_reviews
  where status = 'approved' and (p_product_id is null or product_id = trim(p_product_id))
  order by created_at desc
  limit greatest(1, least(100, coalesce(p_limit, 50)));
$$;
grant execute on function public.read_product_reviews(text, integer) to authenticated, anon;

-- Admin-only: every review regardless of status, for the moderation queue.
create or replace function public.read_all_reviews_admin()
returns setof public.product_reviews
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_store_admin() then raise exception 'ADMIN_ONLY'; end if;
  return query select * from public.product_reviews order by (status = 'pending') desc, created_at desc;
end $$;
revoke all on function public.read_all_reviews_admin() from public, anon;
grant execute on function public.read_all_reviews_admin() to authenticated;

-- Admin-only: approve or reject a pending (or previously moderated) review.
create or replace function public.moderate_product_review(p_review_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_store_admin() then raise exception 'ADMIN_ONLY'; end if;
  update public.product_reviews
  set status = case when p_approve then 'approved' else 'rejected' end, reviewed_at = now()
  where id = p_review_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;
revoke all on function public.moderate_product_review(uuid, boolean) from public, anon;
grant execute on function public.moderate_product_review(uuid, boolean) to authenticated;

-- Admin-only: remove a review entirely (e.g. spam or abuse), separate from a simple rejection.
create or replace function public.delete_product_review(p_review_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_store_admin() then raise exception 'ADMIN_ONLY'; end if;
  delete from public.product_reviews where id = p_review_id;
end $$;
revoke all on function public.delete_product_review(uuid) from public, anon;
grant execute on function public.delete_product_review(uuid) to authenticated;
