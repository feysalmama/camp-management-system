import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (request: Request) => {
  const origin = Deno.env.get('APP_URL') || '';
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY'),
    price = Deno.env.get('STRIPE_PRICE_ID');
  if (!stripeKey || !price || !origin)
    return respond(
      {
        error:
          'Billing has not been configured by the platform owner. The free workspace remains available.',
      },
      503,
    );
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return respond({ error: 'Sign in first' }, 401);
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: user, error: authError } = await client.auth.getUser(token);
  if (authError || !user.user) return respond({ error: 'Invalid session' }, 401);
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  try {
    const { company_id, action } = await request.json();
    const { data: role, error } = await client.rpc('company_role', { target: company_id });
    if (error || role !== 'company-admin')
      return respond({ error: 'Company administrator required' }, 403);
    const company = await client.from('companies').select('id,name').eq('id', company_id).single();
    if (company.error) throw company.error;
    const stripe = async (path: string, values: Record<string, string>, idempotency?: string) => {
      const result = await fetch(`https://api.stripe.com/v1/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(idempotency ? { 'Idempotency-Key': idempotency } : {}),
        },
        body: new URLSearchParams(values),
      });
      const json = await result.json();
      if (!result.ok) throw new Error(json.error?.message || 'Payment provider unavailable');
      return json;
    };
    const { data: subscription, error: subscriptionError } = await db
      .from('subscriptions')
      .select('*')
      .eq('company_id', company_id)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;
    let customer = subscription?.stripe_customer_id;
    if (action === 'portal') {
      if (!customer)
        return respond({ error: 'No billing account yet. Start a subscription first.' }, 400);
      const portal = await stripe('billing_portal/sessions', {
        customer,
        return_url: `${origin}/billing`,
      });
      return respond({ url: portal.url });
    }
    if (action !== 'checkout') return respond({ error: 'Unknown billing action' }, 400);
    if (['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(subscription?.status))
      return respond(
        { error: 'This company already has a subscription. Use Manage billing.' },
        409,
      );
    if (!customer) {
      const created = await stripe(
        'customers',
        { name: company.data.name, email: user.user.email!, 'metadata[company_id]': company_id },
        `company-${company_id}`,
      );
      customer = created.id;
      const saved = await db
        .from('subscriptions')
        .upsert({ company_id, stripe_customer_id: customer, status: 'free' });
      if (saved.error) throw saved.error;
    }
    const checkout = await stripe(
      'checkout/sessions',
      {
        mode: 'subscription',
        customer,
        'line_items[0][price]': price,
        'line_items[0][quantity]': '1',
        'subscription_data[metadata][company_id]': company_id,
        success_url: `${origin}/billing?checkout=success`,
        cancel_url: `${origin}/billing?checkout=cancelled`,
      },
      `checkout-${company_id}-${Math.floor(Date.now() / 600000)}`,
    );
    return respond({ url: checkout.url });
  } catch (error) {
    return respond(
      { error: error instanceof Error ? error.message : 'Billing request failed' },
      400,
    );
  }
});
