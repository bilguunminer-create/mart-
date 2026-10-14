-- Fixes from audit/site-audit-2026-10-14.md (#4, #5).
-- Run this once in the Supabase SQL Editor (project rebtikccivjcsxieeyxe).

-- #4 Reviews bypassed moderation: any signed-in user could POST straight to
-- /rest/v1/product_reviews with approved=true and any customer_name. The app
-- only ever uses the SECURITY DEFINER RPCs (submit_product_review,
-- moderate_product_review, delete_product_review, read_*), which keep working
-- because they run as the function owner. Reading stays allowed under RLS.
revoke insert, update, delete on public.product_reviews from anon, authenticated;

-- #5 profile-images accepted any file type and size, publicly served from the
-- project's domain. Match what the app already enforces in uploadProfileImage.
update storage.buckets
set file_size_limit = 3 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'profile-images';
