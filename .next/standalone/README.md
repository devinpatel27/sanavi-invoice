# Sanvicasa Invoice & Billing

Construction material purchase invoice & billing system — replaces a manual
Excel-based purchase tracker with **upload → AI extraction → review →
dashboard / rate-sheet reporting**.

Repo: https://github.com/devinpatel27/sanavi-invoice

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- PostgreSQL + Prisma ORM (local via Docker Compose)
- NextAuth (Auth.js) credentials provider — roles: `ADMIN`, `STAFF`
- Azure Document Intelligence (`prebuilt-invoice`) for OCR/extraction
- Azure Blob Storage for invoice files (optional; local `.data/uploads` fallback)
- Recharts for dashboard charts

---

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **Docker Desktop** (for local Postgres)
- Optional: **cloudflared** (temporary public URL for phone/remote testing)
- Optional: Azure Document Intelligence endpoint + key

---

## How to run (Windows)

Open **PowerShell** (or two/three terminals).

### 1. Install dependencies

```powershell
cd C:\Devin\invoice-crm
npm install
```

### 2. Environment file

```powershell
copy .env.example .env
```

Edit `.env` and set at least:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Already set for Docker Postgres in `.env.example` |
| `AUTH_SECRET` | Random string (generate once) |
| `AUTH_TRUST_HOST` | `true` (needed for Cloudflare Tunnel) |
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | Azure DI endpoint |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | Azure DI key |
| `AZURE_STORAGE_CONNECTION_STRING` | Optional — leave empty to use local files |

Never commit `.env` (it is gitignored).

### 3. Start Postgres

Start **Docker Desktop**, then:

```powershell
npm run db:up
```

### 4. Migrate + seed

```powershell
npm run db:migrate
npm run db:seed
```

### 5. Start the app

```powershell
npm run dev
```

Open **http://localhost:3000**

### Seeded logins

| Role  | Email                       | Password            |
| ----- | --------------------------- | ------------------- |
| ADMIN | admin@sanvicasagroup.in     | admin@sanvicasa26   |
| STAFF | staff@sanvicasagroup.in     | staff@sanvicasa26   |

---

## Temporary live URL (Cloudflare Tunnel)

Keep `npm run dev` running, then in a **second terminal**:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Copy the printed `https://….trycloudflare.com` URL.

Notes:

- The URL changes every time you restart the tunnel.
- Keep Docker + `npm run dev` + `cloudflared` all running while testing.
- If login fails on the tunnel host, set in `.env`:
  - `AUTH_TRUST_HOST="true"`
  - `AUTH_URL="https://your-current-tunnel.trycloudflare.com"`
  - Restart `npm run dev`
- Add the tunnel host to `allowedDevOrigins` in `next.config.ts` if Next.js blocks client JS in dev.

---

## Useful scripts

| Script | What it does |
|--------|----------------|
| `npm run dev` | Start Next.js at http://localhost:3000 |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run db:up` | Start Postgres (Docker Compose) |
| `npm run db:down` | Stop Postgres |
| `npm run db:migrate` | Create/apply Prisma migrations |
| `npm run db:seed` | Seed admin/staff, categories, demo project |
| `npm run db:studio` | Open Prisma Studio |

---

## Roles

- **ADMIN** — dashboard (cards + charts), invoices, payments, rate sheet, vendors, categories, users.
- **STAFF** — upload-first: lands on `/invoices/upload`, can review own drafts, create categories during upload/review.

## Upload → review flow

1. Select a **category**, then upload PDF/JPG/PNG (drag-drop or Take photo).
2. Azure Document Intelligence extracts fields → draft `NEEDS_REVIEW`.
3. Review/edit vendor, category, line items → confirm → `UNPAID`.
4. Confirmed spend appears on the admin dashboard by category.

## Azure

- Document Intelligence is required for extract.
- Blob Storage is optional in development (local `.data/uploads` fallback).

## Data model

See `prisma/schema.prisma`: Project, Category, Material, Vendor, Invoice,
InvoiceLineItem, Payment, User / ProjectAssignment, AuditLog.
