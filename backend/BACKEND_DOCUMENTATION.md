# Backend Documentation - SaaS-on-SaaS

This document describes the current backend implementation in `c++/SaaS-on-SaaS/backend` and its MySQL schema in `c++/SaaS-on-SaaS/database/schema.sql`.

## System architecture & request lifecycle

Components
HTTP API server: Express app in `backend/server.js`.
Business modules: `authentication.js`, `sqlEditor.js`, `payment.js`, `getinfo.js`.
Database layer: MySQL with pooled connections and a transaction helper in `backend/db.js`.
Database schema and triggers: `database/schema.sql`.

Request lifecycle
1. Incoming HTTP request hits Express middleware in `backend/server.js`.
2. JSON body parsing, CORS, helmet, and optional rate limiting are applied.
3. Route handler executes a `withTransaction` block from `backend/db.js` for any DB mutation or tenant scoped read.
4. Handler performs session validation, tenant and status checks, then executes SQL queries.
5. Access logs are recorded in `AccessLog` for both success and failure cases where implemented.
6. Transaction commits on success or rolls back on error; the handler returns a JSON response with `success` or `error`.

Core endpoints
1. Auth: `POST /api/v1/login`, `POST /api/v1/logout`, `POST /api/v1/signup`.
2. SQL editor: `POST /api/v1/query`.
3. Metadata: `GET /api/v1/tables`, `GET /api/v1/statics`.
4. Billing: `POST /api/v1/pay`, `GET /api/v1/pay`.

## Authentication flow & RBAC enforcement

Session model
1. Login creates a row in `UserSession` with `canAccessEditor` flags.
2. Clients send `x-session-id` on authenticated requests.
3. Logout sets `logout_time` (never deletes sessions).

Login flow
1. Query `User` and `Client` by email to load status, tier, and client ownership.
2. Reject if user or client is not `Active`.
3. Verify password with `bcrypt` against `password_hash`.
4. Check invoices for overdue behavior and set `canAccessEditor`.
5. Create a new `UserSession` row and return `session_id`.

Signup flow
1. Validate required fields.
2. Start a `SERIALIZABLE` transaction.
3. Check for client, username, and admin email uniqueness.
4. Insert `Client`, create three `Plan` rows, insert admin `User`, create initial `Subscription`.
5. Triggers create the first `Invoice` for the subscription.

Logout flow
1. Lock session row with `FOR UPDATE`.
2. Update `logout_time` to be at least one second after `login_time`.

RBAC and tenant isolation
1. Tier permissions are enforced in `sqlEditor.js` using `TIER_PERMISSIONS`.
2. Disallowed statement types include DDL, admin commands, and transaction commands.
3. Session checks verify user and client status, and `canAccessEditor` on the session.
4. Tenant isolation is enforced in two layers:
5. Application layer: AST parsing with `node-sql-parser` and injected tenant conditions for non system clients.
6. Database layer: foreign keys and check constraints in `schema.sql` enforce client ownership rules.
7. The system tenant uses `client_id = 1` and bypasses tenant filters in code.

## Transaction flows & rollback conditions

Transaction helper
1. `withTransaction` obtains a pooled connection, runs `START TRANSACTION`, and commits on success.
2. On error it attempts `ROLLBACK` and retries deadlocks up to 3 times.
3. Isolation levels are set per handler where needed.

Flow: login
1. Transaction wraps session validation, overdue checks, and session creation.
2. Rollback on invalid credentials, inactive user or client, or any SQL error.

Flow: signup
1. `SERIALIZABLE` isolation protects against concurrent duplicate client and user creation.
2. Rollback on constraint violations and manual error conditions.

Flow: sql editor query
1. `REPEATABLE READ` isolation locks the session row and ensures consistent status checks.
2. Validation errors, disallowed statements, tier violations, and cross tenant table access cause rollback.
3. Query execution failure causes rollback after logging a failure in `AccessLog` if possible.

Flow: payment
1. `SERIALIZABLE` isolation ensures invoice and payment status transitions are consistent.
2. Rollback if no active subscription, payment insert fails, or invoice update fails.

Rollback conditions and error sources
1. Constraint failures from `schema.sql` triggers and checks.
2. Deadlocks on hot rows, retried by `withTransaction`.
3. Explicit error throws in code paths for validation, status, RBAC, and tenant checks.

## Raw SQL & connection pooling strategy

Pooling
1. MySQL pool is created via `mysql2/promise` with `connectionLimit: 10` and `waitForConnections: true`.
2. `queueLimit: 0` allows unlimited queued requests.
3. Each transaction obtains and releases a single connection.

Raw SQL usage
1. All operations use raw SQL queries rather than an ORM.
2. SQL statements are concentrated in `authentication.js`, `sqlEditor.js`, `payment.js`, and `getinfo.js`.
3. Triggers in `schema.sql` implement invoice creation, overdue penalties, and access logging.
4. `SET @current_user_id` is used to allow triggers to log user activity.

## Key design decisions & tradeoffs

Multi tenant isolation via AST rewriting
1. Decision: use AST parsing to inject tenant filters for non system tenants.
2. Benefit: users can run flexible SQL without exposing cross tenant data.
3. Tradeoff: parser limitations and edge cases can cause false negatives or rejects; complex SQL may need careful testing.

Session based auth instead of JWT
1. Decision: store sessions in `UserSession` with a `session_id` header.
2. Benefit: server side control and ability to toggle `canAccessEditor` dynamically.
3. Tradeoff: requires DB access on every request and explicit cleanup policy if needed.

Role tiers as query permissions
1. Decision: tier levels map to allowed SQL operations.
2. Benefit: simple mental model and easy enforcement at the SQL gateway.
3. Tradeoff: coarse permissions, limited support for per table or per column access.

Triggers for billing invariants
1. Decision: enforce invoice creation and payment effects in DB triggers.
2. Benefit: keeps billing integrity even if application code changes.
3. Tradeoff: more logic in DB, harder to test in isolation, requires careful migration planning.

Transactions on most endpoints
1. Decision: wrap operations in explicit transactions and use `FOR UPDATE` locks on session rows.
2. Benefit: consistent status checks and reduced race conditions.
3. Tradeoff: increased lock contention and potential for deadlocks under load.
