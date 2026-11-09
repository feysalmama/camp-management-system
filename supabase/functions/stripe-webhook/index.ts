import { createClient } from 'npm:@supabase/supabase-js@2';
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) return new Response('Not configured', { status: 503 });
  const raw = await request.text();
  const parts = (request.headers.get('stripe-signature') || '').split(',');
  const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
  )
    return new Response('Invalid timestamp', { status: 400 });
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  let valid = false;
  for (const signature of signatures) {
    if (!/^[a-f0-9]{64}$/i.test(signature)) continue;
    const bytes = new Uint8Array(signature.match(/../g)!.map((h) => parseInt(h, 16)));
    if (
      await crypto.subtle.verify(
        'HMAC',
        key,
        bytes,
        new TextEncoder().encode(`${timestamp}.${raw}`),
      )
    )
      valid = true;
  }
  if (!valid) return new Response('Invalid signature', { status: 400 });
  try {
    const event = JSON.parse(raw);
    if (
      ![
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
      ].includes(event.type)
    )
      return Response.json({ ignored: true });
    const object = event.data.object;
    // Fetch the current subscription to avoid regressing state when webhooks arrive out of order.
    const response = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(object.id)}`,
      { headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` } },
    );
    if (!response.ok) throw new Error('Could not fetch current subscription');
    const subscription = await response.json();
    const companyId = subscription.metadata?.company_id;
    if (!companyId) return new Response('Missing company metadata', { status: 400 });
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: existing, error } = await db
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('company_id', companyId)
      .single();
    if (error || existing.stripe_customer_id !== subscription.customer)
      return new Response('Customer mismatch', { status: 400 });
    const end =
      subscription.items?.data?.[0]?.current_period_end || subscription.current_period_end;
    const saved = await db
      .from('subscriptions')
      .update({
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_end: end ? new Date(end * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId);
    if (saved.error) throw saved.error;
    return Response.json({ received: true });
  } catch (error) {
    console.error(
      'Stripe webhook failed',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return new Response('Retry later', { status: 500 });
  }
});
