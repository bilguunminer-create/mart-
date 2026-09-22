-- Fixes the loyalty cashback percentage being hardcoded at 1% regardless of tier.
--
-- Root cause: store_order_status() used a fixed multiplier *0.01 when awarding
-- earned points on delivery.  The admin can configure per-tier cashback rates
-- (stored as loyalty_tiers_config[].cashback_pct in store_settings.data) as
-- well as a global default rate (loyalty_cashback_pct).  Neither value was ever
-- read by the SQL function, so every customer -- regardless of whether they were
-- Bronze (2%), Silver (3%), Gold (5%), or had no tier at all -- always received
-- exactly 1 point per 100 ₮ spent.
--
-- Fix: the function now:
--   1. Reads loyalty_cashback_pct (global default, stored as a plain percentage
--      e.g. 1 for 1%) and loyalty_tiers_config (array of tier objects each with
--      threshold and cashback_pct) from store_settings.
--   2. Looks up the customer's lifetime_earned + existing wallet to determine
--      their tier by spending, then picks that tier's cashback_pct.
--   3. Falls back to the global default if no tier matches.
--   earned = floor(base_amount * cashback_pct / 100)
--
-- Run this once in the Supabase SQL Editor.

create or replace function public.store_order_status(order_id uuid, next_status text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  o            public.store_orders;
  s            jsonb;
  i            jsonb;
  p            jsonb;
  idx          integer;
  coll         text;
  earned       integer;
  base_amount  numeric;
  cashback_pct numeric;
  tier_rec     jsonb;
  customer_spent numeric;
  best_tier    jsonb;
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  if next_status not in ('Шинэ','Баталгаажсан','Хүргэлтэд','Дууссан','Цуцалсан') then raise exception 'INVALID_STATUS'; end if;

  select data into s from public.store_settings where id=true for update;
  select * into o from public.store_orders where id=order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status=next_status then return; end if;
  if o.status in ('Дууссан','Цуцалсан') then raise exception 'FINAL_STATUS'; end if;
  if next_status='Шинэ' then raise exception 'INVALID_TRANSITION'; end if;

  -- Restore stock on cancellation
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
    -- Base amount: order total already excludes points_discount; exclude delivery_fee too.
    base_amount := greatest(0, o.total - o.delivery_fee);

    -- -----------------------------------------------------------------------
    -- Determine cashback percentage for this customer.
    -- 1. Read the global default rate (stored as plain %, e.g. 1 means 1%).
    -- 2. Find the highest tier the customer qualifies for based on their total
    --    spending (lifetime_earned from their wallet is a good proxy; we fall
    --    back to summing delivered orders for them if no wallet row exists yet).
    -- 3. Use that tier's cashback_pct if it exists; otherwise the global default.
    -- -----------------------------------------------------------------------

    -- Global default (e.g. 1 → 1%)
    cashback_pct := coalesce((s->>'loyalty_cashback_pct')::numeric, 1);

    -- Customer's total spend from all delivered orders
    select coalesce(sum(so.total), 0)
      into customer_spent
      from public.store_orders so
      where so.customer_id = o.customer_id
        and so.status = 'Дууссан'
        and not so.is_demo;

    -- Walk through configured tiers (descending threshold) to find the best match
    best_tier := null;
    if s->'loyalty_tiers_config' is not null and jsonb_array_length(s->'loyalty_tiers_config') > 0 then
      for tier_rec in
        select value from jsonb_array_elements(s->'loyalty_tiers_config') as value
        order by (value->>'threshold')::numeric desc
      loop
        if customer_spent >= (tier_rec->>'threshold')::numeric then
          best_tier := tier_rec;
          exit;
        end if;
      end loop;
    end if;

    -- If a matching tier has its own cashback_pct, prefer it
    if best_tier is not null and best_tier->>'cashback_pct' is not null then
      cashback_pct := (best_tier->>'cashback_pct')::numeric;
    end if;

    -- Earn = floor(base * cashback_pct / 100)
    earned := floor(base_amount * cashback_pct / 100)::integer;

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

-- ---------------------------------------------------------------------------
-- One-time correction for orders already delivered under the wrong 1% formula.
-- For each delivered order, recalculate the correct earned amount using the
-- current tier config, and top up only the shortfall (never double-pays).
-- Safe to run more than once: already-correct rows are skipped.
-- ---------------------------------------------------------------------------
do $$
declare
  s            jsonb;
  rec          record;
  base_amount  numeric;
  cashback_pct numeric;
  tier_rec     jsonb;
  customer_spent numeric;
  best_tier    jsonb;
  correct_earned integer;
  existing_id  uuid;
  already_earned integer;
  shortfall    integer;
begin
  select data into s from public.store_settings where id=true;

  for rec in
    select so.* from public.store_orders so
    where so.status = 'Дууссан' and not so.is_demo
  loop
    base_amount  := greatest(0, rec.total - rec.delivery_fee);
    cashback_pct := coalesce((s->>'loyalty_cashback_pct')::numeric, 1);

    select coalesce(sum(so2.total), 0)
      into customer_spent
      from public.store_orders so2
      where so2.customer_id = rec.customer_id
        and so2.status = 'Дууссан'
        and not so2.is_demo;

    best_tier := null;
    if s->'loyalty_tiers_config' is not null and jsonb_array_length(s->'loyalty_tiers_config') > 0 then
      for tier_rec in
        select value from jsonb_array_elements(s->'loyalty_tiers_config') as value
        order by (value->>'threshold')::numeric desc
      loop
        if customer_spent >= (tier_rec->>'threshold')::numeric then
          best_tier := tier_rec;
          exit;
        end if;
      end loop;
    end if;

    if best_tier is not null and best_tier->>'cashback_pct' is not null then
      cashback_pct := (best_tier->>'cashback_pct')::numeric;
    end if;

    correct_earned := floor(base_amount * cashback_pct / 100)::integer;

    select id, points into existing_id, already_earned
      from public.loyalty_point_ledger
      where order_id = rec.id and event_type = 'earned';

    if existing_id is not null then
      shortfall := correct_earned - already_earned;
      if shortfall > 0 then
        update public.loyalty_point_ledger set points = correct_earned where id = existing_id;
        update public.loyalty_wallets
          set available_points = available_points + shortfall,
              lifetime_earned  = lifetime_earned  + shortfall,
              updated_at       = now()
          where user_id = rec.customer_id;
      end if;
    elsif correct_earned > 0 then
      -- Order never had an earned row at all (was 0 under old formula)
      insert into public.loyalty_point_ledger(user_id, order_id, event_type, points)
      values (rec.customer_id, rec.id, 'earned', correct_earned)
      on conflict (order_id, event_type) do nothing;
      if found then
        insert into public.loyalty_wallets(user_id, available_points, lifetime_earned)
        values (rec.customer_id, correct_earned, correct_earned)
        on conflict (user_id) do update
          set available_points = public.loyalty_wallets.available_points + correct_earned,
              lifetime_earned  = public.loyalty_wallets.lifetime_earned  + correct_earned,
              updated_at       = now();
      end if;
    end if;
  end loop;
end $$;
