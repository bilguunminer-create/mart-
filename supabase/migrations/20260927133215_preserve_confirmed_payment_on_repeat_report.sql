set local lock_timeout='5s';
create or replace function public.report_store_order_payment(order_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); current_order public.store_orders;
begin
 if uid is null then raise exception 'LOGIN_REQUIRED'; end if;
 select * into current_order from public.store_orders where id=order_id and customer_id=uid for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if current_order.status='Цуцалсан' then raise exception 'FINAL_STATUS'; end if;
 if current_order.payment_status='Төлбөр баталгаажсан' then return to_jsonb(current_order); end if;
 if current_order.status='Дууссан' then raise exception 'FINAL_STATUS'; end if;
 update public.store_orders set payment_status='Төлбөр шалгуулж байна',payment_reported_at=now(),updated_at=now()
 where id=current_order.id returning * into current_order;
 return to_jsonb(current_order);
end;
$$;
create or replace function public.confirm_store_order_payment(order_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare current_order public.store_orders;
begin
 if not private.is_store_admin() then raise exception 'ADMIN_ONLY'; end if;
 select * into current_order from public.store_orders where id=order_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if current_order.payment_status='Төлбөр баталгаажсан' then return; end if;
 if current_order.status in ('Дууссан','Цуцалсан') then raise exception 'FINAL_STATUS'; end if;
 update public.store_orders set payment_status='Төлбөр баталгаажсан',updated_at=now() where id=current_order.id;
end;
$$;
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
