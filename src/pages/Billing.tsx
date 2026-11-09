import { useCallback, useEffect, useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import { useApp, check } from '../context';
import { supabase } from '../lib/supabase';
import { Badge, Empty, PageHeading } from '../components/ui';
import { dateTime } from '../lib/workflow';

export function Billing() {
  const { company, membership, run, busy } = useApp();
  const [subscription, setSubscription] = useState<{
      status: string;
      current_period_end: string | null;
      stripe_customer_id: string | null;
    } | null>(null),
    [error, setError] = useState('');
  const enabled = import.meta.env.VITE_BILLING_ENABLED === 'true';
  const load = useCallback(async () => {
    const result = await check(
      supabase!.from('subscriptions').select('*').eq('company_id', company!.id).maybeSingle(),
    );
    setSubscription(result);
  }, [company]);
  useEffect(() => {
    if (membership?.role === 'company-admin') load().catch((e) => setError(e.message));
  }, [load, membership]);
  if (membership!.role !== 'company-admin')
    return <Empty title="Company administrator access required" />;
  async function open(action: string) {
    await run(async () => {
      const { data, error } = await supabase!.functions.invoke('billing', {
        body: { company_id: company!.id, action },
      });
      if (error) {
        let message = error.message;
        try {
          const detail = await error.context.json();
          message = detail.error || message;
        } catch {
          /* Keep provider error. */
        }
        throw new Error(message);
      }
      if (!data?.url) throw new Error(data?.error || 'No billing link returned.');
      const url = new URL(data.url);
      if (
        !['checkout.stripe.com', 'billing.stripe.com'].includes(url.hostname) ||
        url.protocol !== 'https:'
      )
        throw new Error('Invalid payment provider URL');
      window.location.assign(url.toString());
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="COMPANY ADMINISTRATION"
        title="Billing"
        subtitle="Manage your company’s optional subscription through Stripe."
      />
      <section className="panel form-panel">
        <CreditCard size={28} className="tone-green" />
        <h2 style={{ marginTop: 20 }}>Workspace subscription</h2>
        {error && <div className="notice error">{error}</div>}
        <div className="detail-badges">
          <Badge value={subscription?.status || 'free'} />
          {subscription?.current_period_end && (
            <span>Current period ends {dateTime(subscription.current_period_end)}</span>
          )}
        </div>
        {enabled ? (
          <>
            <p className="muted">
              Subscription prices, billing frequency, and terms are displayed in Stripe Checkout
              before you confirm payment. Core reporting remains available on the free workspace.
            </p>
            <div className="form-actions">
              {subscription?.stripe_customer_id && (
                <button className="btn secondary" disabled={busy} onClick={() => open('portal')}>
                  Manage billing <ExternalLink size={15} />
                </button>
              )}
              {(!subscription ||
                ['free', 'canceled', 'incomplete_expired'].includes(subscription.status)) && (
                <button className="btn primary" disabled={busy} onClick={() => open('checkout')}>
                  View subscription checkout <ExternalLink size={15} />
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="notice">
            Paid subscriptions are not currently offered. Your company can use the free workspace.
          </div>
        )}
      </section>
    </>
  );
}
