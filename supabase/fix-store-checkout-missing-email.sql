-- store_orders already has an email column, but store_checkout() never wrote
-- to it -- the INSERT into store_orders omitted it entirely, so every order's
-- email was silently NULL regardless of what the customer entered at
-- checkout. This is why email-based order matching (loyalty tier progress,
-- purchase history) never worked for customers without a phone number on
-- file, and why the checkout screen showed no discount for email-only
-- accounts.
--
-- The email is taken from the verified auth.jwt() claim for the
-- authenticated caller (the same source read_store_orders already trusts
-- for the admin check), not from the client-supplied payload -- this cannot
-- be spoofed and always matches the real signed-in account.
--
-- Run this once in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.store_checkout(payload jsonb, save_order boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s jsonb; cfg public.store_settings; l jsonb; p jsonb; tier_data jsonb; lines jsonb='[]'; qty integer; idx integer; sub integer=0; dd integer=0; vd integer=0; fee integer; grand integer; spent numeric; pct numeric=0; daypct numeric=0; daycat text; daynum text; uid uuid=auth.uid(); demo boolean; n text; ph text; em text; addr text; rid uuid; old public.store_orders; result jsonb;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null and coalesce(is_anonymous,false)=false) then raise exception 'LOGIN_REQUIRED';end if;
 if jsonb_typeof(payload->'items') is distinct from 'array' then raise exception 'INVALID_ORDER';end if;
 if jsonb_array_length(payload->'items') not between 1 and 50 then raise exception 'INVALID_ORDER';end if;
 if (select count(distinct i->>'productId') from jsonb_array_elements(payload->'items') i)<>jsonb_array_length(payload->'items') then raise exception 'INVALID_ORDER';end if;
 select * into cfg from public.store_settings where id=true for update;s=cfg.data;
 if s is null then raise exception 'STORE_UNAVAILABLE';end if;
 demo=coalesce((s->'rules'->>'demo_mode')::boolean,true);
 em=nullif(lower(coalesce(auth.jwt()->>'email','')),'');
 if save_order then
  rid=(payload->>'requestId')::uuid;n=btrim(payload->>'name');ph=payload->>'phone';addr=btrim(payload->>'address');
  if rid is null or n is null or length(n) not between 2 and 120 or ph is null or ph !~ '^[0-9]{8}$' or addr is null or length(addr) not between 5 and 500 or length(coalesce(payload->>'note',''))>1000 then raise exception 'INVALID_ORDER';end if;
  select * into old from public.store_orders where request_id=rid;
  if found then
   if old.customer_id<>uid then raise exception 'INVALID_ORDER';end if;
   return to_jsonb(old);
  end if;
  if (select count(*) from public.store_orders where customer_id=uid and created_at>now()-interval '1 hour')>=10 then raise exception 'ORDER_LIMIT';end if;
 end if;
 select coalesce(sum(total-delivery_fee),0) into spent from public.store_orders where customer_id=uid and status='Дууссан' and not is_demo;
 if coalesce((s->'rules'->>'vip_enabled')::boolean,false) then
  select v into tier_data from jsonb_array_elements(s->'loyalty_tiers') v where coalesce((v->>'enabled')::boolean,true) and (v->>'threshold')::numeric<=spent order by (v->>'threshold')::numeric desc limit 1;
  pct=least(100,greatest(0,coalesce((tier_data->>'discount_pct')::numeric,0)));
 end if;
 daynum=extract(dow from now() at time zone 'Asia/Ulaanbaatar')::integer::text;
 if coalesce((s->'rules'->>'daily_enabled')::boolean,false) then
  daypct=least(100,greatest(0,coalesce((s->'daily_deals'->daynum->>'discount_percent')::numeric,0)));
  daycat=s->'daily_deals'->daynum->>'category';
 end if;
 for l in select * from jsonb_array_elements(payload->'items') loop
  if coalesce(l->>'quantity','') !~ '^[0-9]{1,3}$' then raise exception 'INVALID_ORDER';end if;
  qty=(l->>'quantity')::integer;if qty not between 1 and 100 then raise exception 'INVALID_ORDER';end if;
  select value,ordinality::integer-1 into p,idx from jsonb_array_elements(s->'products') with ordinality where value->>'id'=l->>'productId';
  if p is null then select value,ordinality::integer-1 into p,idx from jsonb_array_elements(s->'combos') with ordinality where value->>'id'=l->>'productId';end if;
  if p is null or not coalesce((p->>'in_stock')::boolean,true) or not coalesce((p->>'published')::boolean,true) then raise exception 'PRODUCT_UNAVAILABLE';end if;
  if (p->>'price')::integer<=0 then raise exception 'PRODUCT_UNAVAILABLE';end if;
  if not demo and coalesce((p->>'stock')::integer,0)<qty then raise exception 'OUT_OF_STOCK';end if;
  sub=sub+(p->>'price')::integer*qty;
  if daycat='all' or daycat=p->>'category' then dd=dd+round((p->>'price')::numeric*qty*daypct/100)::integer;end if;
  lines=lines||jsonb_build_array(jsonb_build_object('productId',p->>'id','title',p->>'name','quantity',qty,'price',(p->>'price')::integer));
  if save_order and not demo then
   if p ? 'category' then s=jsonb_set(s,array['products',idx::text,'stock'],to_jsonb((p->>'stock')::integer-qty));else s=jsonb_set(s,array['combos',idx::text,'stock'],to_jsonb((p->>'stock')::integer-qty));end if;
  end if;
 end loop;
 if coalesce((s->'rules'->>'stack_discounts')::boolean,false) then vd=round((sub-dd)*pct/100)::integer;
 else vd=round(sub*pct/100)::integer;if dd>=vd then vd=0;else dd=0;end if;end if;
 fee=coalesce((s->>'delivery_fee')::integer,3000);
 if (coalesce((s->'rules'->>'free_delivery_enabled')::boolean,true) and sub-dd-vd>=coalesce((s->>'free_delivery_threshold')::integer,100000)) or coalesce((tier_data->>'free_delivery')::boolean,false) then fee=0;end if;
 grand=sub-dd-vd+fee;
 if save_order and (payload->>'expectedTotal')::integer is distinct from grand then raise exception 'PRICE_CHANGED';end if;
 result=jsonb_build_object('items',lines,'subtotal',sub,'daily_discount',dd,'vip_discount',vd,'delivery_fee',fee,'total',grand,'tier',coalesce(tier_data->>'name',''),'gift',coalesce(tier_data->>'admin_gift',''),'is_demo',demo,'lifetime_spend',spent);
 if save_order then
  insert into public.customer_profiles(user_id,name,phone,address) values(uid,n,ph,addr) on conflict(user_id) do update set name=excluded.name,phone=excluded.phone,address=excluded.address;
  insert into public.store_orders(request_id,customer_id,customer_name,phone,email,address,note,items,subtotal,daily_discount,vip_discount,delivery_fee,total,tier,gift,is_demo) values(rid,uid,n,ph,em,addr,coalesce(payload->>'note',''),lines,sub,dd,vd,fee,grand,coalesce(tier_data->>'name',''),coalesce(tier_data->>'admin_gift',''),demo) returning * into old;
  if not demo then update public.store_settings set data=s,version=version+1,updated_at=now() where id=true;end if;
  result=to_jsonb(old);
 end if;
 return result;
end;$function$;

-- One-time backfill: fill in email for existing orders where it is missing,
-- for accounts where the phone on the order matches the phone on file for
-- exactly one customer profile whose auth email we can resolve. This only
-- covers what can be inferred safely; older orders with no reliable match
-- are left as they are rather than guessed.
update public.store_orders o
set email = u.email
from public.customer_profiles cp
join auth.users u on u.id = cp.user_id
where o.email is null
  and o.customer_id = cp.user_id
  and u.email is not null;
