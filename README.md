# Manasik — Holy Sites Operations

A company-based operations application built with React, TypeScript, Vite, Tailwind CSS, Supabase, and Cloudflare Pages.

## Implemented

- Email registration with immediate sign-in, login, password recovery, and company onboarding.
- All 249 ISO countries and territories; company creation and approved membership.
- Company admin, supervisor, camp manager, service provider, and viewer permissions.
- Super-admin and country-admin scopes, a company directory and workspace switching.
- Camps, service providers and issue type CRUD, plus company settings and deactivation.
- Tool 9 incidents: drafts, severity, assignments, actions, status workflow, comments and private attachments.
- Transactional escalation into Tool 10, supervisor submission/approval and immutable approved reports.
- Dashboard analytics, search/filtering, CSV exports and browser Print / Save PDF reports.
- Movement scheduling, arrival counts, camp vacating and baggage/pilgrim reconciliation.
- In-app notifications, immutable operational audit history, and optional email and Stripe Edge Functions.

The application requires a configured Supabase backend to use accounts or persist data. There is no fake login or local-storage operational database. Cloud resources have not been provisioned or deployed from this workspace.

## Run locally

Use Node.js 22 or later:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Add the Supabase URL and publishable key to `.env.local`, install the database using `supabase/setup.sql`, then:

```powershell
npm run dev
```

See [the complete deployment guide](docs/DEPLOYMENT.md) for free-project creation, database installation, email configuration, administrator setup, and Cloudflare deployment.

## Verify

```powershell
npm test
npm run build
npm run format:check
```

Tests cover actual PostgreSQL policies and workflows in PGlite with modeled Supabase Auth/Storage schemas, form behavior, CSV safety, and integration authentication. The production build type-checks both frontend and Edge Function code. Live Supabase, email delivery, payments and cloud hosting still need account-specific acceptance testing.

## Documents

- [Implementation and permissions](docs/IMPLEMENTATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Acceptance scenarios](docs/ACCEPTANCE.md)
- [Database relationships](docs/DATABASE.md)

Official Tool 9/10 templates were not supplied. Current fields and printable layouts follow the pasted requirements, not a certified official form. SMS/WhatsApp, offline reporting, GPS tracking, AI prediction and mobile-native applications are outside this implementation. Stripe is optional and disabled until pricing, provider settings and test-mode verification are complete.
