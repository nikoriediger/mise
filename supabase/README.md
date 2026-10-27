# Database

`migrations/` holds the full schema, applied in filename order.

When a hosted project is linked to the repo through the Supabase GitHub
integration ("Deploy to production" on), every push to `main` applies new
migrations automatically.
Never edit a migration that has already been pushed — add a new one instead.

`npm run test:db` runs all migrations plus the RLS checks in `tests/` against
an in-memory Postgres (PGlite). Extend it for every schema change.
