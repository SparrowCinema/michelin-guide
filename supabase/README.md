# Cloud sync backend

Supabase project `michelin-guide` (ref `dclxhxxjktegyiwafmsv`, region ap-northeast-1, free plan).

- `public.mg_sync`: one row per sync code, keyed by the SHA-256 of the code (the code itself is never stored). `data` holds `{fav, personal}`; `rev` gives optimistic concurrency.
- `public.mg_photos`: meal photos (JPEG data URLs, ≤1600px) per sync code.
- Both tables have RLS on and no policies, and table privileges are revoked from `anon`/`authenticated`; the only access is through the `SECURITY DEFINER` functions `mg_pull`, `mg_push`, `mg_photo_put`, `mg_photo_get`, `mg_photo_delete` and `mg_delete`, each of which needs the sync code. The Supabase linter warns that anon can call these functions; that is intended (a 120-bit random code is the credential).
- The browser uses the publishable key (safe to ship in client code).
- Free projects pause after a week with no requests; `.github/workflows/keepalive-sync.yml` pings `mg_pull` every 3 days to keep the endpoint warm. Restore from the Supabase dashboard if sync ever pauses after a long break.

Schema: see `migration.sql`.
