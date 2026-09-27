do $test$
declare u uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); r jsonb;
begin
 begin
 insert into auth.users(id,email,email_confirmed_at,is_anonymous) values(u,u::text||'@example.invalid',now(),false);
 insert into public.allowed_accounts(email) values(u::text||'@example.invalid');
 insert into public.store_orders(id,request_id,customer_id,customer_name,phone,address,items,subtotal,daily_discount,vip_discount,delivery_fee,total,is_demo,order_number,status,payment_status)
 values(o,gen_random_uuid(),u,'Payment regression','99000000','Fixture address','[]',1000,0,0,0,1000,true,-abs(('x'||substr(replace(o::text,'-',''),1,12))::bit(48)::bigint),'Шинэ','Төлөөгүй');
 perform set_config('request.jwt.claim.sub',u::text,true);
 r:=public.report_store_order_payment(o);
 assert r->>'payment_status'='Төлбөр шалгуулж байна','Initial report';
 perform public.confirm_store_order_payment(o);
 r:=public.report_store_order_payment(o);
 assert r->>'payment_status'='Төлбөр баталгаажсан','Confirmed payment regressed';
 update public.store_orders set status='Дууссан' where id=o;
 r:=public.report_store_order_payment(o);
 assert r->>'payment_status'='Төлбөр баталгаажсан' and r->>'status'='Дууссан','Delivered payment regressed';
 perform public.confirm_store_order_payment(o);
 update public.store_orders set payment_status='Төлөөгүй' where id=o;
 begin
 perform public.report_store_order_payment(o);
 raise exception 'REPORT_ALLOWED';
 exception when others then assert sqlerrm='FINAL_STATUS','Delivered report guard'; end;
 begin
 perform public.confirm_store_order_payment(o);
 raise exception 'CONFIRM_ALLOWED';
 exception when others then assert sqlerrm='FINAL_STATUS','Delivered confirm guard'; end;
 update public.store_orders set status='Цуцалсан' where id=o;
 begin
 perform public.report_store_order_payment(o);
 raise exception 'REPORT_ALLOWED';
 exception when others then assert sqlerrm='FINAL_STATUS','Cancelled report guard'; end;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin
 perform public.report_store_order_payment(o);
 raise exception 'FOREIGN_ALLOWED';
 exception when others then assert sqlerrm='ORDER_NOT_FOUND','Ownership guard'; end;
 raise exception using errcode='ZX002',message='ROLLBACK_FIXTURES';
 exception when sqlstate 'ZX002' then null;
 end;
 assert not exists(select 1 from auth.users where id=u),'Fixture rollback';
end;
$test$;
