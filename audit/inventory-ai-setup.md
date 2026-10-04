# Warehouse AI product lookup

The image step starts an authenticated POST to `/api/inventory-ai` after image validation.
The browser sends a resized JPEG and barcode; the original photo remains the uploaded product image.
The server validates the live Supabase user and calls the existing `admin_lookup_barcode` RPC with the user's token to check warehouse permissions. No new database migration is required.

## Production setup

Set `GEMINI_API_KEY` in the uskmart Vercel project's Production environment, then redeploy. The existing chatbot key is reused. Do not add it to a VITE-prefixed variable, source control or the browser.
`GEMINI_INVENTORY_MODEL` optionally overrides the default `gemini-3.8-flash`; select a model supporting images, Google Search and structured output together.
API use and search may incur charges; enable billing/quota in Google AI Studio for the chosen model.
`/api/health` reports `inventoryAiConfigured` as a boolean only. This confirms presence, not validity, quota or model access.
For local Express execution, load these variables in the Node environment before starting server.ts.

## Behavior and verification

- Only name, Mongolian description, pack size and category are suggested. Price, stock, origin, barcode and publishing remain manual.
- Missing/uncertain matches or no HTTPS grounding sources return empty suggestions.
- If Google Search grounding is refused for billing, quota or tool-combination reasons, the server retries once without search and fills only what the photographed label shows (no sources; the message asks for a careful check). Enabling billing restores search automatically.
- Sources and Google's search suggestions are displayed; search HTML is isolated in a sandboxed iframe.
- Users can cancel, retry or enter details manually. Late results preserve edits; replacing a photo clears unedited prior AI values.
- The existing registration button is the user's review/submit step; AI never writes the catalog.
- Requests have bounded image size, provider/client deadlines and a per-user in-memory limit (10 per 10 minutes per server instance). This is not a distributed spending cap; set provider quotas separately.

Tests: `node --import tsx --test tests/inventoryAi.test.ts`, `node node_modules/typescript/bin/tsc --noEmit` and the production build.
Live acceptance: sign in as warehouse admin, enter a new barcode, upload a clear product photo, verify Mongolian suggestions and sources, edit a field while waiting, then cancel/retry. Confirm ordinary customers receive 403. No test catalog writes are needed to verify suggestions.
