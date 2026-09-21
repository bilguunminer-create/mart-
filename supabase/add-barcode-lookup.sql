-- Read-only barcode lookup for the register/restock wizard. Needed because the
-- real schema (confirmed by the already-existing admin_inventory_add_stock, not
-- guessed) maps barcode -> product through a separate inventory_barcodes table,
-- not a field on the product object itself. The wizard needs to know whether a
-- scanned barcode is already known *before* committing to either a stock-add or a
-- brand-new registration, without side effects -- admin_inventory_add_stock itself
-- always mutates on a match, so it cannot be used for this check.
--
-- Run this once in the Supabase SQL Editor for the project used by this app.

create or replace function public.admin_lookup_barcode(scan_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'private'
as $function$
declare item record; products jsonb; result jsonb;
begin
  if not private.is_store_admin() then raise exception 'ADMIN_ONLY'; end if;
  select * into item from public.inventory_barcodes where barcode_value = trim(scan_code);
  if not found then return null; end if;
  select data->'products' into products from public.store_settings where id = true;
  select value into result from jsonb_array_elements(products) value where value->>'id' = item.product_id;
  return result;
end
$function$;

revoke all on function public.admin_lookup_barcode(text) from public, anon;
grant execute on function public.admin_lookup_barcode(text) to authenticated;
