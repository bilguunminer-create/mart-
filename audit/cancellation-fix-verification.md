# Cancellation fix — 2026-09-27

Applied to Supabase project `rebtikccivjcsxieeyxe` as migration `20260927130206_atomic_order_cancellation_stock_and_points_refund`.

Customer cancellation, admin cancellation and unpaid expiry now share one atomic stock-and-points restoration routine. Order locking and a unique refund ledger event prevent duplicate restoration. Refunds use actual redeemed ledger amounts and leave lifetime earnings unchanged. Demo orders do not restore inventory. Missing catalog products abort the transaction without partial changes. Checkout acquires the settings lock before the wallet to match cancellation lock ordering.

Verification: all 22 SQL regression scenarios passed inside the migration. Fixture users, orders, wallets, ledger entries and temporary settings changes rolled back. Post-migration verification confirmed SQL assertions enabled, zero remaining fixture orders, and no anonymous cancellation or direct authenticated helper access. TypeScript checking and 9 existing catalog concurrency tests passed.

The profile component now refreshes points after cancellation and after unpaid expiry; this frontend change is local and requires deployment. The backend correction is already live.

Previously cancelled orders were not backfilled because historical inventory restoration cannot be inferred safely. No real order was manually cancelled during verification. Simultaneous multi-session races were not load-tested; serialization is enforced by row locks and the ledger unique constraint.

Security advisors were reviewed. Authenticated RPC definer warnings are expected for these authorized transactional entry points; identity, ownership and admin checks were tested. Other pre-existing advisories remain outside this fix. See [Supabase function permission guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

The CLI package download failed; the native Supabase migration tool supplied the saved migration version. Original function definitions and permissions are recorded in `cancellation-before.json`.
