-- One-time data fix: at some point every product in store_settings.data.products
-- was set to in_stock: false (regardless of actual stock count) and most were
-- set to published: false, which emptied the customer-facing catalog.
--
-- This republishes every product and combo, and restores in_stock to match the
-- real recorded stock count (products/combos that genuinely have 0 stock stay
-- out of stock; combos are not stock-tracked, so only their published flag is touched).
--
-- Run this once in the Supabase SQL Editor.

update public.store_settings
set data = jsonb_set(
  data,
  '{products}',
  (
    select jsonb_agg(
      case
        when (elem->>'category') = 'combo' then elem || jsonb_build_object('published', true)
        else elem || jsonb_build_object(
          'published', true,
          'in_stock', coalesce((elem->>'stock')::int, (elem->>'stock_quantity')::int, 0) > 0
        )
      end
    )
    from jsonb_array_elements(data->'products') elem
  )
)
where id = true;
