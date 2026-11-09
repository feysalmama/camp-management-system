# Deploy the free pilot

## 1. Create your Supabase project

Open [Supabase Dashboard](https://supabase.com/dashboard), sign in, and create a new project on the Free plan. Use a dedicated new project for this application. Choose an appropriate region and save the database password privately.

When initialization completes, open **Connect** or **Project Settings → API**. Copy the Project URL and publishable key. The browser application needs only those public settings. Never paste a database password, secret key, or service-role key into frontend environment variables or this repository.

## 2. Install the database

Run `npm run setup:sql` if migrations have changed. Open `supabase/setup.sql`, copy its contents, and run it once in **Supabase → SQL Editor → New query** as the project owner. It includes all versioned migrations, the 249-country seed, reporting policies, and the private attachment bucket.

This is an initial installation script for a fresh project, not an idempotent upgrade script. If you use the Supabase CLI instead, link the project and run `supabase db push`; do not apply both methods to the same database. Keep migration history consistent with whichever route you choose.

The tables, functions and policies can be inspected under Database. Ordinary users should never be given SQL Editor access.

## 3. Configure authentication

Under **Authentication → URL Configuration** set the production Site URL and add these allowed redirect URLs:

- `http://localhost:5173/`
- `http://localhost:5173/reset-password`
- `http://127.0.0.1:5173/`
- `http://127.0.0.1:5173/reset-password`
- `https://YOUR-PROJECT.pages.dev/`
- `https://YOUR-PROJECT.pages.dev/reset-password`

Replace the production domain after Cloudflare creates it. Per the selected registration policy, open **Authentication → Sign In / Providers → Email**, switch **Confirm email** off, and save. New signups then receive a session immediately and continue to company onboarding. Set the minimum password length to 10 or more in the Auth provider settings. The browser publishable key cannot change this project setting. The local `supabase/config.toml` sets `enable_confirmations = false`, but this alone does not change the hosted project.

Registration does not require email delivery when **Confirm email** is off. Password reset emails still require a working sender. Supabase's built-in email service is intended for testing and restricts recipient addresses; configure **custom SMTP** for password resets to general users. See [SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp) and [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## 4. Run locally

```powershell
npm ci
Copy-Item .env.example .env.local
```

Edit `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
VITE_BILLING_ENABLED=false
```

Then run `npm run dev`. Changes to environment values require a server restart. The login screen explicitly reports when no backend is configured; it never saves real operational records in local browser storage.

## 5. Create the first company and platform administrator

Register an account and continue directly to country/company selection. Its company creator automatically receives company-admin access. Other users request membership and must be approved in **Team & access**.

To make a trusted registered account a platform super administrator, run this once in SQL Editor, replacing the email:

```sql
insert into public.platform_access(user_id, role)
select id, 'super-admin' from public.profiles
where lower(email)=lower('YOUR-ADMIN-EMAIL');
```

Refresh the app. The **Platform admin** screen can create managed companies and grant country or super-admin access to existing registered accounts. Country administrators oversee the companies in their country; company membership is managed by company or super administrators. Country admins can create a company in their own country, but a super administrator must provision its first company admin through membership approval.

Do not assign privileged access to an account you have not verified belongs to the intended person. Self-registration fields never control platform roles.

## 6. Deploy to Cloudflare Pages

Push this directory to your own GitHub repository. In Cloudflare choose **Workers & Pages → Create → Pages → Connect to Git** and select it.

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | `22` |
| Build environment | The same public `VITE_` values as above |

Use the generated `pages.dev` address for a free domain. A custom domain is optional. Pages serves this application with its default SPA fallback when there is no top-level `404.html`; no catch-all `_redirects` rule is needed. `_headers` supplies browser security headers; if you use a custom Supabase domain, update its `connect-src` and `img-src` entries before deploying.

Alternatively, use Cloudflare Pages **Direct Upload** and upload `release/manasik-cloudflare-pages.zip`. This package is already built with the configured public Supabase settings; it contains no service-role key. For later frontend changes, rebuild and replace the uploaded package. Git integration is preferable for automatic future updates.

### If you created a Worker with Git integration instead of Pages

The included `wrangler.jsonc` supports the Worker named `camp-management-system` with static assets from `dist` and `not_found_handling: single-page-application`. Keep the existing Vite configuration; no Cloudflare Vite plugin is needed for this static frontend. Do not reintroduce `public/_redirects` with `/* /index.html 200`, because Workers rejects that rule as an infinite loop.

Under the Worker's **Settings → Build**, use:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Build variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_BILLING_ENABLED=false`.

Set the two Supabase values from your local `.env.local`. They must be **build variables**, not only runtime Worker variables: Vite embeds them into browser JavaScript. A production build now fails explicitly when they are missing, instead of publishing a disconnected login page. `.env.local` is intentionally ignored by Git.

Commit and push the routing/configuration changes to your connected repository, then retry the deployment. The Worker will use its generated `workers.dev` address; add that actual address to Supabase URL configuration just as you would a Pages domain.

See [Cloudflare build settings](https://developers.cloudflare.com/pages/configuration/build-configuration/). After deployment, add its actual URL to Supabase authentication settings and test an email confirmation and password reset on that domain.

## 7. Optional report emails

In-app notifications work without an email provider. Report notification emails require a sender service in addition to Auth SMTP.

Deploy the `notify-email` Edge Function using the Supabase CLI. Set these Edge Function secrets in Supabase, never in frontend `.env` files:

- `WEBHOOK_SECRET`: a long random value you create privately.
- `RESEND_API_KEY`: from your Resend account.
- `EMAIL_FROM`: a sender authorized by Resend.
- `APP_URL`: the exact production origin, without a trailing slash.

Create a **Database Webhook** for `public.notifications`, event `INSERT`, pointing to `https://YOUR-PROJECT.supabase.co/functions/v1/notify-email`. Set its Authorization header to `Bearer YOUR-WEBHOOK-SECRET`. `supabase/config.toml` disables the platform JWT check for this endpoint; the function itself requires that private webhook secret. Do not make the webhook secret public.

The function fetches the notification recipient from the database and sends a sign-in link. The stable Resend idempotency key and `email_sent_at` field prevent routine duplicate delivery. Monitor function logs and retry failed events using the same notification ID; a scheduled retry queue is not included. SMS and WhatsApp adapters are not enabled; selecting a provider and recipient phone/consent requirements remains a separate integration task.

## 8. Optional paid company subscriptions

The core workspace is free, with paid billing disabled by default. To offer a subscription, first define its price and business terms in Stripe. Deploy `billing` and `stripe-webhook`, then set Edge secrets:

- `APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`: a recurring price you have created.
- `STRIPE_WEBHOOK_SECRET`: from the Stripe webhook endpoint.

Register the `stripe-webhook` endpoint for `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Enable the Stripe customer portal. The webhook verifies the signature and timestamp before updating server-owned subscription records. Checkout requires an authenticated company administrator; a browser cannot set its own paid status.

Use Stripe **test mode** to verify checkout, portal, webhook retries and cancellation before using live keys. Only after that, set `VITE_BILLING_ENABLED=true` on Cloudflare and rebuild. No subscription restricts core report access in this version; the paid offering and entitlements must be defined before selling it.

## 9. Go-live verification

Follow [ACCEPTANCE.md](ACCEPTANCE.md). Local tests use embedded PostgreSQL with modeled Auth and Storage schemas; they do not replace testing against your hosted Supabase instance. Hosted email delivery, Stripe payments, Cloudflare settings, backups and restore have not been verified without your accounts.

The free pilot has a 5,000-row loading cap per operational module, the latest 100 notifications and the latest 250 audit events. Larger use requires server-side filtering and pagination. Supabase's Free plan may pause idle projects; review availability and backup needs before relying on it for daily live operations.
