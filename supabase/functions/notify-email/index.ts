// Called by a Supabase Database Webhook on notifications INSERT.
// Set WEBHOOK_SECRET and RESEND_API_KEY as Edge Function secrets.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return new Response('Unauthorized', { status: 401 });
  const apiKey = Deno.env.get('RESEND_API_KEY'),
    sender = Deno.env.get('EMAIL_FROM'),
    appUrl = Deno.env.get('APP_URL');
  if (!apiKey || !sender || !appUrl)
    return new Response('Email provider not configured', { status: 503 });
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  try {
    const event = await request.json();
    const id = event.record?.id;
    if (!id) return new Response('Missing notification ID', { status: 400 });
    const { data: notice, error } = await db
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (notice.email_sent_at) return Response.json({ already_sent: true });
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('email')
      .eq('id', notice.user_id)
      .single();
    if (profileError) throw profileError;
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `notification-${id}`,
      },
      body: JSON.stringify({
        from: sender,
        to: [profile.email],
        subject: 'Holy Sites Operations — report update',
        text: `${notice.title}\n\nOpen your workspace: ${appUrl.replace(/\/$/, '')}/incidents/${notice.report_id}\n\nSign in to view the report.`,
      }),
    });
    if (!result.ok) throw new Error(`Email provider returned ${result.status}`);
    const saved = await db
      .from('notifications')
      .update({ email_sent_at: new Date().toISOString(), email_error: null })
      .eq('id', id);
    if (saved.error) throw saved.error;
    return Response.json({ sent: true });
  } catch (error) {
    console.error(
      'Email delivery failed',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return new Response('Delivery failed; retry the webhook with the same notification ID', {
      status: 502,
    });
  }
});
