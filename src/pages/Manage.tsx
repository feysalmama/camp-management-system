import { useCallback, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Search, ShieldCheck, Download } from 'lucide-react';
import { useApp, check } from '../context';
import { supabase } from '../lib/supabase';
import { Badge, Empty, Field, Modal, PageHeading } from '../components/ui';
import { dateTime, downloadCsv, isManager, label, roles, severities } from '../lib/workflow';
import type { Membership, Camp, Provider, IssueType } from '../lib/types';

type Entity = 'camps' | 'providers' | 'issueTypes';
const config = {
  camps: {
    title: 'Camps',
    single: 'camp',
    table: 'camps',
    subtitle: 'Keep camp details and locations organized.',
    fields: [
      ['name', 'Camp name', 'text'],
      ['camp_number', 'Camp number', 'text'],
      ['location', 'Location', 'text'],
      ['capacity', 'Capacity', 'number'],
    ],
  },
  providers: {
    title: 'Service providers',
    single: 'service provider',
    table: 'service_providers',
    subtitle: 'The service partners supporting your operations.',
    fields: [
      ['name', 'Provider name', 'text'],
      ['category', 'Service category', 'text'],
      ['phone', 'Phone', 'tel'],
      ['email', 'Email', 'email'],
    ],
  },
  issueTypes: {
    title: 'Issue types',
    single: 'issue type',
    table: 'issue_types',
    subtitle: 'Define the categories your field teams use to report incidents.',
    fields: [
      ['name', 'Issue type name', 'text'],
      ['description', 'Description', 'text'],
    ],
  },
} as const;
export function Manage({ entity }: { entity: Entity }) {
  const { data, membership, company, run, busy } = useApp();
  const [editing, setEditing] = useState<Camp | Provider | IssueType | null | undefined>(undefined),
    [search, setSearch] = useState('');
  const close = useCallback(() => setEditing(undefined), []);
  const cfg = config[entity];
  const manager = isManager(membership!.role);
  const rows = data[entity].filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = { company_id: company!.id };
    cfg.fields.forEach(
      ([key, , type]) =>
        (payload[key] = type === 'number' ? Number(form.get(key)) : String(form.get(key))),
    );
    if (entity === 'issueTypes') {
      payload.severity_default = form.get('severity_default');
      payload.is_active = form.get('is_active') === 'true';
    } else payload.status = form.get('status');
    if (
      await run(
        () =>
          check(
            editing
              ? supabase!.from(cfg.table).update(payload).eq('id', editing.id)
              : supabase!.from(cfg.table).insert(payload),
          ),
        `${label(cfg.single)} saved.`,
      )
    )
      close();
  }
  return (
    <>
      <PageHeading
        eyebrow="ORGANIZATION MANAGEMENT"
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={
          manager && (
            <button className="btn primary" onClick={() => setEditing(null)}>
              <Plus size={17} /> Add {cfg.single}
            </button>
          )
        }
      />
      <section className="panel">
        <div className="filters">
          <label className="search">
            <Search size={17} />
            <input
              value={search}
              aria-label={`Search ${cfg.title}`}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${cfg.title.toLowerCase()}…`}
            />
          </label>
          <span className="muted">{rows.length} records</span>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {cfg.fields.map(([key, name]) => (
                    <th key={key}>{name}</th>
                  ))}
                  {entity === 'issueTypes' && <th>Default severity</th>}
                  <th>Status</th>
                  {manager && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const r = row as unknown as Record<string, unknown>;
                  return (
                    <tr key={row.id}>
                      {cfg.fields.map(([key], i) => (
                        <td key={key} className={i === 0 ? 'strong' : ''}>
                          {String(r[key] ?? '—')}
                        </td>
                      ))}
                      {entity === 'issueTypes' && (
                        <td>
                          <Badge value={String(r.severity_default)} />
                        </td>
                      )}
                      <td>
                        <Badge
                          value={
                            entity === 'issueTypes'
                              ? r.is_active
                                ? 'active'
                                : 'inactive'
                              : String(r.status)
                          }
                        />
                      </td>
                      {manager && (
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-btn"
                              aria-label={`Edit ${row.name}`}
                              onClick={() => setEditing(row)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="icon-btn danger"
                              aria-label={`Delete ${row.name}`}
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete ${row.name}? Referenced records cannot be deleted; deactivate them instead.`,
                                  )
                                )
                                  void run(
                                    () =>
                                      check(supabase!.from(cfg.table).delete().eq('id', row.id)),
                                    `${label(cfg.single)} deleted.`,
                                  );
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={`No ${cfg.title.toLowerCase()} found`}>
            Add records to prepare your team’s reporting workspace.
          </Empty>
        )}
      </section>
      {editing !== undefined && (
        <Modal title={`${editing ? 'Edit' : 'Add'} ${cfg.single}`} close={close}>
          <form onSubmit={submit}>
            {cfg.fields.map(([key, name, type]) => (
              <Field label={name} key={key}>
                <input
                  name={key}
                  type={type}
                  required={!['phone', 'email', 'description'].includes(key)}
                  min={type === 'number' ? 0 : undefined}
                  maxLength={type === 'number' ? undefined : 500}
                  defaultValue={
                    editing
                      ? String((editing as unknown as Record<string, unknown>)[key])
                      : type === 'number'
                        ? '0'
                        : ''
                  }
                />
              </Field>
            ))}
            {entity === 'issueTypes' ? (
              <>
                <Field label="Default severity">
                  <select
                    name="severity_default"
                    defaultValue={(editing as IssueType)?.severity_default || 'medium'}
                  >
                    {severities.map((s) => (
                      <option value={s} key={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    name="is_active"
                    defaultValue={(editing as IssueType)?.is_active === false ? 'false' : 'true'}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </Field>
              </>
            ) : (
              <Field label="Status">
                <select name="status" defaultValue={(editing as Camp)?.status || 'active'}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            )}
            <div className="form-actions">
              <button type="button" className="btn secondary" onClick={close}>
                Cancel
              </button>
              <button className="btn primary" disabled={busy}>
                Save {cfg.single}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Team() {
  const { data, membership, run, busy } = useApp();
  const admin = membership!.role === 'company-admin';
  const [editing, setEditing] = useState<Membership | null>(null);
  const close = useCallback(() => setEditing(null), []);
  const [search, setSearch] = useState('');
  const members = data.members.filter((m) =>
    `${m.profiles?.full_name} ${m.profiles?.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="PEOPLE & ACCESS"
        title="Your team"
        subtitle="Review membership requests and give each person the right access."
      />
      <div className="notice">
        <ShieldCheck size={18} />
        <span>
          New team members register with their own email, choose your country and company, then
          request access.{' '}
          {admin ? 'Approve requests below.' : 'Your company administrator manages access.'}
        </span>
      </div>
      <section className="panel">
        <div className="filters">
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Search team"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team member</th>
                <th>Email</th>
                <th>Role</th>
                <th>Membership</th>
                {admin && <th />}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="strong">
                    {m.profiles?.full_name || 'Team member'}
                    {m.user_id === membership!.user_id && <span className="you">You</span>}
                  </td>
                  <td>{m.profiles?.email || '—'}</td>
                  <td>{label(m.role)}</td>
                  <td>
                    <Badge value={m.status} />
                  </td>
                  {admin && (
                    <td>
                      {m.user_id !== membership!.user_id && (
                        <button className="btn small secondary" onClick={() => setEditing(m)}>
                          Manage access
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing && (
        <Modal title={`Manage ${editing.profiles?.full_name || 'member'}`} close={close}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await run(
                  () =>
                    check(
                      supabase!.rpc('review_membership', {
                        member_id: editing.id,
                        new_role: String(f.get('role')),
                        new_status: String(f.get('status')),
                      }),
                    ),
                  'Access updated.',
                )
              )
                close();
            }}
          >
            <Field label="Role">
              <select name="role" defaultValue={editing.role}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {label(r)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Access">
              <select
                name="status"
                defaultValue={
                  editing.status === 'active'
                    ? 'active'
                    : editing.status === 'rejected'
                      ? 'rejected'
                      : 'active'
                }
              >
                <option value="active">Approve / Active</option>
                <option value="rejected">Reject / Remove access</option>
              </select>
            </Field>
            <p className="muted">
              Viewers can read reports. Field roles can submit and update incidents. Supervisors can
              escalate and approve reports. Company admins also manage membership.
            </p>
            <div className="form-actions">
              <button type="button" className="btn secondary" onClick={close}>
                Cancel
              </button>
              <button disabled={busy} className="btn primary">
                Save access
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Audit() {
  const { data, membership } = useApp();
  if (!isManager(membership!.role)) return <Empty title="Supervisor access required" />;
  return (
    <>
      <PageHeading
        eyebrow="ACCOUNTABILITY"
        title="Audit history"
        subtitle="Database-recorded changes to your company’s operational records. Latest 250 events."
        actions={
          <button
            className="btn secondary"
            disabled={!data.activities.length}
            onClick={() =>
              downloadCsv(
                data.activities.map((a) => ({
                  Time: a.created_at,
                  Action: a.action,
                  Entity: a.entity_type,
                  Record: a.entity_id,
                  User: a.user_id,
                  Before: JSON.stringify(a.old_data),
                  After: JSON.stringify(a.new_data),
                })),
                'audit-history.csv',
              )
            }
          >
            <Download size={16} /> Export history
          </button>
        }
      />
      <section className="panel">
        {data.activities.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Record</th>
                  <th>By</th>
                  <th>When</th>
                  <th>Changes</th>
                </tr>
              </thead>
              <tbody>
                {data.activities.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Badge value={a.action} />
                      <small>{label(a.entity_type)}</small>
                    </td>
                    <td>
                      <code>{a.entity_id.slice(0, 8)}</code>
                    </td>
                    <td>
                      {data.members.find((m) => m.user_id === a.user_id)?.profiles?.full_name ||
                        'System'}
                    </td>
                    <td className="nowrap">{dateTime(a.created_at)}</td>
                    <td>
                      <details>
                        <summary>View record</summary>
                        <pre>
                          {JSON.stringify({ before: a.old_data, after: a.new_data }, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No activity recorded" />
        )}
      </section>
    </>
  );
}
export function Settings() {
  const { company, membership, session, run, busy } = useApp();
  return (
    <>
      <PageHeading
        title="Workspace settings"
        subtitle="Company details and your account information."
      />
      <div className="settings-grid">
        <section className="panel form-panel">
          <h2>Company profile</h2>
          <form
            key={company!.id}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await run(
                () =>
                  check(
                    supabase!
                      .from('companies')
                      .update(
                        Object.fromEntries(
                          ['name', 'email', 'phone', 'address', 'status'].map((key) => [
                            key,
                            String(f.get(key)),
                          ]),
                        ),
                      )
                      .eq('id', company!.id),
                  ),
                'Company profile updated.',
              );
            }}
          >
            {(['name', 'email', 'phone', 'address'] as const).map((key) => (
              <Field key={key} label={label(key)}>
                <input
                  name={key}
                  type={key === 'email' ? 'email' : 'text'}
                  required={key === 'name'}
                  minLength={key === 'name' ? 2 : undefined}
                  maxLength={key === 'name' ? 120 : 500}
                  defaultValue={company![key]}
                  disabled={membership!.role !== 'company-admin'}
                />
              </Field>
            ))}
            <Field
              label="Company status"
              hint="Inactive companies stop accepting new membership requests and field report changes."
            >
              <select
                name="status"
                defaultValue={company!.status}
                disabled={membership!.role !== 'company-admin'}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label="Country">
              <input value={company!.country_code} readOnly />
            </Field>
            {membership!.role === 'company-admin' && (
              <button className="btn primary" disabled={busy}>
                Save company details
              </button>
            )}
          </form>
        </section>
        <section className="panel form-panel">
          <h2>Your account</h2>
          <dl className="metadata vertical">
            <div>
              <dt>Name</dt>
              <dd>{session?.user.user_metadata.full_name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{session?.user.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{label(membership!.role)}</dd>
            </div>
          </dl>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  check(
                    supabase!.auth.resetPasswordForEmail(session!.user.email!, {
                      redirectTo: window.location.origin + '/reset-password',
                    }),
                  ),
                'Password reset email sent.',
              )
            }
          >
            Send password reset email
          </button>
          <hr />
          <h3>Reporting exports</h3>
          <p className="muted">
            Open a Tool 9 or Tool 10 report and choose Print / PDF. Use your browser’s Save as PDF
            option. CSV exports are available in the incident log and audit history.
          </p>
        </section>
      </div>
    </>
  );
}
