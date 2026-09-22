-- Fixes bonus points not being earned on most real orders.
--
-- Root cause: store_order_status() only ever awarded points on the transition to
-- 'Баталгаажсан' (confirmed). The admin order-status control is a free dropdown that
-- lets an order jump straight from 'Шинэ' to 'Хүргэгдсэн' (delivered), skipping
-- 'Баталгаажсан' entirely (e.g. for cash-on-delivery orders) -- when that happens,
-- the earning code path never runs and the customer never gets their bonus.
--
-- Fix: earn points on the transition to 'Дууссан' (delivered) instead, so it fires
-- regardless of which path an order took to get there. This also removes the old
-- reverse-points-on-cancel branch: since a delivered order can never be cancelled
-- (blocked by the existing FINAL_STATUS check) and points are now only earned at
-- delivery, a cancelled order never had any points to reverse in the first place.
--
-- Run this once in the Supabase SQL Editor for the project used by this app. It
-- both replaces the function and backfills the points that were missed under the
-- old logic (safe to run more than once -- the backfill only touches orders that
-- don't already have an 'earned' ledger row).

create or replace function public.store_order_status(order_id uuid, next_status text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  o public.store_orders;
  s jsonb;
  i jsonb;
  p jsonb;
  idx integer;
  coll text;
  earned integer;
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  if next_status not in ('Шинэ','Баталгаажсан','Хүргэлтэд','Дууссан','Цуцалсан') then raise exception 'INVALID_STATUS'; end if;

  select data into s from public.store_settings where id=true for update;
  select * into o from public.store_orders where id=order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status=next_status then return; end if;
  if o.status in ('Дууссан','Цуцалсан') then raise exception 'FINAL_STATUS'; end if;
  if next_status='Шинэ' then raise exception 'INVALID_TRANSITION'; end if;

  if next_status='Цуцалсан' and not o.is_demo then
    for i in select * from jsonb_array_elements(o.items) loop
      coll='products';
      select value,ordinality::integer-1 into p,idx from jsonb_array_elements(s->coll) with ordinality where value->>'id'=i->>'productId';
      if p is null then
        coll='combos';
        select value,ordinality::integer-1 into p,idx from jsonb_array_elements(s->coll) with ordinality where value->>'id'=i->>'productId';
      end if;
      if p is not null then s=jsonb_set(s,array[coll,idx::text,'stock'],to_jsonb((p->>'stock')::integer+(i->>'quantity')::integer)); end if;
    end loop;
    update public.store_settings set data=s,version=version+1,updated_at=now() where id=true;
  end if;

  update public.store_orders set status=next_status,updated_at=now() where id=order_id;

  if next_status='Дууссан' and not o.is_demo then
    earned=floor(greatest(0,o.total-o.delivery_fee-o.points_discount)*0.01)::integer;
    if earned > 0 then
      insert into public.loyalty_point_ledger(user_id,order_id,event_type,points)
      values(o.customer_id,o.id,'earned',earned)
      on conflict(order_id,event_type) do nothing;
      if found then
        insert into public.loyalty_wallets(user_id,available_points,lifetime_earned)
        values(o.customer_id,earned,earned)
        on conflict(user_id) do update
          set available_points=public.loyalty_wallets.available_points+earned,
              lifetime_earned=public.loyalty_wallets.lifetime_earned+earned,
              updated_at=now();
      end if;
    end if;
  end if;
end;
$function$;

-- One-time backfill for orders that already reached Дууссан under the old logic
-- and never earned anything.
do $$
declare
  rec record;
  earned integer;
begin
  for rec in
    select so.* from public.store_orders so
    where so.status = 'Дууссан' and not so.is_demo
      and not exists (
        select 1 from public.loyalty_point_ledger l
        where l.order_id = so.id and l.event_type = 'earned'
      )
  loop
    earned := floor(greatest(0, rec.total - rec.delivery_fee - rec.points_discount) * 0.01)::integer;
    if earned > 0 then
      insert into public.loyalty_point_ledger(user_id, order_id, event_type, points)
      values (rec.customer_id, rec.id, 'earned', earned)
      on conflict (order_id, event_type) do nothing;
      if found then
        insert into public.loyalty_wallets(user_id, available_points, lifetime_earned)
        values (rec.customer_id, earned, earned)
        on conflict (user_id) do update
          set available_points = public.loyalty_wallets.available_points + earned,
              lifetime_earned = public.loyalty_wallets.lifetime_earned + earned,
              updated_at = now();
      end if;
    end if;
  end loop;
end $$;
