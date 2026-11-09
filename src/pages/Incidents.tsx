import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Download,
  Search,
  ArrowLeft,
  Paperclip,
  Send,
  ArrowUpRight,
  Printer,
  Trash2,
  FileText,
} from 'lucide-react';
import { useEffect } from 'react';
import { useApp, check } from '../context';
import { supabase } from '../lib/supabase';
import type { Incident, Comment, Attachment, IncidentStatus } from '../lib/types';
import {
  canWrite,
  isManager,
  statuses,
  severities,
  label,
  dateTime,
  downloadCsv,
  nextStatuses,
} from '../lib/workflow';
import { Badge, Empty, Field, PageHeading } from '../components/ui';

export function Incidents() {
  const { data, membership } = useApp();
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [severity, setSeverity] = useState(''),
    [page, setPage] = useState(1);
  const rows = data.incidents.filter(
    (r) =>
      (!status || r.status === status) &&
      (!severity || r.severity === severity) &&
      `${r.title} ${r.report_no} ${r.location}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="TOOL 9 · SERVICE REPORTS LOG"
        title="Incident reports"
        subtitle="Track field issues from the first report to the final action."
        actions={
          <>
            <button
              className="btn secondary"
              disabled={!rows.length}
              onClick={() =>
                downloadCsv(
                  rows.map((r) => ({
                    Reference: r.report_no,
                    Title: r.title,
                    Severity: r.severity,
                    Status: r.status,
                    Location: r.location,
                    Description: r.description,
                    Action: r.action_taken,
                    Reported: r.reported_at,
                  })),
                  'tool-9-reports.csv',
                )
              }
            >
              <Download size={16} /> Export CSV
            </button>
            {canWrite(membership!.role) && (
              <Link className="btn primary" to="/incidents/new">
                <Plus size={17} /> Report incident
              </Link>
            )}
          </>
        }
      />
      <section className="panel">
        <div className="filters">
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Search incidents"
              placeholder="Search reference, title, or location…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            aria-label="Filter status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter severity"
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All severities</option>
            {severities.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
        {rows.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Incident / Reference</th>
                    <th>Location</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Reported</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.slice((page - 1) * 15, page * 15).map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link className="row-title" to={`/incidents/${r.id}`}>
                          {r.title}
                        </Link>
                        <small className="reference">{r.report_no}</small>
                      </td>
                      <td>{r.location}</td>
                      <td>
                        <Badge value={r.severity} />
                      </td>
                      <td>
                        <Badge value={r.status} />
                      </td>
                      <td className="muted nowrap">{dateTime(r.reported_at)}</td>
                      <td>
                        <Link to={`/incidents/${r.id}`} aria-label={`Open ${r.report_no}`}>
                          <ArrowUpRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>{rows.length} reports</span>
              <div>
                <button
                  className="btn small secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {Math.ceil(rows.length / 15)}
                </span>
                <button
                  className="btn small secondary"
                  disabled={page * 15 >= rows.length}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty title="No incidents found">Try different filters, or submit a new report.</Empty>
        )}
      </section>
    </>
  );
}
function IncidentFields({ report }: { report?: Incident }) {
  const { data } = useApp();
  const [issue, setIssue] = useState(report?.issue_type_id || ''),
    [severity, setSeverity] = useState(report?.severity || 'medium');
  return (
    <>
      <div className="form-grid">
        <Field label="Incident title">
          <input
            name="title"
            required
            minLength={3}
            maxLength={200}
            defaultValue={report?.title}
            placeholder="Briefly describe the issue"
          />
        </Field>
        <Field label="Issue type">
          <select
            name="issue_type_id"
            value={issue}
            required
            onChange={(e) => {
              setIssue(e.target.value);
              setSeverity(
                data.issueTypes.find((t) => t.id === e.target.value)?.severity_default || 'medium',
              );
            }}
          >
            <option value="">Select an issue type</option>
            {data.issueTypes
              .filter((t) => t.is_active || t.id === report?.issue_type_id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Severity">
          <select
            name="severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as typeof severity)}
          >
            {severities.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Camp (optional)">
          <select name="camp_id" defaultValue={report?.camp_id || ''}>
            <option value="">No camp / off-site</option>
            {data.camps
              .filter((c) => c.status === 'active' || c.id === report?.camp_id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.camp_number} · {c.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Location">
          <input
            name="location"
            required
            maxLength={200}
            defaultValue={report?.location}
            placeholder="Site, zone, street, or meeting point"
          />
        </Field>
        <Field label="Assign to (optional)">
          <select name="assigned_to" defaultValue={report?.assigned_to || ''}>
            <option value="">Unassigned</option>
            {data.members
              .filter((m) => m.status === 'active')
              .map((m) => (
                <option key={m.id} value={m.user_id}>
                  {m.profiles?.full_name || m.profiles?.email}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Service provider (optional)">
          <select name="provider_id" defaultValue={report?.provider_id || ''}>
            <option value="">No provider assigned</option>
            {data.providers
              .filter((p) => p.status === 'active' || p.id === report?.provider_id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
      </div>
      <Field label="What happened?">
        <textarea
          name="description"
          required
          rows={5}
          maxLength={10000}
          defaultValue={report?.description}
          placeholder="Describe the situation and who or what is affected."
        />
      </Field>
      <Field label="Immediate action taken">
        <textarea
          name="action_taken"
          rows={3}
          maxLength={10000}
          defaultValue={report?.action_taken}
          placeholder="Record the initial response and steps already taken."
        />
      </Field>
    </>
  );
}
function incidentPayload(form: HTMLFormElement) {
  const f = new FormData(form);
  return {
    title: String(f.get('title')),
    issue_type_id: String(f.get('issue_type_id')),
    severity: String(f.get('severity')),
    camp_id: f.get('camp_id') || null,
    assigned_to: f.get('assigned_to') || null,
    provider_id: f.get('provider_id') || null,
    location: String(f.get('location')),
    description: String(f.get('description')),
    action_taken: String(f.get('action_taken')),
  };
}
export function NewIncident() {
  const { company, membership, busy, run, data } = useApp();
  const navigate = useNavigate();
  if (!canWrite(membership!.role))
    return (
      <Empty title="View-only access">
        Ask your company administrator for reporting permissions.
      </Empty>
    );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const status = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') || 'open';
    let id = '';
    if (
      await run(async () => {
        const r = await check(
          supabase!
            .from('service_reports')
            .insert({ ...incidentPayload(form), company_id: company!.id, status })
            .select('id')
            .single(),
        );
        id = r.id;
      }, 'Incident saved.')
    )
      navigate(`/incidents/${id}`);
  }
  return (
    <>
      <Link className="back-link" to="/incidents">
        <ArrowLeft size={16} /> All incidents
      </Link>
      <PageHeading
        eyebrow="TOOL 9 · NEW REPORT"
        title="Report an incident"
        subtitle="Capture the facts and the immediate response from the field."
      />
      <section className="panel form-panel">
        {!data.issueTypes.some((t) => t.is_active) ? (
          <Empty title="Add an issue type first">
            A supervisor or company administrator can add issue types in the management section.
          </Empty>
        ) : (
          <form onSubmit={submit}>
            <IncidentFields />
            <div className="form-actions">
              <Link className="btn secondary" to="/incidents">
                Cancel
              </Link>
              <button className="btn secondary" value="draft" disabled={busy}>
                Save draft
              </button>
              <button className="btn primary" value="open" disabled={busy}>
                {busy ? 'Saving…' : 'Submit report'}
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
export function IncidentDetail() {
  const { id } = useParams();
  const { data, membership, company, run, busy, toast } = useApp();
  const r = data.incidents.find((i) => i.id === id);
  const [editing, setEditing] = useState(false),
    [comments, setComments] = useState<Comment[]>([]),
    [files, setFiles] = useState<Attachment[]>([]),
    [detailError, setDetailError] = useState('');
  const navigate = useNavigate();
  async function loadDetail() {
    const [c, a] = await Promise.all([
      check(supabase!.from('comments').select('*').eq('report_id', id!).order('created_at')),
      check(supabase!.from('attachments').select('*').eq('report_id', id!).order('created_at')),
    ]);
    setComments(c || []);
    setFiles(a || []);
  }
  useEffect(() => {
    loadDetail().catch((e) => setDetailError(e.message));
  }, [id]);
  if (!r)
    return (
      <Empty title="Report not found">
        This report may not belong to your company. <Link to="/incidents">Return to reports</Link>
      </Empty>
    );
  const report = r;
  const write = canWrite(membership!.role) && r.status !== 'closed';
  const manager = isManager(membership!.role);
  const linked = data.sitreps.find((s) => s.service_report_id === id);
  const person = (uid: string | null) =>
    data.members.find((m) => m.user_id === uid)?.profiles?.full_name || 'Unassigned';
  async function updateStatus(status: IncidentStatus) {
    await run(
      () => check(supabase!.from('service_reports').update({ status }).eq('id', report.id)),
      'Status updated.',
    );
  }
  async function escalate() {
    let sid = '';
    if (
      await run(async () => {
        sid = await check(supabase!.rpc('escalate_incident', { incident_id: report.id }));
      }, 'Situation report ready for review.')
    )
      navigate(`/situation-reports/${sid}`);
  }
  async function upload(file: File) {
    await run(async () => {
      if (file.size > 10 * 1024 * 1024) throw new Error('Maximum file size is 10 MB.');
      const allowed = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowed.includes(file.type))
        throw new Error('Choose a JPG, PNG, WebP, PDF, TXT, or DOCX file.');
      const path = `${company!.id}/${report.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      await check(supabase!.storage.from('incident-attachments').upload(path, file));
      try {
        await check(
          supabase!.from('attachments').insert({
            company_id: company!.id,
            report_id: report.id,
            path,
            filename: file.name,
            mime_type: file.type,
            size_bytes: file.size,
          }),
        );
      } catch (e) {
        await supabase!.storage.from('incident-attachments').remove([path]);
        throw e;
      }
      await loadDetail();
    }, 'Attachment uploaded.');
  }
  async function openFile(file: Attachment) {
    try {
      const d = await check(
        supabase!.storage.from('incident-attachments').createSignedUrl(file.path, 60),
      );
      window.open(d.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  return (
    <>
      <Link className="back-link" to="/incidents">
        <ArrowLeft size={16} /> All incidents
      </Link>
      <PageHeading
        eyebrow={`TOOL 9 · ${r.report_no}`}
        title={r.title}
        subtitle={`${r.location} · Reported ${dateTime(r.reported_at)}`}
        actions={
          <>
            <button className="btn secondary" onClick={() => window.print()}>
              <Printer size={16} /> Print / PDF
            </button>
            {write && (
              <button className="btn primary" onClick={() => setEditing(!editing)}>
                {editing ? 'Cancel editing' : 'Edit report'}
              </button>
            )}
          </>
        }
      />
      <div className="detail-badges">
        <Badge value={r.severity} />
        <Badge value={r.status} />
        <span>Last updated {dateTime(r.updated_at)}</span>
      </div>
      <div className="detail-grid">
        <div>
          {editing ? (
            <section className="panel form-panel">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const payload = incidentPayload(e.currentTarget);
                  if (
                    await run(
                      () => check(supabase!.from('service_reports').update(payload).eq('id', r.id)),
                      'Report updated.',
                    )
                  )
                    setEditing(false);
                }}
              >
                <IncidentFields report={r} />
                <button disabled={busy} className="btn primary">
                  Save changes
                </button>
              </form>
            </section>
          ) : (
            <section className="panel narrative">
              <h2>Incident overview</h2>
              <dl className="metadata">
                <div>
                  <dt>Issue type</dt>
                  <dd>{data.issueTypes.find((t) => t.id === r.issue_type_id)?.name}</dd>
                </div>
                <div>
                  <dt>Camp</dt>
                  <dd>
                    {data.camps.find((c) => c.id === r.camp_id)?.name || 'Off-site / unspecified'}
                  </dd>
                </div>
                <div>
                  <dt>Reported by</dt>
                  <dd>{person(r.reported_by)}</dd>
                </div>
                <div>
                  <dt>Assigned to</dt>
                  <dd>{person(r.assigned_to)}</dd>
                </div>
                <div>
                  <dt>Service provider</dt>
                  <dd>{data.providers.find((p) => p.id === r.provider_id)?.name || 'None'}</dd>
                </div>
              </dl>
              <h3>What happened</h3>
              <p className="preserve">{r.description}</p>
              <h3>Action taken</h3>
              <p className="preserve">{r.action_taken || 'No actions recorded yet.'}</p>
            </section>
          )}
          <section className="panel comments no-print">
            <div className="panel-title">
              <h2>Updates & comments</h2>
              <span className="count">{comments.length}</span>
            </div>
            {detailError && <div className="notice error">{detailError}</div>}
            {comments.map((c) => (
              <div className="comment" key={c.id}>
                <div>
                  <strong>{person(c.author_id)}</strong>
                  <small>{dateTime(c.created_at)}</small>
                </div>
                <p className="preserve">{c.body}</p>
              </div>
            ))}
            {!comments.length && <p className="muted">Keep your team informed with an update.</p>}
            {write && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const body = String(new FormData(form).get('body'));
                  if (
                    await run(async () => {
                      await check(
                        supabase!
                          .from('comments')
                          .insert({ company_id: company!.id, report_id: r.id, body }),
                      );
                      await loadDetail();
                    }, 'Comment added.')
                  )
                    form.reset();
                }}
              >
                <Field label="Add an update">
                  <textarea name="body" required maxLength={5000} rows={3} />
                </Field>
                <button className="btn secondary" disabled={busy}>
                  <Send size={15} /> Post update
                </button>
              </form>
            )}
          </section>
        </div>
        <aside>
          <section className="panel side-panel no-print">
            <h2>Response workflow</h2>
            <p className="muted">Record actions before resolving. A supervisor approves closure.</p>
            {write &&
              nextStatuses(r.status, membership!.role).map((s) => (
                <button
                  key={s}
                  className="btn secondary full"
                  disabled={busy}
                  onClick={() => updateStatus(s)}
                >
                  Mark {label(s)}
                </button>
              ))}
            {manager && !['draft', 'closed'].includes(r.status) && (
              <button className="btn primary full" disabled={busy} onClick={escalate}>
                <ArrowUpRight size={16} />
                {linked ? 'Open / re-escalate Tool 10' : 'Escalate to Tool 10'}
              </button>
            )}
            {linked && (
              <Link className="text-link" to={`/situation-reports/${linked.id}`}>
                <FileText size={15} />
                {linked.sitrep_no}
              </Link>
            )}
            {!write && (
              <p className="muted">
                {r.status === 'closed'
                  ? 'This report is closed.'
                  : 'Your role has view-only access.'}
              </p>
            )}
          </section>
          <section className="panel side-panel no-print">
            <h2>Attachments</h2>
            <p className="muted">Images, PDF, TXT, DOCX · up to 10 MB</p>
            {files.map((f) => (
              <div className="file-row" key={f.id}>
                <button className="text-btn" onClick={() => openFile(f)}>
                  <Paperclip size={14} />
                  {f.filename}
                </button>
                {write && (manager || f.uploaded_by === membership!.user_id) && (
                  <button
                    className="icon-btn"
                    disabled={busy}
                    aria-label={`Delete ${f.filename}`}
                    onClick={() => {
                      if (window.confirm('Delete this attachment?'))
                        void run(async () => {
                          await check(
                            supabase!.storage.from('incident-attachments').remove([f.path]),
                          );
                          await check(supabase!.from('attachments').delete().eq('id', f.id));
                          await loadDetail();
                        }, 'Attachment deleted.');
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {write && (
              <Field label="Upload attachment">
                <input
                  aria-label="Upload attachment"
                  type="file"
                  disabled={busy}
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.docx"
                  onChange={(e) => {
                    if (e.target.files?.[0]) void upload(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </Field>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
