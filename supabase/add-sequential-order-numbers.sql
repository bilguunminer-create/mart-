-- Adds a unified, sequential, human-friendly order number (displayed client-side
-- as US000001, US000002, ...) alongside the existing UUID primary key, which stays
-- untouched for all internal references/foreign keys.
--
-- read_store_orders() returns SETOF store_orders via `select *`, so this new column
-- appears in its output automatically -- no change needed to that function. New
-- orders get their number automatically from the column default below, regardless
-- of what store_checkout_with_points's INSERT statement lists explicitly.
--
-- Run this once in the Supabase SQL Editor for the project used by this app.

create sequence if not exists public.store_order_number_seq;

alter table public.store_orders
  add column if not exists order_number bigint;

-- Backfill existing orders in creation order, oldest first, so order #1 really is
-- the store's first ever order. Uses row_number() directly (not nextval() inside
-- the UPDATE) so the assigned numbers are guaranteed to follow created_at order
-- regardless of the query plan's scan order.
with numbered as (
  select id, row_number() over (order by created_at asc) as rn
  from public.store_orders
  where order_number is null
)
update public.store_orders o
set order_number = n.rn
from numbered n
where o.id = n.id;

-- Point the sequence past the highest backfilled number, so the next new order
-- continues the count seamlessly instead of colliding with backfilled values.
select setval('public.store_order_number_seq', coalesce((select max(order_number) from public.store_orders), 0), true);

alter table public.store_orders
  alter column order_number set default nextval('public.store_order_number_seq');

alter sequence public.store_order_number_seq owned by public.store_orders.order_number;

alter table public.store_orders
  alter column order_number set not null;

alter table public.store_orders
  add constraint store_orders_order_number_key unique (order_number);
