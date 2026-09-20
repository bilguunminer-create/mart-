-- Adds stock to an already-registered product by barcode ("restock"), instead of
-- re-registering it as a brand new product (which the confirmed-not-upsert behavior
-- of admin_register_catalog_product would otherwise require, and would either fail
-- on a duplicate barcode or create a second, duplicate catalog entry).
--
-- Built from evidence already confirmed elsewhere in this schema (not guessed):
-- - store_order_status()'s own source (already reviewed) shows products live as a
--   JSONB array at store_settings.data.products, each element matched by its 'id'
--   key, with an integer 'stock' key updated via jsonb_set on the whole row.
-- - inventory_movements is a real, directly-queryable table (getInventoryMovements
--   selects from it with plain REST, not an RPC), with exactly the columns used
--   below: id, product_id, product_name, barcode_value, movement_type, quantity,
--   stock_before, stock_after, note, created_at.
--
-- The one thing not directly confirmed is the exact JSONB key holding a product's
-- barcode (register()'s client payload sends it as `barcode`, so that is assumed
-- here). If products were stored under a different key, this function simply
-- raises BARCODE_NOT_FOUND -- there is no path here that can silently corrupt data.
--
-- Run this once in the Supabase SQL Editor for the project used by this app.

create or replace function public.admin_inventory_add_stock(scan_code text, add_quantity integer, movement_note text default '')
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  s jsonb;
  p jsonb;
  idx integer;
  before_stock integer;
  after_stock integer;
begin
  if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
  if scan_code is null or length(trim(scan_code)) = 0 then raise exception 'INVALID_BARCODE'; end if;
  if add_quantity is null or add_quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;

  select data into s from public.store_settings where id = true for update;

  select value, ordinality::integer - 1 into p, idx
  from jsonb_array_elements(s->'products') with ordinality
  where value->>'barcode' = trim(scan_code)
  limit 1;

  if p is null then raise exception 'BARCODE_NOT_FOUND'; end if;

  before_stock := coalesce((p->>'stock')::integer, 0);
  after_stock := before_stock + add_quantity;

  s := jsonb_set(s, array['products', idx::text, 'stock'], to_jsonb(after_stock));
  update public.store_settings set data = s, version = version + 1, updated_at = now() where id = true;

  insert into public.inventory_movements (product_id, product_name, barcode_value, movement_type, quantity, stock_before, stock_after, note)
  values (p->>'id', p->>'name', trim(scan_code), 'entry', add_quantity, before_stock, after_stock, coalesce(movement_note, ''));

  return jsonb_build_object('name', p->>'name', 'stock_before', before_stock, 'stock_after', after_stock);
end;
$function$;

revoke all on function public.admin_inventory_add_stock(text, integer, text) from public, anon;
grant execute on function public.admin_inventory_add_stock(text, integer, text) to authenticated;
