-- Two products in the live catalog have dead Unsplash image URLs (confirmed
-- via console 404s and naturalWidth=0 on the live site): DRINK-001 (Fiji
-- water) and VIT-003 (Nature Made Fish Oil). storeData.ts's fallback copies
-- of these products were already fixed with working replacement photos --
-- this applies the same fix to the real live data in store_settings, since
-- the storefront reads from there, not from the bundled fallback file.
--
-- Run this once in the Supabase SQL Editor.

update public.store_settings
set data = jsonb_set(
  data,
  '{products}',
  (
    select jsonb_agg(
      case
        when elem->>'id' = 'DRINK-001'
          then jsonb_set(elem, '{image}', '"https://images.unsplash.com/photo-1616118132534-381148898bb4?auto=format&fit=crop&w=600&h=600&q=80"')
        when elem->>'id' = 'VIT-003'
          then jsonb_set(elem, '{image}', '"https://images.unsplash.com/photo-1670850756988-a1943aa0e554?auto=format&fit=crop&w=600&h=600&q=80"')
        else elem
      end
    )
    from jsonb_array_elements(data->'products') elem
  )
)
where id = true;
