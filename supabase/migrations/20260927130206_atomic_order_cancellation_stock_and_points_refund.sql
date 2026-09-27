SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- Cancel through a single transaction. Existing cancelled orders are deliberately
-- not backfilled: their past stock-restoration history cannot be inferred safely.
alter table public.loyalty_point_ledger
  drop constraint loyalty_point_ledger_event_type_check;
alter table public.loyalty_point_ledger
  add constraint loyalty_point_ledger_event_type_check
  check (event_type in ('earned', 'redeemed', 'reversed', 'refunded'));

create or replace function private.cancel_store_order(p_order_id uuid, p_mode text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.store_orders;
  v_settings jsonb;
  v_item jsonb;
  v_product jsonb;
  v_index integer;
  v_collection text;
  v_quantity integer;
  v_stock integer;
  v_refund integer;
  v_minutes integer;
  v_expiry boolean := p_mode in ('customer_expiry', 'admin_expiry');
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_mode is null or p_mode not in ('customer', 'admin', 'customer_expiry', 'admin_expiry') then
    raise exception 'INVALID_CANCEL_MODE';
  end if;
  if p_mode in ('admin', 'admin_expiry') and not private.is_store_admin() then
    raise exception 'FORBIDDEN';
  end if;

  -- Same lock order as checkout and admin status changes: settings, order, wallet.
  -- Taking the shared settings lock first also serializes competing cancellations.
  select data into v_settings from public.store_settings where id=true for update;
  if not found then raise exception 'STORE_UNAVAILABLE'; end if;
  select * into v_order from public.store_orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_CANNOT_BE_CANCELLED'; end if;
  if p_mode in ('customer', 'customer_expiry') and v_order.customer_id<>v_uid then
    raise exception 'ORDER_CANNOT_BE_CANCELLED';
  end if;

  if v_order.status='Цуцалсан' then
    if v_expiry then return null; end if;
    return to_jsonb(v_order);
  end if;
  if v_order.status='Дууссан' then
    if v_expiry then return null; end if;
    raise exception 'FINAL_STATUS';
  end if;
  if p_mode<>'admin' and (v_order.status<>'Шинэ' or v_order.payment_status='Төлбөр баталгаажсан') then
    if v_expiry then return null; end if;
    raise exception 'ORDER_CANNOT_BE_CANCELLED';
  end if;
  if v_expiry then
    v_minutes := greatest(5,coalesce((v_settings->>'unpaid_cancellation_minutes')::integer,60));
    if v_order.created_at >= now()-make_interval(mins=>v_minutes) then return null; end if;
  end if;

  if not v_order.is_demo then
    if jsonb_typeof(v_order.items) is distinct from 'array' or jsonb_array_length(v_order.items)=0 then
      raise exception 'CANCEL_INVALID_ITEMS';
    end if;
    for v_item in select value from jsonb_array_elements(v_order.items) loop
      v_quantity := (v_item->>'quantity')::integer;
      if v_quantity is null or v_quantity<=0 then raise exception 'CANCEL_INVALID_ITEMS'; end if;
      v_collection := 'products';
      select value, ordinality::integer-1 into v_product,v_index
      from jsonb_array_elements(coalesce(v_settings->v_collection,'[]'::jsonb)) with ordinality
      where value->>'id'=v_item->>'productId';
      if v_product is null then
        v_collection := 'combos';
        select value, ordinality::integer-1 into v_product,v_index
        from jsonb_array_elements(coalesce(v_settings->v_collection,'[]'::jsonb)) with ordinality
        where value->>'id'=v_item->>'productId';
      end if;
      -- Do not silently cancel without restoring an item that was removed.
      if v_product is null then raise exception 'CANCEL_PRODUCT_MISSING'; end if;
      v_stock := coalesce((v_product->>'stock')::integer,(v_product->>'stock_quantity')::integer,0)+v_quantity;
      v_product := jsonb_set(v_product,'{stock}',to_jsonb(v_stock));
      if v_product ? 'stock_quantity' then
        v_product := jsonb_set(v_product,'{stock_quantity}',to_jsonb(v_stock));
      end if;
      v_product := jsonb_set(v_product,'{in_stock}',to_jsonb(v_stock>0));
      v_settings := jsonb_set(v_settings,array[v_collection,v_index::text],v_product);
    end loop;
    update public.store_settings
    set data=v_settings,version=version+1,updated_at=now() where id=true;
  end if;

  -- Refund only points actually debited in the ledger, including demo orders.
  -- The existing UNIQUE(order_id,event_type) constraint prevents duplicate refunds.
  select coalesce(-sum(l.points),0)::integer into v_refund
  from public.loyalty_point_ledger l
  where l.order_id=v_order.id and l.user_id=v_order.customer_id
    and l.event_type='redeemed' and l.points<0;
  if v_refund>0 then
    insert into public.loyalty_point_ledger(user_id,order_id,event_type,points)
    values(v_order.customer_id,v_order.id,'refunded',v_refund)
    on conflict(order_id,event_type) do nothing;
    if found then
      insert into public.loyalty_wallets(user_id,available_points,lifetime_earned)
      values(v_order.customer_id,v_refund,0)
      on conflict(user_id) do update
        set available_points=public.loyalty_wallets.available_points+excluded.available_points,
            updated_at=now();
    end if;
  end if;

  update public.store_orders set status='Цуцалсан',updated_at=now()
  where id=v_order.id returning * into v_order;
  return to_jsonb(v_order);
end;
$$;

-- Only the existing authenticated RPCs below may call this helper.
revoke all on function private.cancel_store_order(uuid,text) from public, anon, authenticated, service_role;

create or replace function public.cancel_my_store_order(order_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
  return private.cancel_store_order(order_id,'customer');
end;
$$;

create or replace function public.expire_my_unpaid_store_orders()
returns integer language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_count integer:=0; v_minutes integer;
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED'; end if;
  select greatest(5,coalesce((data->>'unpaid_cancellation_minutes')::integer,60))
    into v_minutes from public.store_settings where id=true;
  for v_id in select o.id from public.store_orders o
    where o.customer_id=v_uid and o.status='Шинэ' and o.payment_status<>'Төлбөр баталгаажсан'
      and o.created_at<now()-make_interval(mins=>v_minutes)
    order by o.id
  loop
    if private.cancel_store_order(v_id,'customer_expiry') is not null then v_count:=v_count+1; end if;
  end loop;
  return v_count;
end;
$$;

create or replace function public.admin_expire_unpaid_store_orders()
returns integer language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_count integer:=0; v_minutes integer;
begin
  if not private.is_store_admin() then raise exception 'ADMIN_ONLY'; end if;
  select greatest(5,coalesce((data->>'unpaid_cancellation_minutes')::integer,60))
    into v_minutes from public.store_settings where id=true;
  for v_id in select o.id from public.store_orders o
    where o.status='Шинэ' and o.payment_status<>'Төлбөр баталгаажсан'
      and o.created_at<now()-make_interval(mins=>v_minutes)
    order by o.id
  loop
    if private.cancel_store_order(v_id,'admin_expiry') is not null then v_count:=v_count+1; end if;
  end loop;
  return v_count;
end;
$$;

-- Preserve existing delivery/cashback behavior; route cancellation through the helper.
CREATE OR REPLACE FUNCTION public.store_order_status(p_order_id uuid, p_next_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if p_next_status='Цуцалсан' then
    perform private.cancel_store_order(p_order_id, 'admin');
    return;
  end if;

  select data into s from public.store_settings where id=true for update;
  select * into o from public.store_orders where id=p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status=p_next_status then return; end if;
  if o.status in ('Дууссан','Цуцалсан') then raise exception 'FINAL_STATUS'; end if;
  if p_next_status='Шинэ' then raise exception 'INVALID_TRANSITION'; end if;


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

-- Lock settings before the wallet to avoid checkout/cancellation deadlocks.
CREATE OR REPLACE FUNCTION public.store_checkout_with_points(payload jsonb, save_order boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid = auth.uid();
  requested integer = greatest(0, coalesce((payload->>'pointsToUse')::integer, 0));
  balance integer = 0;
  base_expected integer;
  usable integer;
  adjusted jsonb;
  preview jsonb;
  result jsonb;
  order_uuid uuid;
  order_total integer;
  configured_fee integer = 3000;
  applied_fee integer = 0;
  is_vehicle_pickup boolean = coalesce(payload->>'deliveryMode', '') = 'vehicle';
begin
  if uid is null then raise exception 'LOGIN_REQUIRED'; end if;
  select coalesce((data->>'delivery_fee')::integer, 3000)
    into configured_fee from public.store_settings where id=true for update;
  select coalesce((select available_points from public.loyalty_wallets where user_id=uid for update), 0) into balance;

  base_expected = coalesce((payload->>'expectedTotal')::integer, 0) + requested
    + case when is_vehicle_pickup then configured_fee else 0 end;
  adjusted = (payload - 'pointsToUse') || jsonb_build_object('expectedTotal', base_expected);

  -- Price, promotion and delivery calculations always come from the central catalog.
  -- The preview makes the final write use that exact authoritative amount.
  if save_order then
    preview = public.store_checkout(adjusted, false);
    adjusted = jsonb_set(adjusted, '{expectedTotal}', to_jsonb(coalesce((preview->>'total')::integer, 0)));
  end if;

  result = public.store_checkout(adjusted, save_order);
  if not save_order then return result; end if;

  order_uuid = (result->>'id')::uuid;
  applied_fee = coalesce((result->>'delivery_fee')::integer, 0);
  if is_vehicle_pickup and applied_fee > 0 then
    update public.store_orders
      set delivery_fee=0, total=total-applied_fee, updated_at=now()
      where id=order_uuid;
  end if;

  select total into order_total from public.store_orders where id=order_uuid for update;
  usable = least(requested, balance, greatest(0, order_total));
  if requested <> usable then raise exception 'POINTS_CHANGED'; end if;

  if usable > 0 then
    insert into public.loyalty_point_ledger(user_id,order_id,event_type,points)
    values(uid,order_uuid,'redeemed',-usable);
    insert into public.loyalty_wallets(user_id,available_points,lifetime_earned)
    values(uid,0,0)
    on conflict(user_id) do update
      set available_points=public.loyalty_wallets.available_points-usable,updated_at=now();
    update public.store_orders
    set points_discount=usable,total=total-usable,updated_at=now()
    where id=order_uuid;
  end if;
  return (select to_jsonb(o) from public.store_orders o where o.id=order_uuid);
end;
$function$;


revoke all on function public.cancel_my_store_order(uuid) from public,anon;
revoke all on function public.expire_my_unpaid_store_orders() from public,anon;
revoke all on function public.admin_expire_unpaid_store_orders() from public,anon;
revoke all on function public.store_order_status(uuid,text) from public,anon;
grant execute on function public.cancel_my_store_order(uuid) to authenticated,service_role;
grant execute on function public.expire_my_unpaid_store_orders() to authenticated,service_role;
grant execute on function public.admin_expire_unpaid_store_orders() to authenticated,service_role;
grant execute on function public.store_order_status(uuid,text) to authenticated,service_role;



-- Integration assertions run inside a subtransaction that always rolls back.
-- Random fixture IDs and explicit negative order numbers avoid real users/orders
-- and do not consume the production order-number sequence.
do $tests$
declare
  u1 uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid();
  admin_email text; product_id text:='cancel-test-'||gen_random_uuid()::text;
  combo_id text:='cancel-combo-'||gen_random_uuid()::text;
  ids uuid[]:='{}'; result jsonb; i integer; owner_id uuid; expected_stock integer:=10;
  before_balance integer; before_version bigint; current_balance integer; fixture_number bigint;
  active_count integer; expiry_count integer; test_count integer:=0;
begin
  begin
    admin_email:=admin_id::text||'@example.invalid';
    insert into auth.users(id,email,email_confirmed_at,is_anonymous)
    values(u1,u1::text||'@example.invalid',now(),false),
          (u2,u2::text||'@example.invalid',now(),false),
          (admin_id,admin_email,now(),false);
    insert into public.allowed_accounts(email) values(admin_email);
    insert into public.loyalty_wallets(user_id,available_points,lifetime_earned) values(u1,1000,2000);
    update public.store_settings set data=data||jsonb_build_object(
      'products',jsonb_build_array(jsonb_build_object('id',product_id,'name','Cancellation fixture','stock',10,'stock_quantity',10,'in_stock',false,'published',false)),
      'combos',jsonb_build_array(jsonb_build_object('id',combo_id,'stock',2,'in_stock',true)),
      'unpaid_cancellation_minutes',60,'loyalty_cashback_pct',1,'loyalty_tiers_config','[]'::jsonb
    ) where id=true;
    fixture_number:=-abs(('x'||substr(replace(u1::text,'-',''),1,12))::bit(48)::bigint);
    for i in 1..15 loop
      ids:=array_append(ids,gen_random_uuid());
      owner_id:=case when i in (6,10) then u2 else u1 end;
      insert into public.store_orders(id,request_id,customer_id,customer_name,phone,address,items,
        subtotal,daily_discount,vip_discount,delivery_fee,total,is_demo,points_discount,order_number,status,payment_status,created_at)
      values(ids[i],gen_random_uuid(),owner_id,'Cancellation fixture','99000000','Test fixture address',
        jsonb_build_array(jsonb_build_object('productId',case when i=11 then 'missing-'||product_id when i=15 then combo_id else product_id end,
          'quantity',case when i=1 then 2 when i=2 then 3 else 1 end,'price',1000)),
        1000,0,0,0,1000,i=5,case when i=13 then 500 else 100 end,fixture_number-i,
        case when i=2 then 'Баталгаажсан' when i=3 then 'Дууссан' else 'Шинэ' end,
        case when i in (4,9) then 'Төлбөр баталгаажсан' else 'Төлөөгүй' end,
        case when i=10 then now()-interval '1000 years' when i in (7,9) then now()-interval '2 hours' else now() end);
      if i not in (3,6,13,14,15) then
        insert into public.loyalty_point_ledger(user_id,order_id,event_type,points) values(owner_id,ids[i],'redeemed',-100);
      end if;
    end loop;
    update public.store_orders set items=items||jsonb_build_array(jsonb_build_object('productId','missing-'||product_id,'quantity',1,'price',1000))
      where id=ids[12];

    assert not has_function_privilege('authenticated','private.cancel_store_order(uuid,text)','EXECUTE'), 'Private helper exposed';
    assert not has_function_privilege('anon','public.cancel_my_store_order(uuid)','EXECUTE'), 'Anonymous cancellation exposed';
    test_count:=test_count+1;

    perform set_config('request.jwt.claim.sub',u1::text,true);
    result:=public.cancel_my_store_order(ids[1]);
    expected_stock:=12;
    assert result->>'status'='Цуцалсан','Customer cancellation status';
    assert (select (data->'products'->0->>'stock')::integer=expected_stock and (data->'products'->0->>'stock_quantity')::integer=expected_stock
      and (data->'products'->0->>'in_stock')::boolean and not (data->'products'->0->>'published')::boolean
      from public.store_settings where id=true),'Stock/availability/visibility restoration';
    assert (select available_points=1100 and lifetime_earned=2000 from public.loyalty_wallets where user_id=u1),'Customer points refund';
    test_count:=test_count+1;

    select version into before_version from public.store_settings where id=true;
    perform public.cancel_my_store_order(ids[1]);
    assert (select version=before_version from public.store_settings where id=true),'Repeat changed stock/version';
    assert (select available_points=1100 from public.loyalty_wallets where user_id=u1),'Repeat doubled refund';
    assert (select count(*)=1 from public.loyalty_point_ledger where order_id=ids[1] and event_type='refunded'),'Duplicate refund ledger';
    test_count:=test_count+1;

    begin
      perform public.cancel_my_store_order(ids[6]);
      raise exception 'OTHER_CUSTOMER_ALLOWED';
    exception when others then assert sqlerrm='ORDER_CANNOT_BE_CANCELLED','Ownership check failed'; end;
    test_count:=test_count+1;

    begin
      perform public.cancel_my_store_order(ids[4]);
      raise exception 'PAID_CUSTOMER_CANCEL_ALLOWED';
    exception when others then assert sqlerrm='ORDER_CANNOT_BE_CANCELLED','Paid cancellation guard'; end;
    begin
      perform public.cancel_my_store_order(ids[3]);
      raise exception 'DELIVERED_CANCEL_ALLOWED';
    exception when others then assert sqlerrm='FINAL_STATUS','Delivered cancellation guard'; end;
    test_count:=test_count+2;

    begin
      perform public.store_order_status(ids[2],'Цуцалсан');
      raise exception 'NON_ADMIN_ALLOWED';
    exception when others then assert sqlerrm='FORBIDDEN','Admin authorization guard'; end;
    test_count:=test_count+1;

    perform set_config('request.jwt.claim.sub',admin_id::text,true);
    perform public.store_order_status(ids[2],'Цуцалсан');
    expected_stock:=expected_stock+3;
    assert (select (data->'products'->0->>'stock')::integer=expected_stock from public.store_settings where id=true),'Admin stock restoration';
    assert (select available_points=1200 and lifetime_earned=2000 from public.loyalty_wallets where user_id=u1),'Admin points refund';
    perform public.store_order_status(ids[2],'Цуцалсан');
    assert (select available_points=1200 from public.loyalty_wallets where user_id=u1),'Admin repeat refund';
    test_count:=test_count+2;

    perform public.store_order_status(ids[4],'Цуцалсан');
    expected_stock:=expected_stock+1;
    assert (select status='Цуцалсан' from public.store_orders where id=ids[4]),'Admin paid cancellation';
    assert (select available_points=1300 from public.loyalty_wallets where user_id=u1),'Admin paid points refund';
    test_count:=test_count+1;

    perform set_config('request.jwt.claim.sub',u1::text,true);
    select version into before_version from public.store_settings where id=true;
    perform public.cancel_my_store_order(ids[5]);
    assert (select version=before_version and (data->'products'->0->>'stock')::integer=expected_stock from public.store_settings where id=true),'Demo changed stock';
    assert (select available_points=1400 from public.loyalty_wallets where user_id=u1),'Demo actual redemption not refunded';
    test_count:=test_count+1;

    expiry_count:=public.expire_my_unpaid_store_orders();
    expected_stock:=expected_stock+1;
    assert expiry_count=1,'Customer expiry count';
    assert (select status='Цуцалсан' from public.store_orders where id=ids[7]),'Expired new Mongolian status';
    assert (select status='Шинэ' from public.store_orders where id=ids[8]),'Recent order expired';
    assert (select status='Шинэ' from public.store_orders where id=ids[9]),'Paid order expired';
    assert (select status='Шинэ' from public.store_orders where id=ids[10]),'Other customer expired';
    assert (select available_points=1500 from public.loyalty_wallets where user_id=u1),'Expiry points refund';
    assert public.expire_my_unpaid_store_orders()=0,'Repeated expiry count';
    test_count:=test_count+2;

    -- Make admin-expiry eligible only for our thousand-year-old fixture.
    update public.store_settings set data=jsonb_set(data,'{unpaid_cancellation_minutes}','100000000') where id=true;
    select count(*) into active_count from public.store_orders
      where status='Шинэ' and payment_status<>'Төлбөр баталгаажсан'
      and created_at<now()-make_interval(mins=>100000000);
    assert active_count=1,'Admin-expiry fixture isolation failed';
    perform set_config('request.jwt.claim.sub',admin_id::text,true);
    assert public.admin_expire_unpaid_store_orders()=1,'Admin expiry count';
    expected_stock:=expected_stock+1;
    assert (select available_points=100 and lifetime_earned=0 from public.loyalty_wallets where user_id=u2),'Missing wallet refund';
    assert public.admin_expire_unpaid_store_orders()=0,'Admin expiry repeated';
    test_count:=test_count+2;

    perform set_config('request.jwt.claim.sub',u1::text,true);
    select version into before_version from public.store_settings where id=true;
    for i in 11..12 loop
      begin
        perform public.cancel_my_store_order(ids[i]);
        raise exception 'MISSING_PRODUCT_ALLOWED';
      exception when others then assert sqlerrm='CANCEL_PRODUCT_MISSING','Missing product error'; end;
      assert (select status='Шинэ' from public.store_orders where id=ids[i]),'Failure partially cancelled order';
      assert not exists(select 1 from public.loyalty_point_ledger where order_id=ids[i] and event_type='refunded'),'Failure refunded points';
    end loop;
    assert (select version=before_version and (data->'products'->0->>'stock')::integer=expected_stock from public.store_settings where id=true),'Failure partially restored stock';
    assert (select available_points=1500 from public.loyalty_wallets where user_id=u1),'Failure changed wallet';
    test_count:=test_count+2;

    perform public.cancel_my_store_order(ids[13]);
    expected_stock:=expected_stock+1;
    assert (select available_points=1500 from public.loyalty_wallets where user_id=u1),'Refund invented from points_discount without redemption';
    test_count:=test_count+1;

    perform public.cancel_my_store_order(ids[15]);
    assert (select (data->'combos'->0->>'stock')::integer=3 from public.store_settings where id=true),'Combo restoration';
    test_count:=test_count+1;

    perform set_config('request.jwt.claim.sub',admin_id::text,true);
    perform public.store_order_status(ids[14],'Дууссан');
    assert (select available_points=1510 and lifetime_earned=2010 from public.loyalty_wallets where user_id=u1),'Delivery cashback regression';
    begin
      perform public.store_order_status(ids[14],'Цуцалсан');
      raise exception 'ADMIN_DELIVERED_CANCEL_ALLOWED';
    exception when others then assert sqlerrm='FINAL_STATUS','Admin final status guard'; end;
    test_count:=test_count+2;

    perform set_config('request.jwt.claim.sub','',true);
    begin
      perform public.cancel_my_store_order(ids[8]);
      raise exception 'ANONYMOUS_CANCEL_ALLOWED';
    exception when others then assert sqlerrm='LOGIN_REQUIRED','Anonymous identity guard'; end;
    test_count:=test_count+1;

    assert (select (data->'products'->0->>'stock')::integer=expected_stock from public.store_settings where id=true),'Final stock mismatch';
    raise notice '% cancellation regression scenarios passed; rolling back all fixtures',test_count;
    raise exception using errcode='ZX001',message='ROLLBACK_CANCELLATION_FIXTURES';
  exception when sqlstate 'ZX001' then
    null;
  end;
  assert not exists(select 1 from auth.users where id in (u1,u2,admin_id)),'Fixture users survived rollback';
  assert not exists(select 1 from public.store_orders where id=any(ids)),'Fixture orders survived rollback';
end;
$tests$;
