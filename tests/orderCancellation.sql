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

