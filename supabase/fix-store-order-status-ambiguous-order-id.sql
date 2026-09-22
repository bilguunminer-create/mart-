-- Fixes two bugs in store_order_status (marking an order Дууссан/delivered):
--
-- 1) "column reference order_id is ambiguous" -- the function parameter was
--    named order_id, colliding with the loyalty_point_ledger.order_id column
--    referenced by `on conflict(order_id,event_type)`. Fixed by renaming the
--    parameters to p_order_id / p_next_status (matching the p_-prefixed
--    convention already used by every other RPC in this schema). PostgREST
--    matches RPC arguments by parameter name, and the client call in
--    src/services/supabaseAuth.ts (updateStoreOrderStatus) already sends
--    p_order_id / p_next_status.
--
-- 2) Bonus points were always earned at a hardcoded 1%, regardless of the
--    customer's loyalty tier or the admin-configured rate in
--    store_settings.data -- so editing "Онооны хувь" in the admin Loyalty
--    Rules screen, or any tier's own cashback_pct, had no real effect on
--    what customers actually earned. Fixed to look up the customer's tier
--    (respecting a manual admin override in loyalty_tier_overrides) by their
--    total delivered spend -- including this order, since its status is
--    already set to Дууссан earlier in this same function -- and use that
--    tier's own cashback_pct. Customers who haven't reached a tier yet earn
--    at the admin-configured base rate (loyalty_cashback_pct, default 1%).
--    If the admin hasn't saved custom tiers yet, falls back to the same
--    default thresholds/rates as LOYALTY_TIERS in src/data/storeData.ts.
--
-- Run this once in the Supabase SQL Editor. Postgres refuses to rename a
-- parameter via CREATE OR REPLACE (42P13) -- it must be dropped first, which
-- also drops its grants, so they are re-applied below in the same script.

drop function if exists public.store_order_status(uuid, text);

create or replace function public.store_order_status(p_order_id uuid, p_next_status text)
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
  tier_cfg jsonb;
  best_tier jsonb;
  forced_tier_id text;
  total_spent numeric;
  cashback_pct numeric;
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  if p_next_status not in ('Шинэ','Баталгаажсан','Хүргэлтэд','Дууссан','Цуцалсан') then raise exception 'INVALID_STATUS'; end if;

  select data into s from public.store_settings where id=true for update;
  select * into o from public.store_orders where id=p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status=p_next_status then return; end if;
  if o.status in ('Дууссан','Цуцалсан') then raise exception 'FINAL_STATUS'; end if;
  if p_next_status='Шинэ' then raise exception 'INVALID_TRANSITION'; end if;

  if p_next_status='Цуцалсан' and not o.is_demo then
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

  update public.store_orders set status=p_next_status,updated_at=now() where id=p_order_id;

  if p_next_status='Дууссан' and not o.is_demo then
    tier_cfg := s->'loyalty_tiers_config';
    if tier_cfg is null or jsonb_typeof(tier_cfg) <> 'array' or jsonb_array_length(tier_cfg) = 0 then
      tier_cfg := '[
        {"id":"bronze","threshold":500000,"cashback_pct":1},
        {"id":"silver","threshold":1000000,"cashback_pct":2},
        {"id":"gold","threshold":2000000,"cashback_pct":3}
      ]'::jsonb;
    end if;

    cashback_pct := coalesce((s->>'loyalty_cashback_pct')::numeric, 1);

    if o.customer_id is not null then
      forced_tier_id := s->'loyalty_tier_overrides'->>o.customer_id::text;

      if forced_tier_id is not null then
        select value into best_tier from jsonb_array_elements(tier_cfg) value where value->>'id' = forced_tier_id;
      end if;

      if best_tier is null then
        select coalesce(sum(total),0) into total_spent from public.store_orders where customer_id = o.customer_id and status = 'Дууссан';
        select value into best_tier
          from jsonb_array_elements(tier_cfg) value
          where (value->>'threshold')::numeric <= total_spent
          order by (value->>'threshold')::numeric desc
          limit 1;
      end if;

      if best_tier is not null and (best_tier->>'cashback_pct') is not null then
        cashback_pct := (best_tier->>'cashback_pct')::numeric;
      end if;
    end if;

    earned=floor(greatest(0,o.total-o.delivery_fee)*cashback_pct/100)::integer;
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

revoke all on function public.store_order_status(uuid, text) from public, anon;
grant execute on function public.store_order_status(uuid, text) to authenticated;

-- One-time backfill: the loyalty_tiers_config already saved in store_settings
-- predates the cashback_pct field, so give each existing tier the same
-- default as LOYALTY_TIERS in src/data/storeData.ts. Without this, the admin
-- Loyalty Rules screen would show a blank/zero cashback field for every tier
-- until someone opens and re-saves it by hand.
update public.store_settings
set data = jsonb_set(
  data,
  '{loyalty_tiers_config}',
  (
    select jsonb_agg(
      case
        when elem ? 'cashback_pct' then elem
        when elem->>'id' = 'bronze' then jsonb_set(elem, '{cashback_pct}', '1')
        when elem->>'id' = 'silver' then jsonb_set(elem, '{cashback_pct}', '2')
        when elem->>'id' = 'gold' then jsonb_set(elem, '{cashback_pct}', '3')
        else jsonb_set(elem, '{cashback_pct}', '0')
      end
    )
    from jsonb_array_elements(data->'loyalty_tiers_config') elem
  )
)
where id = true
  and jsonb_typeof(data->'loyalty_tiers_config') = 'array';
