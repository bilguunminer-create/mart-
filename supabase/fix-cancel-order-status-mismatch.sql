-- Fixes customer order cancellation always failing with ORDER_CANNOT_BE_CANCELLED.
--
-- Root cause: store_order_status() only ever stores the Mongolian status labels
-- ('Шинэ', 'Баталгаажсан', 'Хүргэлтэд', 'Дууссан', 'Цуцалсан') into store_orders.status
-- (enforced by its own next_status check). But cancel_my_store_order() was checking
-- status = 'new' (English) instead of status = 'Шинэ' -- a value that never actually
-- occurs in the column -- so the UPDATE always matched zero rows and the function
-- always raised ORDER_CANNOT_BE_CANCELLED, for every customer, on every order.
--
-- Run this once in the Supabase SQL Editor for the project used by this app.

create or replace function public.cancel_my_store_order(order_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare uid uuid=auth.uid(); affected integer;
begin
 if uid is null then raise exception 'LOGIN_REQUIRED'; end if;
 update public.store_orders
 set status='Цуцалсан', updated_at=now()
 where id=order_id and customer_id=uid and status='Шинэ'
   and coalesce(payment_status,'') <> 'Төлбөр баталгаажсан';
 get diagnostics affected = row_count;
 if affected=0 then raise exception 'ORDER_CANNOT_BE_CANCELLED'; end if;
 return (select to_jsonb(o) from public.store_orders o where o.id=order_id);
end; $function$;
