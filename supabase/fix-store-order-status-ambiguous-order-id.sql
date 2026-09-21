-- Fixes "column reference order_id is ambiguous" when an admin changes an
-- order status to Дууссан (delivered).
--
-- Root cause: the function parameter was named order_id, which is also a
-- real column on loyalty_point_ledger. The earn-points block does
-- `insert into loyalty_point_ledger(...,order_id,...) ... on conflict(order_id,event_type)`
-- -- with a plpgsql parameter of the same name in scope, Postgres cannot
-- tell whether that bare order_id means the parameter or the table column,
-- so the whole statement is rejected as ambiguous. This is a regression
-- from fix-loyalty-points-system.sql, which kept the original parameter
-- name while adding that insert/on-conflict block.
--
-- Fix: rename the parameters to p_order_id / p_next_status (matching the
-- p_-prefixed convention already used by every other RPC in this schema),
-- so no identifier in the function body collides with a table column.
-- PostgREST matches RPC arguments by parameter name, so the client call
-- in src/services/supabaseAuth.ts (updateStoreOrderStatus) is updated to
-- match in the same commit as this file.
--
-- Run this once in the Supabase SQL Editor. CREATE OR REPLACE can rename
-- parameters without dropping the function first (only a type or return
-- change would require that), so existing grants on it are unaffected.

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
