import { beforeEach, describe, expect, it, vi } from 'vitest';
let handler: (request: Request) => Promise<Response>;
let secrets: Record<string, string>;
beforeEach(() => {
  vi.resetModules();
  secrets = {};
  vi.stubGlobal('Deno', {
    env: { get: (key: string) => secrets[key] },
    serve: (fn: typeof handler) => {
      handler = fn;
    },
  });
});
describe('External integration authentication', () => {
  it('refuses unauthenticated email webhook requests', async () => {
    secrets.WEBHOOK_SECRET = 'private-test-secret';
    await import('../supabase/functions/notify-email/index.ts');
    const result = await handler(
      new Request('https://example.test', { method: 'POST', body: '{}' }),
    );
    expect(result.status).toBe(401);
  });
  it('does not send emails when the provider is unconfigured', async () => {
    secrets.WEBHOOK_SECRET = 'private-test-secret';
    await import('../supabase/functions/notify-email/index.ts');
    const result = await handler(
      new Request('https://example.test', {
        method: 'POST',
        headers: { Authorization: 'Bearer private-test-secret' },
        body: '{}',
      }),
    );
    expect(result.status).toBe(503);
  });
  it('leaves checkout unavailable when no paid plan is configured', async () => {
    await import('../supabase/functions/billing/index.ts');
    const result = await handler(
      new Request('https://example.test', { method: 'POST', body: '{}' }),
    );
    expect(result.status).toBe(503);
  });
  it('rejects forged Stripe webhook signatures', async () => {
    secrets.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    await import('../supabase/functions/stripe-webhook/index.ts');
    const timestamp = Math.floor(Date.now() / 1000);
    const result = await handler(
      new Request('https://example.test', {
        method: 'POST',
        headers: { 'stripe-signature': `t=${timestamp},v1=${'0'.repeat(64)}` },
        body: '{}',
      }),
    );
    expect(result.status).toBe(400);
    expect(await result.text()).toBe('Invalid signature');
  });
  it('rejects replayed old Stripe signatures', async () => {
    secrets.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    await import('../supabase/functions/stripe-webhook/index.ts');
    const result = await handler(
      new Request('https://example.test', {
        method: 'POST',
        headers: { 'stripe-signature': `t=1,v1=${'0'.repeat(64)}` },
        body: '{}',
      }),
    );
    expect(await result.text()).toBe('Invalid timestamp');
  });
  it('accepts a correctly signed irrelevant Stripe event without database access', async () => {
    secrets.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    await import('../supabase/functions/stripe-webhook/index.ts');
    const timestamp = Math.floor(Date.now() / 1000);
    const raw = JSON.stringify({ type: 'some.unhandled.event' });
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secrets.STRIPE_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = Array.from(
      new Uint8Array(
        await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${raw}`)),
      ),
    )
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const response = await handler(
      new Request('https://example.test', {
        method: 'POST',
        headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` },
        body: raw,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ignored: true });
  });
});
