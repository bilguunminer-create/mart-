-- Fixes three real bugs in the bonus points system:
--
-- 1. Points earned on delivery were under-counted whenever the customer paid
--    partly with points. o.total is already net of points_discount (computed
--    client-side in CheckoutModal as totalBeforePoints - pointsDiscount before
--    the order is ever saved), so subtracting o.points_discount again in the
--    earn formula double-counted the redemption and shorted the customer.
--
-- 2. The admin panel's "Бонус оноо олгох" (grant bonus points) button only
--    ever wrote to the admin's own browser localStorage -- it never touched
--    the real loyalty_wallets balance that checkout and the customer's own
--    profile actually read, so granted points were invisible to the customer
--    and vanished if the admin cleared their browser or used another device.
--
-- 3. The admin's "Гишүүд" (members) list could not show real point balances
--    at all -- there was no way for an admin session to read another user's
--    wallet, so it displayed the same fake localStorage number instead.
--
-- Run this once in the Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- 1. Corrected earn formula (remove the double subtraction of points_discount)
-- ---------------------------------------------------------------------------
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
    -- o.total is already net of points_discount, so only delivery_fee is excluded here.
    earned=floor(greatest(0,o.total-o.delivery_fee)*0.01)::integer;
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
-- One-time correction for orders already delivered under the buggy formula:
-- top up the shortfall for any order that redeemed points, instead of
-- re-awarding the full amount (which would double-pay orders that already
-- got the smaller, wrong amount). event_type only allows earned/redeemed/
-- reversed, and (order_id, event_type) is unique, so the existing 'earned'
-- row for that order is topped up in place rather than inserting a second one.
-- ---------------------------------------------------------------------------
do $$
declare
  rec record;
  correct_earned integer;
  existing_ledger_id uuid;
  already_earned integer;
  shortfall integer;
begin
  for rec in
    select so.* from public.store_orders so
    where so.status = 'Дууссан' and not so.is_demo and so.points_discount > 0
  loop
    correct_earned := floor(greatest(0, rec.total - rec.delivery_fee) * 0.01)::integer;
    select id, points into existing_ledger_id, already_earned
      from public.loyalty_point_ledger
      where order_id = rec.id and event_type = 'earned';
    if existing_ledger_id is not null then
      shortfall := correct_earned - already_earned;
      if shortfall > 0 then
        update public.loyalty_point_ledger set points = correct_earned where id = existing_ledger_id;
        update public.loyalty_wallets
          set available_points = available_points + shortfall,
              lifetime_earned = lifetime_earned + shortfall,
              updated_at = now()
          where user_id = rec.customer_id;
      end if;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2 & 3. Real admin tools: read every member's actual wallet, and grant
-- points that land in that same wallet instead of the admin's own browser.
-- event_type only allows earned/redeemed/reversed (confirmed against the
-- live constraint), so a grant is recorded as 'earned' with order_id null --
-- the unique (order_id, event_type) constraint does not block this, since
-- Postgres treats every null as distinct from every other null.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_loyalty_wallets()
 returns setof public.loyalty_wallets
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  return query select * from public.loyalty_wallets;
end;
$function$;

revoke all on function public.admin_list_loyalty_wallets() from public, anon;
grant execute on function public.admin_list_loyalty_wallets() to authenticated;

create or replace function public.admin_grant_loyalty_points(target_user_id uuid, amount integer)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  if amount = 0 then raise exception 'INVALID_AMOUNT'; end if;

  insert into public.loyalty_point_ledger(user_id, order_id, event_type, points)
  values (target_user_id, null, case when amount > 0 then 'earned' else 'reversed' end, amount);

  insert into public.loyalty_wallets(user_id, available_points, lifetime_earned)
  values (target_user_id, greatest(0, amount), greatest(0, amount))
  on conflict (user_id) do update
    set available_points = greatest(0, public.loyalty_wallets.available_points + amount),
        lifetime_earned = public.loyalty_wallets.lifetime_earned + greatest(0, amount),
        updated_at = now();
end;
$function$;

revoke all on function public.admin_grant_loyalty_points(uuid, integer) from public, anon;
grant execute on function public.admin_grant_loyalty_points(uuid, integer) to authenticated;
