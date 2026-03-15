# SaaS-on-SaaS Backend

This project provides a multi-tenant SaaS backend with authentication, a SQL editor gateway, billing, and metadata endpoints.

## Prerequisites

- Node.js (LTS recommended)
- MySQL 8.x (or compatible)

## Setup

1. Install dependencies from the repository root:

```bash
npm install
```

2. Create the database and load the schema:

```bash
mysql -u <db_user> -p -e "CREATE DATABASE saas_db;"
mysql -u <db_user> -p saas_db < database/schema.sql
```

3. Configure environment variables in `config.env` at the repo root:

```ini
DB_HOST=localhost
DB_USER=saasuser
DB_PASSWORD=saasuser
DB_NAME=saas_db
DB_ADMIN_EMAIL=admin@saasplatform.com
DB_ADMIN_PASS=system_admin
PORT=3000
```

## Run

Start the API server from the repository root (important because `backend/server.js` loads `./config.env`):

```bash
node backend/server.js
```

Health check:

```bash
curl http://localhost:3000/health
```

## API

The API is described in `swagger.json`. You can open it in Swagger UI or any OpenAPI viewer.

Key endpoints:

- `POST /api/v1/signup`
- `POST /api/v1/login`
- `POST /api/v1/logout`
- `POST /api/v1/query`
- `GET /api/v1/tables`
- `GET /api/v1/statics`
- `POST /api/v1/pay`
- `GET /api/v1/pay`

## Test Script

A sample script exists at `backend/test.mjs` to exercise the `/api/v1/query` endpoint and other flows.

```bash
node backend/test.mjs
```

## Notes

- Authenticated routes require the `x-session-id` header.
- The SQL editor enforces tier permissions and tenant isolation in `backend/sqlEditor.js`.
