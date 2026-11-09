import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Plus, Trash2, ShieldCheck } from 'lucide-react';
import { useApp, check } from '../context';
import { supabase } from '../lib/supabase';
import { Field, Modal, PageHeading, Empty, Badge } from '../components/ui';
import type { PlatformAccess } from '../lib/types';

export function Platform() {
  const navigate = useNavigate();
  const { platformAccess, companies, run, busy, session, selectCompany: chooseCompany } = useApp();
  const selectCompany = (id: string) => {
    chooseCompany(id);
    navigate('/');
  };
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]),
    [access, setAccess] = useState<PlatformAccess[]>([]),
    [modal, setModal] = useState<'company' | 'country' | 'access' | null>(null),
    [error, setError] = useState('');
  const close = useCallback(() => setModal(null), []);
  const superAdmin = platformAccess.some((a) => a.role === 'super-admin');
  const load = useCallback(async () => {
    const c = await check(supabase!.from('countries').select('*').order('name'));
    setCountries(c);
    if (superAdmin)
      setAccess((await check(supabase!.from('platform_access').select('*'))) as PlatformAccess[]);
  }, [superAdmin]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  if (!platformAccess.length) return <Empty title="Platform administration access required" />;
  return (
    <>
      <PageHeading
        eyebrow="PLATFORM ADMINISTRATION"
        title={superAdmin ? 'Countries & companies' : 'Country operations'}
        subtitle="Manage the organizations in your authorized scope. Choose a company to inspect its operations."
        actions={
          <>
            <button className="btn secondary" onClick={() => setModal('company')}>
              <Plus size={16} /> Create company
            </button>
            {superAdmin && (
              <button className="btn primary" onClick={() => setModal('access')}>
                <ShieldCheck size={16} /> Grant admin access
              </button>
            )}
          </>
        }
      />
      {error && <div className="notice error">{error}</div>}
      <section className="panel">
        <div className="panel-title">
          <h2>Company directory</h2>
          <span className="muted">{companies.length} companies</span>
        </div>
        {companies.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Country</th>
                  <th>Contact</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td className="strong">{c.name}</td>
                    <td>
                      {countries.find((n) => n.code === c.country_code)?.name || c.country_code}
                    </td>
                    <td>{c.email || 'Not provided'}</td>
                    <td>
                      <button className="btn secondary small" onClick={() => selectCompany(c.id)}>
                        Open workspace
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No companies in your scope" />
        )}
      </section>
      {superAdmin && (
        <>
          <section className="panel" style={{ marginTop: 25 }}>
            <div className="panel-title">
              <h2>Country registry</h2>
              <button className="btn secondary small" onClick={() => setModal('country')}>
                <Globe size={15} /> Add country
              </button>
            </div>
            <details className="country-details">
              <summary>{countries.length} countries and territories · Expand registry</summary>
              <div className="country-grid">
                {countries.map((c) => (
                  <div key={c.code}>
                    <span>
                      <strong>{c.code}</strong> {c.name}
                    </span>
                    <button
                      className="icon-btn danger"
                      disabled={busy}
                      aria-label={`Delete country ${c.name}`}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${c.name}? Countries with companies cannot be deleted.`,
                          )
                        )
                          void run(async () => {
                            await check(supabase!.from('countries').delete().eq('code', c.code));
                            await load();
                          }, 'Country deleted.');
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          </section>
          <section className="panel" style={{ marginTop: 25 }}>
            <div className="panel-title">
              <h2>Privileged access</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Account ID</th>
                    <th>Scope</th>
                    <th>Role</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {access.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <code>{a.user_id}</code>
                      </td>
                      <td>{a.country_code || 'All countries'}</td>
                      <td>
                        <Badge value={a.role} />
                      </td>
                      <td>
                        {a.user_id !== session!.user.id && (
                          <button
                            disabled={busy}
                            className="btn small secondary"
                            onClick={() => {
                              if (window.confirm('Revoke this privileged access?'))
                                void run(async () => {
                                  await check(
                                    supabase!.from('platform_access').delete().eq('id', a.id),
                                  );
                                  await load();
                                }, 'Access revoked.');
                            }}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {modal && (
        <Modal
          title={
            modal === 'company'
              ? 'Create managed company'
              : modal === 'country'
                ? 'Add country'
                : 'Grant privileged access'
          }
          close={close}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await run(async () => {
                  if (modal === 'company')
                    await check(
                      supabase!.from('companies').insert({
                        name: String(f.get('name')),
                        country_code: String(f.get('country')),
                        created_by: session!.user.id,
                      }),
                    );
                  if (modal === 'country')
                    await check(
                      supabase!.from('countries').upsert({
                        code: String(f.get('code')).toUpperCase(),
                        name: String(f.get('name')),
                      }),
                    );
                  if (modal === 'access') {
                    const accounts = await check(
                      supabase!.rpc('lookup_account', { account_email: String(f.get('email')) }),
                    );
                    if (!accounts.length)
                      throw new Error('This email must register an account first.');
                    await check(
                      supabase!.from('platform_access').insert({
                        user_id: accounts[0].id,
                        role: f.get('role'),
                        country_code: f.get('role') === 'super-admin' ? null : f.get('country'),
                      }),
                    );
                  }
                  await load();
                }, 'Platform record saved.')
              )
                close();
            }}
          >
            {modal === 'access' ? (
              <>
                <Field label="Registered account email">
                  <input name="email" type="email" required />
                </Field>
                <Field label="Role">
                  <select name="role">
                    <option value="country-admin">Country administrator</option>
                    <option value="super-admin">Super administrator</option>
                  </select>
                </Field>
                <p className="muted">
                  Country administrators oversee reports and operations for companies in their
                  country. Super administrators can manage company membership and privileged access.
                </p>
              </>
            ) : (
              <>
                <Field label={modal === 'company' ? 'Company name' : 'Country name'}>
                  <input name="name" required minLength={2} maxLength={120} />
                </Field>
                {modal === 'country' && (
                  <Field label="Two-letter ISO code">
                    <input name="code" required pattern="[A-Za-z]{2}" maxLength={2} />
                  </Field>
                )}
              </>
            )}
            {modal !== 'country' && (
              <Field label="Country">
                <select name="country" required>
                  {countries
                    .filter(
                      (c) => superAdmin || platformAccess.some((a) => a.country_code === c.code),
                    )
                    .map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <div className="form-actions">
              <button type="button" className="btn secondary" onClick={close}>
                Cancel
              </button>
              <button className="btn primary" disabled={busy}>
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
