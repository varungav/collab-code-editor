# Real-Time Collaborative Code Editor

A VS Code–style collaborative code editor: React + TypeScript + Monaco on the
frontend, Node.js/Express + PostgreSQL (via Prisma) on the backend, with
real-time editing powered by Yjs over a custom WebSocket protocol. Access to
each project is controlled by an OWNER/EDITOR/VIEWER role model enforced on
both the REST API and the WebSocket layer.

## Architecture

```text
Internet
   │
   ├── Vercel
   │      └── React frontend (Vite build)
   │
   └── Render
          └── Node.js + Express + WebSocket
                    │
                    ▼
               PostgreSQL (Render/managed Postgres)
```

Authentication is a self-hosted JWT scheme (bcrypt password hashes +
`jsonwebtoken`), not a third-party auth provider. All database access goes
through this backend via Prisma — there is no direct client-to-database path,
so there is no client-side database key of any kind to protect (see
[Database access model](#database-access-model) below).

## Local setup

1. Clone the repository.
2. Install frontend dependencies: `npm install` (repo root).
3. Install backend dependencies: `cd backend && npm install`.
4. Configure environment files:
   - Copy `.env.example` → `.env` (repo root, frontend Vite variables).
   - Copy `backend/.env.example` → `backend/.env` (backend variables).
   - Fill in `DATABASE_URL` and generate a strong `JWT_SECRET`, e.g.
     `openssl rand -hex 32`.
5. Start Postgres (`docker compose up -d` at the repo root, if using the
   provided `docker-compose.yml`), then run migrations:
   `cd backend && npx prisma migrate deploy`.
6. Run the backend: `cd backend && npm run dev`.
7. Run the frontend: `npm run dev` (repo root).

## Environment variables

### Frontend (repo root `.env`)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the backend REST API, e.g. `http://localhost:3000/api` in development or `https://<backend-domain>/api` in production. |
| `VITE_WS_URL` | WebSocket URL of the backend, e.g. `ws://localhost:3000/ws` in development or `wss://<backend-domain>/ws` in production. If omitted, it is derived from `VITE_API_URL`. |

### Backend (`backend/.env`)

| Variable | Purpose |
|---|---|
| `PORT` | Port the HTTP/WebSocket server listens on. Render sets this automatically in production. |
| `FRONTEND_URL` | The single origin allowed by CORS, e.g. `http://localhost:5173` in development or `https://<frontend-domain>` in production. Never set to `*`. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_SECRET` | Secret used to sign/verify auth tokens. Must be a long random value in production and must never be committed or shared with the frontend. |

Never commit real `.env` files — only `.env.example` (with placeholder
values) is tracked in git. `.gitignore` excludes `.env` and `.env.*` while
explicitly allowing `.env.example`.

## Production build

```bash
# Backend
cd backend
npm run build   # tsc -> dist/
npm start       # node dist/server.js, reads PORT/FRONTEND_URL/DATABASE_URL/JWT_SECRET from env

# Frontend (repo root)
npm run build   # tsc -b && vite build -> dist/
npm run preview # serve the built frontend locally to sanity-check it
```

The backend listens on `process.env.PORT` (falling back to 3000 only for
local convenience) and exposes an unauthenticated `GET /health` (and
`GET /api/health`) returning `{ "status": "ok" }` for platform health checks.

## Deployment targets

- **Frontend → Vercel.** Build command `npm run build`, output directory
  `dist`. Set `VITE_API_URL` and `VITE_WS_URL` to the deployed backend's
  `https`/`wss` URLs in the Vercel project's environment variables — these
  are baked in at build time, so they must be set before each deploy.
- **Backend → Render.** A `render.yaml` blueprint is included; Render must
  use a service type that supports long-lived WebSocket connections (a
  standard Render web service does). Set `FRONTEND_URL`, `DATABASE_URL`, and
  `JWT_SECRET` as Render environment variables/secrets — never in the repo.
- **Database → managed PostgreSQL** (e.g. Render's managed Postgres). Run
  `npx prisma migrate deploy` against it once as part of the deploy process.

## Database access model

This project's authorization model (`projectAuthorizationService`, the
`ProjectMember` table, and JWT-based `authMiddleware`) is enforced entirely
inside this Node.js backend — every request and every WebSocket message is
authenticated and role-checked in application code before touching the
database. There is no direct client → database connection anywhere in this
architecture, and no database credential is ever exposed to the frontend.
This is an intentional, documented choice: row-level security policies at the
database layer are a mitigation for architectures where clients talk to the
database directly (e.g. via Supabase's client SDK), which does not apply
here. If this architecture ever changes to allow direct client-to-database
access, this decision should be revisited.

## Security review notes (production readiness)

- CORS is locked to a single configured origin (`FRONTEND_URL`); wildcard
  origins are never used for authenticated routes.
- Error responses never include stack traces, connection strings, or
  filesystem paths — see `backend/src/utils/errorHandler.ts`. Unexpected
  errors return a generic `{ "error": "Internal server error" }` and are
  logged server-side only.
- Every protected REST endpoint and every WebSocket message resolves the
  caller's project role via `projectAuthorizationService` before allowing
  access; a user with no `ProjectMember` row for a project gets 404, a member
  with an insufficient role gets 403.
- WebSocket clients cannot join arbitrary project/file rooms — `join_file`
  re-uses the same authorization check as the REST file endpoints, and cross-
  checks that the requested file actually belongs to the requested project.
- A VIEWER's Yjs document updates are rejected at the WebSocket layer itself
  (not just hidden in the UI) — the server computes `canEdit` from the
  caller's authenticated role once at `join_file` time and checks it on every
  binary update frame afterward.
- Input validation (name/path/length/content-size limits, path-traversal
  rejection, role/email format checks) happens in the service layer, never
  relying on frontend validation alone.
- The Node process handles `SIGTERM`/`SIGINT` by stopping new HTTP
  connections, closing WebSocket connections, disconnecting Prisma, and
  exiting — see `backend/src/server.ts`.

## What this project does not do (out of scope)

Email invitations, notifications, chat persistence beyond the existing debug
panel, git integration, an in-browser terminal, sandboxed code execution,
AI features, billing, multi-project organizations/teams, and project
ownership transfer are all intentionally out of scope for the phases
completed so far.
