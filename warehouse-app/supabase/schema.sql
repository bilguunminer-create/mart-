-- Run in the NEW Warehouse Supabase project's SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.warehouse_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('manager','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.warehouse_products (
  id uuid primary key default gen_random_uuid(),
  barcode text not null unique check (char_length(barcode) between 3 and 128),
  name text not null check (char_length(name) between 2 and 180),
  category text not null default '',
  origin text not null default '',
  description text not null default '',
  image_url text not null default '',
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  unit text not null default 'ш',
  weight text not null default '',
  is_featured boolean not null default false,
  daily_deal boolean not null default false,
  publish_to_shop boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warehouse_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.warehouse_products(id),
  barcode text not null,
  movement_type text not null check (movement_type in ('entry','sale','adjustment','return')),
  quantity integer not null check (quantity <> 0),
  before_stock integer not null,
  after_stock integer not null,
  note text not null default '',
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.warehouse_staff enable row level security;
alter table public.warehouse_products enable row level security;
alter table public.warehouse_movements enable row level security;

-- Browsers never access tables directly. The separate server uses its service key.
create or replace function public.warehouse_register_product(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.warehouse_products; initial_stock integer := greatest(0, coalesce((payload->>'stock')::integer, 0));
begin
  insert into public.warehouse_products (barcode,name,category,origin,description,image_url,price,stock,unit,weight,is_featured,daily_deal,publish_to_shop)
  values (trim(payload->>'barcode'), trim(payload->>'name'), coalesce(payload->>'category',''), coalesce(payload->>'origin',''), coalesce(payload->>'description',''), coalesce(payload->>'image_url',''), coalesce((payload->>'price')::numeric,0), initial_stock, coalesce(payload->>'unit','ш'), coalesce(payload->>'weight',''), coalesce((payload->>'is_featured')::boolean,false), coalesce((payload->>'daily_deal')::boolean,false), coalesce((payload->>'publish_to_shop')::boolean,true))
  returning * into p;
  if initial_stock > 0 then
    insert into public.warehouse_movements(product_id,barcode,movement_type,quantity,before_stock,after_stock,note,actor_id)
    values(p.id,p.barcode,'entry',initial_stock,0,initial_stock,coalesce(payload->>'note','Анхны орлого'),nullif(payload->>'actor_id','')::uuid);
  end if;
  return to_jsonb(p);
end $$;

create or replace function public.warehouse_deduct_by_barcode(scan_code text, deduction_quantity integer, movement_note text, actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.warehouse_products; before_qty integer; after_qty integer;
begin
  if deduction_quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;
  select * into p from public.warehouse_products where barcode = trim(scan_code) for update;
  if not found then raise exception 'BARCODE_NOT_FOUND'; end if;
  before_qty := p.stock;
  if before_qty < deduction_quantity then raise exception 'OUT_OF_STOCK'; end if;
  after_qty := before_qty - deduction_quantity;
  update public.warehouse_products set stock=after_qty, updated_at=now() where id=p.id returning * into p;
  insert into public.warehouse_movements(product_id,barcode,movement_type,quantity,before_stock,after_stock,note,actor_id)
  values(p.id,p.barcode,'sale',-deduction_quantity,before_qty,after_qty,coalesce(movement_note,''),actor_id);
  return to_jsonb(p);
end $$;

grant execute on function public.warehouse_register_product(jsonb) to service_role;
grant execute on function public.warehouse_deduct_by_barcode(text,integer,text,uuid) to service_role;
