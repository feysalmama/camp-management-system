import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, ShieldCheck, Building2, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp, check } from '../context';
import { Field } from '../components/ui';

export function Auth() {
  const { toast } = useApp();
  const [mode, setMode] = useState<'login' | 'register' | 'reset' | 'confirm'>('login'),
    [busy, setBusy] = useState(false),
    [confirmationEmail, setConfirmationEmail] = useState(''),
    [deliveryError, setDeliveryError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setDeliveryError('');
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email')),
      password = String(form.get('password'));
    try {
      if (mode === 'register') {
        const data = await check(
          supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: form.get('name') },
              emailRedirectTo: window.location.origin,
            },
          }),
        );
        if (data.session) {
          toast('Account created. Choose your country and company to continue.');
        } else {
          setConfirmationEmail(email);
          setMode('confirm');
          toast('Check your email to confirm your account, then sign in.');
        }
      } else if (mode === 'confirm') {
        await check(
          supabase.auth.resend({
            type: 'signup',
            email,
            options: { emailRedirectTo: window.location.origin },
          }),
        );
        toast(
          'Confirmation requested. Check your inbox and spam folder. Delivery is subject to the project’s email provider limits.',
        );
      } else if (mode === 'reset') {
        await check(
          supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password',
          }),
        );
        toast('If an account exists, a password reset link has been sent.');
      } else await check(supabase.auth.signInWithPassword({ email, password }));
    } catch (e) {
      const error = e as { message: string; code?: string };
      const message =
        error.code === 'email_address_not_authorized'
          ? 'This project’s default email sender only supports Supabase project-team addresses. The project owner must configure custom SMTP for other recipients.'
          : error.code === 'over_email_send_rate_limit'
            ? 'The email sending limit has been reached. Wait before retrying. The default Supabase sender currently allows only two emails per hour.'
            : error.message;
      if (error.code === 'email_not_confirmed') {
        setConfirmationEmail(email);
        setMode('confirm');
      }
      setDeliveryError(message);
      toast(message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">◈</span> MANASIK <small>OPERATIONS</small>
        </div>
        <div>
          <p className="eyebrow">EVERY REPORT. EVERY RESPONSE.</p>
          <h1>
            Safer journeys
            <br />
            start with
            <br />
            <em>clear action.</em>
          </h1>
          <p>A shared workspace for the teams caring for pilgrims across the holy sites.</p>
          <div className="auth-points">
            <span>
              <Activity size={18} /> Incident reporting & escalation
            </span>
            <span>
              <Building2 size={18} /> Connected company operations
            </span>
            <span>
              <ShieldCheck size={18} /> Access built around your team
            </span>
          </div>
        </div>
        <footer>MINA · ARAFAT · MUZDALIFAH</footer>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <span className="pill">HOLY SITES OPERATIONS PLATFORM</span>
          <h2>
            {mode === 'login'
              ? 'Welcome back'
              : mode === 'register'
                ? 'Create your account'
                : mode === 'confirm'
                  ? 'Confirm your email'
                  : 'Reset your password'}
          </h2>
          <p>
            {mode === 'login'
              ? 'Sign in to your company workspace.'
              : mode === 'register'
                ? 'Create your account, then choose your country and company.'
                : mode === 'confirm'
                  ? 'Your account needs email confirmation before you can sign in. Check your inbox and spam folder.'
                  : 'We’ll send a secure link to your email.'}
          </p>
          {!supabase && (
            <div className="notice">
              Backend is not connected. Add the Supabase URL and publishable key in{' '}
              <code>.env.local</code>, apply the migrations, and restart the app. Accounts and
              reports require a connected backend.
            </div>
          )}
          {deliveryError && (
            <div className="notice error" role="alert">
              {deliveryError}
            </div>
          )}
          {mode === 'confirm' && (
            <div className="notice">
              <span>
                If no email arrives, contact your company or platform administrator to check the
                email delivery service. Wait at least a minute before requesting another message.
              </span>
            </div>
          )}
          <form onSubmit={submit}>
            {mode === 'register' && (
              <Field label="Full name">
                <input name="name" required maxLength={120} autoComplete="name" />
              </Field>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                defaultValue={confirmationEmail}
              />
            </Field>
            {mode !== 'reset' && mode !== 'confirm' && (
              <Field
                label="Password"
                hint={mode === 'register' ? 'Use at least 10 characters.' : undefined}
              >
                <input
                  name="password"
                  type="password"
                  required
                  minLength={mode === 'register' ? 10 : 1}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
              </Field>
            )}
            {mode === 'login' && (
              <button type="button" className="text-btn forgot" onClick={() => setMode('reset')}>
                Forgot password?
              </button>
            )}
            <button className="btn primary full" disabled={busy || !supabase}>
              {busy
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Sign in'
                  : mode === 'register'
                    ? 'Create account'
                    : mode === 'confirm'
                      ? 'Resend confirmation'
                      : 'Send reset link'}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {mode === 'login' ? 'New to the platform?' : 'Already have an account?'}{' '}
            <button
              className="text-btn"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
          <div className="secure-note">
            <ShieldCheck size={16} /> Your company’s workspace stays private.
          </div>
        </div>
      </section>
    </div>
  );
}

export function Onboarding() {
  const { membership, company, refresh, run, busy } = useApp();
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]),
    [country, setCountry] = useState('SA'),
    [companies, setCompanies] = useState<{ id: string; name: string }[]>([]),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState(''),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    check(supabase!.from('countries').select('*').order('name'))
      .then(setCountries)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSelected('');
    check(supabase!.rpc('company_directory', { country }))
      .then((data) => {
        if (alive) setCompanies(data || []);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [country]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await run(
      async () => {
        if (create)
          await check(
            supabase!.rpc('create_company', {
              country,
              company_name: String(form.get('company_name')),
            }),
          );
        else await check(supabase!.rpc('request_membership', { target: selected }));
      },
      create ? 'Company created. Welcome to your workspace.' : 'Membership request submitted.',
    );
  }
  return (
    <div className="onboarding">
      <div className="brand">
        <span className="brand-mark">◈</span> MANASIK
      </div>
      <section className="panel onboarding-card">
        <span className="pill">GET CONNECTED</span>
        <h1>
          {membership?.status === 'pending'
            ? 'Your request is with the company'
            : 'Choose your workspace'}
        </h1>
        {membership?.status === 'pending' ? (
          <>
            <p>
              Your request to join <strong>{company?.name}</strong> is awaiting an administrator’s
              approval.
            </p>
            <button className="btn primary" onClick={() => run(refresh)} disabled={busy}>
              Check approval status
            </button>
          </>
        ) : (
          <>
            <p>Select your country and join your company, or create a new company workspace.</p>
            {membership?.status === 'rejected' && (
              <div className="notice">
                Your previous membership was declined or removed. You can request access again.
              </div>
            )}
            {error && <div className="notice error">{error}</div>}
            <form onSubmit={submit}>
              <Field label="Country">
                <select value={country} onChange={(e) => setCountry(e.target.value)}>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="segmented">
                <button
                  type="button"
                  className={!create ? 'active' : ''}
                  onClick={() => setCreate(false)}
                >
                  Join a company
                </button>
                <button
                  type="button"
                  className={create ? 'active' : ''}
                  onClick={() => setCreate(true)}
                >
                  Create a company
                </button>
              </div>
              {create ? (
                <Field label="Company name" hint="You will become this company’s administrator.">
                  <input
                    name="company_name"
                    required
                    minLength={2}
                    maxLength={120}
                    defaultValue={countries.find((c) => c.code === country)?.name}
                  />
                </Field>
              ) : (
                <Field label="Company" hint="A company administrator must approve your membership.">
                  <select value={selected} onChange={(e) => setSelected(e.target.value)} required>
                    <option value="">{loading ? 'Loading companies…' : 'Select a company'}</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {!loading && !companies.length && (
                    <small>No companies here yet. Create the first one.</small>
                  )}
                </Field>
              )}
              <button
                disabled={busy || loading || !countries.length || (!create && !selected)}
                className="btn primary full"
              >
                {busy ? 'Saving…' : create ? 'Create workspace' : 'Request access'}
                <ArrowRight size={16} />
              </button>
            </form>
          </>
        )}
        <button className="text-btn signout" onClick={() => supabase!.auth.signOut()}>
          Sign out
        </button>
      </section>
    </div>
  );
}
export function ResetPassword() {
  const { run, busy } = useApp();
  const [done, setDone] = useState(false);
  return (
    <div className="onboarding">
      <section className="panel onboarding-card">
        <h1>Set a new password</h1>
        {done ? (
          <>
            <p>Password updated.</p>
            <a className="btn primary" href="/">
              Continue to workspace
            </a>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const password = String(new FormData(e.currentTarget).get('password'));
              if (
                await run(() => check(supabase!.auth.updateUser({ password })), 'Password updated.')
              )
                setDone(true);
            }}
          >
            <Field label="New password">
              <input
                type="password"
                name="password"
                required
                minLength={10}
                autoComplete="new-password"
              />
            </Field>
            <button className="btn primary" disabled={busy}>
              Update password
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
