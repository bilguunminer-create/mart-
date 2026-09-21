-- The product_reviews table that already exists in the live database has a
-- different shape than supabase/product-reviews.sql assumed: user_id (not
-- customer_id), and a boolean approved column (not a status text column).
-- That mismatch is why CREATE INDEX ... (product_id, status, ...) in that
-- file failed with "column status does not exist" -- and because that
-- failure aborted the rest of the script, submit_product_review and the
-- other RPCs were never actually created, hence "Could not find the
-- function ... in the schema cache" when a customer tried to comment.
--
-- This defines the RPCs against the real columns, and represents the same
-- three states the client already expects (pending / approved / rejected)
-- by letting approved be null (pending) as well as true/false, instead of
-- adding a new column. Every function ALIASES its output to the
-- customer_id / status / reviewed_at shape the client's ProductReview type
-- already expects, so no client code needs to change.
--
-- Run this once in the Supabase SQL Editor.

alter table public.product_reviews alter column approved drop not null;
alter table public.product_reviews alter column approved drop default;

create or replace function public.submit_product_review(p_product_id text, p_rating integer, p_comment text)
returns table (
  id uuid, product_id text, customer_id uuid, customer_name text, rating smallint,
  comment text, status text, created_at timestamptz, reviewed_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare uid uuid = auth.uid(); v_name text; v_comment text; existing_id uuid; new_id uuid;
begin
  if uid is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_product_id is null or length(trim(p_product_id)) = 0 then raise exception 'INVALID_PRODUCT'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'INVALID_RATING'; end if;
  v_comment = trim(coalesce(p_comment, ''));
  if length(v_comment) < 1 or length(v_comment) > 1000 then raise exception 'INVALID_COMMENT'; end if;

  select name into v_name from public.customer_profiles where user_id = uid;

  select r.id into existing_id from public.product_reviews r
    where r.product_id = trim(p_product_id) and r.user_id = uid;

  if existing_id is not null then
    update public.product_reviews
    set rating = p_rating, comment = v_comment, customer_name = coalesce(v_name, customer_name),
        approved = null, approved_at = null, approved_by = null, created_at = now()
    where product_reviews.id = existing_id;
    new_id = existing_id;
  else
    insert into public.product_reviews (product_id, user_id, customer_name, rating, comment, approved)
    values (trim(p_product_id), uid, coalesce(v_name, 'Хэрэглэгч'), p_rating, v_comment, null)
    returning product_reviews.id into new_id;
  end if;

  return query
    select r.id, r.product_id, r.user_id, r.customer_name, r.rating, r.comment,
      case when r.approved is true then 'approved' when r.approved is false then 'rejected' else 'pending' end,
      r.created_at, r.approved_at
    from public.product_reviews r where r.id = new_id;
end $$;
revoke all on function public.submit_product_review(text, integer, text) from public, anon;
grant execute on function public.submit_product_review(text, integer, text) to authenticated;

create or replace function public.read_my_product_review(p_product_id text)
returns table (
  id uuid, product_id text, customer_id uuid, customer_name text, rating smallint,
  comment text, status text, created_at timestamptz, reviewed_at timestamptz
)
language sql security definer set search_path = '' as $$
  select r.id, r.product_id, r.user_id, r.customer_name, r.rating, r.comment,
    case when r.approved is true then 'approved' when r.approved is false then 'rejected' else 'pending' end,
    r.created_at, r.approved_at
  from public.product_reviews r
  where r.product_id = trim(p_product_id) and r.user_id = auth.uid()
  limit 1;
$$;
revoke all on function public.read_my_product_review(text) from public, anon;
grant execute on function public.read_my_product_review(text) to authenticated;

create or replace function public.read_product_reviews(p_product_id text default null, p_limit integer default 50)
returns table (
  id uuid, product_id text, customer_id uuid, customer_name text, rating smallint,
  comment text, status text, created_at timestamptz, reviewed_at timestamptz
)
language sql security definer set search_path = '' as $$
  select r.id, r.product_id, r.user_id, r.customer_name, r.rating, r.comment,
    'approved',
    r.created_at, r.approved_at
  from public.product_reviews r
  where r.approved is true and (p_product_id is null or r.product_id = trim(p_product_id))
  order by r.created_at desc
  limit greatest(1, least(100, coalesce(p_limit, 50)));
$$;
grant execute on function public.read_product_reviews(text, integer) to authenticated, anon;

create or replace function public.read_all_reviews_admin()
returns table (
  id uuid, product_id text, customer_id uuid, customer_name text, rating smallint,
  comment text, status text, created_at timestamptz, reviewed_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_store_admin() then raise exception 'ADMIN_ONLY'; end if;
  return query
    select r.id, r.product_id, r.user_id, r.customer_name, r.rating, r.comment,
      case when r.approved is true then 'approved' when r.approved is false then 'rejected' else 'pending' end,
      r.created_at, r.approved_at
    from public.product_reviews r
    order by (r.approved is null) desc, r.created_at desc;
end $$;
revoke all on function public.read_all_reviews_admin() from public, anon;
grant execute on function public.read_all_reviews_admin() to authenticated;

create or replace function public.moderate_product_review(p_review_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_store_admin() then raise exception 'ADMIN_ONLY'; end if;
  update public.product_reviews
  set approved = p_approve, approved_at = now(), approved_by = auth.uid()
  where id = p_review_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;
revoke all on function public.moderate_product_review(uuid, boolean) from public, anon;
grant execute on function public.moderate_product_review(uuid, boolean) to authenticated;

create or replace function public.delete_product_review(p_review_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_store_admin() then raise exception 'ADMIN_ONLY'; end if;
  delete from public.product_reviews where id = p_review_id;
end $$;
revoke all on function public.delete_product_review(uuid) from public, anon;
grant execute on function public.delete_product_review(uuid) to authenticated;
