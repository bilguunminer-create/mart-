# Supabase database audit evidence

Inspected 2026-09-27 using the connected Supabase tools and read-only PostgreSQL catalog queries. Project: `usk-mart` (`rebtikccivjcsxieeyxe`), status `ACTIVE_HEALTHY`, PostgreSQL 17.6. No business records, customer details, credentials, or tokens were retrieved. No data-changing functions were called and no schema changes were applied.

## P1: Warehouse mutations are callable without authentication

Live metadata confirms both functions are owned by `postgres`, are `SECURITY DEFINER`, and grant `EXECUTE` to `anon` and `authenticated`. The `anon` role also has `USAGE` on the public schema.

| Function | Authentication/authorization in body | Operation |
| --- | --- | --- |
| `public.warehouse_register_product(payload jsonb)` | None | Inserts a warehouse product and, for positive initial stock, a warehouse movement. Accepts `actor_id` from the payload. |
| `public.warehouse_deduct_by_barcode(scan_code text, deduction_quantity integer, movement_note text, actor_id uuid)` | None | Looks up and locks a product by barcode, decreases stock, then inserts a movement attributed to the supplied actor. |

The deduction function checks quantity and stock but never checks `auth.uid()` or an admin/staff role. The registration function starts its body with the product insert. `SECURITY DEFINER` under `postgres` bypasses the warehouse tables' RLS. This is established from live definitions and grants; an exploit mutation was deliberately not performed. These legacy warehouse functions have no matching SQL source file in the current repository.

Recommended correction: immediately revoke unintended execution access, and require authenticated authorized staff inside any retained function. Derive the movement actor from the authenticated user rather than caller input.

## P2: Customers can bypass product-review moderation

Live `public.product_reviews` has RLS enabled, but `authenticated` has table-level `INSERT`. The INSERT policy `Customers write own reviews` has only:

```sql
WITH CHECK (auth.uid() = user_id)
```

It does not constrain `approved`, `approved_at`, `approved_by`, or `customer_name`. The table has all these columns and no user-defined trigger. A customer can directly insert their own review with `approved = true`, bypassing the application RPC that deliberately inserts `approved = null`. Public review reads select approved reviews, so this permits immediate publication.

Local reference: `supabase/fix-product-reviews-schema-mismatch.sql`, function `submit_product_review`, inserts a pending review but does not replace the existing direct INSERT policy. This finding is based on live grants/policies; no review was inserted during the audit.

Recommended correction: revoke direct customer INSERT and require the validating RPC, or enforce pending status and non-forgeable moderation fields in the table policy/privileges.

## P1: Customer cancellation does not restore stock or spent points

Live `public.store_checkout` reduces catalog stock when saving a non-demo order. `public.store_checkout_with_points` additionally inserts a redeemed-points ledger entry and reduces the customer's available points when points are spent.

Live `public.cancel_my_store_order(order_id uuid)` only updates the matching customer's unpaid order from `Шинэ` to `Цуцалсан` and returns it. It does not restore stock, refund redeemed points, or call a cancellation helper. Catalog metadata confirms `public.store_orders` has no user-defined triggers to perform those actions.

Live `public.store_order_status` restores stock for admin cancellation, but does not refund spent points. Thus customer cancellation leaks reserved stock and redeemed points, while admin cancellation still loses redeemed points.

Recommended correction: put cancellation stock and point restoration into one transactional, idempotent server-side function used by customer, admin, and expiry paths.

## P2: Unpaid-order expiry uses obsolete status values

Both live functions `public.expire_my_unpaid_store_orders()` and `public.admin_expire_unpaid_store_orders()` filter `status = 'new'` and write `status = 'cancelled'`. Current checkout, customer cancellation, and admin status code use `Шинэ` and `Цуцалсан`. Therefore the expiry routines do not match current new orders.

Recommended correction: use the current status values and route expiry through the shared cancellation transaction so that stock and points are restored.

## Other observations

- Every inspected public base table has RLS enabled. Tables with no RLS policies are not automatically exposed: deny-by-default tables accessed through controlled RPCs can be intentional.
- The live `private.is_store_admin()` reads `auth.uid()` and joins `auth.users` with the account allowlist; it does not trust user-editable metadata. Main admin inventory/payment/loyalty functions inspected call this helper.
- The security advisor reported publicly executable SECURITY DEFINER functions. Most require individual interpretation: many functions have explicit authorization or are intentionally public. The two warehouse functions above have a concrete missing authorization check.
- The PIN-verification RPC returns a boolean only. Admin data policies and operations authorize the allowlisted account without requiring proof that a PIN was verified. The PIN currently functions as a browser UI gate, not a server-enforced second factor.
- `profile-images` is a public bucket with no bucket-specific MIME or size restrictions, and its upload policy permits authenticated inserts under `avatars`. Product-image buckets have explicit image MIME and size restrictions. The project-wide upload limit was not inspected.

## Advisor documentation

- [Public SECURITY DEFINER function execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [RLS enabled with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Limits

This was a read-only audit of deployed schema, function definitions, privileges, and policies. It did not create test accounts, send emails or notifications, place/cancel orders, insert reviews, alter warehouse stock, or run a malicious request against production. Live findings are structurally confirmed, while end-to-end mutation behavior should be verified in an isolated test environment after repairs.
