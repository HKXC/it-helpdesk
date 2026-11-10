# Flowdesk — IT Help Desk v4

Thai company Help Desk with website-managed email/password accounts, server-enforced Admin / IT / employee roles, a shared support queue, and D1 / Supabase database adapters.

## Run and build

npm install
npm run dev
node node_modules/typescript/bin/tsc --noEmit
npm run build
npm start -- --port 5174

Apply each pending drizzle SQL migration exactly once to the local preview database before testing. The new role/queue migration is drizzle/0002_safe_dracula.sql. Example:

node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_safe_dracula.sql

Sites applies hosted migrations during publication. Local and hosted databases are separate. Do not edit already applied migrations.

## Roles

- employee: create and read own tickets, append public messages, cancel own open tickets, confirm closure with a rating after IT resolves, or reopen own resolved/closed tickets with a reason.
- it: see shared queue, assign tickets to active IT/Admin accounts, update progress, append messages and record resolutions. The requester confirms closure.
- admin: same support capabilities plus user listing, role changes, account suspension/reactivation and role audit history.

Every API checks the authenticated account and current database role. Signup always creates employee accounts and cannot choose a role. Changes and suspensions revoke the affected account's sessions. Users cannot modify their own role or the protected primary Admin account.

ROOT_ADMIN_ID is a server runtime variable containing the exact existing account ID explicitly selected by the owner. It never authorizes by a user-supplied email. That account receives the primary Admin role when its authenticated account is loaded. There is no shared/default Admin password; the account keeps its existing password.

## Authentication

/api/auth/register, /login, /session and /logout implement website accounts. Passwords use salted scrypt (N=32768,r=8,p=3,maxmem=64MiB). Only digests of random 32-byte session tokens are stored. HTTPS cookie: __Host-flowdesk_session, HttpOnly, Secure, SameSite=Lax, Path=/. Loopback previews use a separate local cookie. Sessions last 8 hours, or 7 days with Remember. Account APIs enforce same-origin JSON writes, bounded bodies and 15-minute email/IP attempt limits. Platform identity headers do not authorize website accounts.

## Tickets and upgrades

it_tickets stores requester ID and assigned account ID separately from the ticket body. Creation resets client-supplied status, author, assignment and history. Field changes follow server-side workflow rules. Each ticket has an optimistic revision to reject stale writes. Creation uses a per-account idempotency key so retrying a timed-out request does not duplicate the ticket. Public messages and ticket history append on the server, using the real account name and server time. Requesters cannot modify other users' records or rewrite existing comments/history through the API.

Old website-account snapshots are imported once into the shared ticket table using unique legacy keys. Original references appear in history. Staff queue requests also import outstanding legacy accounts in bounded batches. The old snapshot stays intact. Old ChatGPT-keyed workspaces do not match website account IDs and are never linked by email alone.

The UI shows role-specific navigation and actions, a shared IT queue, assigned-work view, user administration, role audit, knowledge articles and CSV reports. Employee reports include only their own accessible records.

## Database providers

lib/data-store.ts defines the server storage contract. lib/database.ts selects the D1 implementation or lib/supabase-store.ts based on DB_PROVIDER. No database key is sent to the browser.

- DB_PROVIDER=d1: existing hosted D1 database, the current production default.
- DB_PROVIDER=supabase: requires SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) configured as server secrets.
- Missing or invalid Supabase configuration fails closed; it never silently writes to a different provider.

See supabase/README.md, supabase/migrations/001_flowdesk.sql and .env.example. The PostgreSQL schema uses flowdesk_-prefixed tables, RLS and revoked browser permissions, plus narrowly scoped RPC functions for atomic role/audit/session changes and rate-limit increments. Apply schema and migrate existing data before switching a live provider. A new empty Supabase project does not contain current users or tickets.

## Verification

npm start -- --port 5174
node scripts/test-roles.mjs
node scripts/test-store.mjs

The role suite seeds an explicitly local-only QA Admin account through Wrangler --local and tests default employee signup, isolation, cross-account denial, IT queue, assignment, workflow, requester closure/reopen, stale writes, role audit, protected Admin, session revocation, CSRF and idempotent legacy import. The known QA fixture credential exists only in the local test database; it is not a production default.

Optional offline PostgreSQL checks:

npm install --prefix .sites-runtime/pg-check --no-save --package-lock=false @electric-sql/pglite
node scripts/test-supabase-sql.mjs

These checks execute the actual Supabase SQL in local PostgreSQL/WASM and verify grants, RLS denial, transactional role changes, audit, session revocation and optimistic revisions. The Supabase HTTP adapter has independent contract tests. A live Supabase project has not yet been connected or tested.

## Remaining production scope

Email verification/recovery, registration-domain/approval policy, file attachments, email notifications, working-hours/holiday SLA escalation, scheduled backup/restore verification, monitoring and retention policy still need implementation. Current bounds: 500 tickets per requester, 5,000 loaded queue rows, 1,000 Admin user rows, 300 comments and 500 history events per ticket. Add server pagination for larger deployments. Admin audit is append-only through the application API, but is not tamper-proof against database operators.
