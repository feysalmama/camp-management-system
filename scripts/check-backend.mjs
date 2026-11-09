import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY)
  throw new Error('Add the Project URL and publishable key to .env.local first.');
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const settings = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/settings`, {
  headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY },
});
const authConfig = settings.ok ? await settings.json() : null;
// This deliberately runs without a user session. The application grants table access
// only to authenticated users, so PostgreSQL 42501 is the expected healthy result.
const tables = [
  'countries',
  'profiles',
  'companies',
  'memberships',
  'camps',
  'service_providers',
  'issue_types',
  'service_reports',
  'situation_reports',
  'comments',
  'attachments',
  'activity_logs',
  'notifications',
  'platform_access',
  'movements',
  'camp_vacatings',
  'subscriptions',
];
const checks = await Promise.all(
  tables.map(async (table) => {
    const { error } = await client.from(table).select('*').limit(1);
    return {
      table,
      schemaPresent: !error || error.code === '42501',
      anonymousAccessBlocked: error?.code === '42501',
      unexpectedError:
        error && error.code !== '42501' ? { code: error.code, message: error.message } : null,
    };
  }),
);
const healthy =
  settings.ok && checks.every((check) => check.schemaPresent && check.anonymousAccessBlocked);
console.log(
  JSON.stringify(
    {
      authReachable: settings.ok,
      emailSignupEnabled: authConfig?.external?.email,
      emailConfirmationRequired: authConfig ? !authConfig.mailer_autoconfirm : null,
      signupDisabled: authConfig?.disable_signup,
      tablesVerified: checks.length,
      databaseSchemaPresent: checks.every((check) => check.schemaPresent),
      anonymousAccessBlocked: checks.every((check) => check.anonymousAccessBlocked),
      issues: checks.filter((check) => !check.schemaPresent || !check.anonymousAccessBlocked),
    },
    null,
    2,
  ),
);
if (!healthy) process.exitCode = 1;
