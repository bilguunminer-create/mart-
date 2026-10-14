-- Closes three legacy SECURITY DEFINER functions that anyone on the internet
-- could call through /rest/v1/rpc with only the public (publishable) key:
--
--   warehouse_deduct_by_barcode  -- deducts warehouse stock with no admin check,
--                                   and records an actor_id taken from the caller
--   warehouse_register_product   -- creates warehouse products with no admin check
--   place_order                  -- old checkout entry point with no auth.uid() check
--
-- None of them is called by the storefront, the admin panel, the inventory app
-- or /api (checked against main on 2026-10-14); the live equivalents are
-- admin_inventory_* and store_checkout_with_points, which verify the caller.
-- The functions are kept, only EXECUTE is revoked, so this is fully reversible.
--
-- Run this once in the Supabase SQL Editor (project rebtikccivjcsxieeyxe).

revoke execute on function public.warehouse_deduct_by_barcode(text, integer, text, uuid) from public, anon, authenticated;
revoke execute on function public.warehouse_register_product(jsonb) from public, anon, authenticated;
revoke execute on function public.place_order(jsonb) from public, anon, authenticated;
