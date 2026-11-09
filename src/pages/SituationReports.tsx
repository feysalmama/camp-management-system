import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Printer, Search } from 'lucide-react';
import { useApp, check } from '../context';
import { supabase } from '../lib/supabase';
import { Badge, Empty, Field, PageHeading } from '../components/ui';
import { dateTime, isManager } from '../lib/workflow';

export function SituationReports() {
  const { data } = useApp();
  const [search, setSearch] = useState('');
  const rows = data.sitreps.filter((r) =>
    `${r.sitrep_no} ${r.summary}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="TOOL 10 · MANAGEMENT REPORTING"
        title="Situation reports"
        subtitle="Turn escalated incidents into clear information for decisions."
      />
      <section className="panel">
        <div className="filters">
          <label className="search">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search situation reports…"
              aria-label="Search situation reports"
            />
          </label>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference / Summary</th>
                  <th>Source incident</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link className="row-title" to={`/situation-reports/${s.id}`}>
                        {s.sitrep_no}
                      </Link>
                      <small className="truncate">{s.summary}</small>
                    </td>
                    <td>
                      <Link className="text-link" to={`/incidents/${s.service_report_id}`}>
                        {data.incidents.find((r) => r.id === s.service_report_id)?.report_no}
                      </Link>
                    </td>
                    <td>
                      <Badge value={s.status} />
                    </td>
                    <td>{dateTime(s.created_at)}</td>
                    <td>
                      <Link to={`/situation-reports/${s.id}`} aria-label={`Open ${s.sitrep_no}`}>
                        <ArrowUpRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No situation reports yet">
            Supervisors create Tool 10 by escalating a submitted Tool 9 incident.
          </Empty>
        )}
      </section>
    </>
  );
}
export function SituationReportDetail() {
  const { id } = useParams();
  const { data, company, membership, run, busy } = useApp();
  const s = data.sitreps.find((r) => r.id === id);
  if (!s) return <Empty title="Situation report not found" />;
  const manager = isManager(membership!.role);
  const readonly = !manager || s.status === 'approved';
  const source = data.incidents.find((r) => r.id === s.service_report_id);
  const fields = [
    ['summary', 'Situation summary'],
    ['impact', 'Impact on pilgrims and operations'],
    ['current_situation', 'Current situation'],
    ['immediate_actions', 'Immediate actions'],
    ['resources_required', 'Resources required'],
    ['recommendations', 'Recommendations'],
  ] as const;
  return (
    <>
      <Link className="back-link" to="/situation-reports">
        <ArrowLeft size={16} /> All situation reports
      </Link>
      <PageHeading
        eyebrow="TOOL 10 · SITUATION REPORT"
        title={s.sitrep_no}
        subtitle={`${company!.name} · Created ${dateTime(s.created_at)}`}
        actions={
          <button className="btn secondary" onClick={() => window.print()}>
            <Printer size={16} /> Print / Save PDF
          </button>
        }
      />
      <div className="detail-badges">
        <Badge value={s.status} />
        <Link to={`/incidents/${s.service_report_id}`}>Source: {source?.report_no}</Link>
        <span>Updated {dateTime(s.updated_at)}</span>
      </div>
      <section className="panel form-panel">
        <form
          key={s.updated_at}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const status =
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') || s.status;
            const payload = Object.fromEntries(fields.map(([key]) => [key, String(form.get(key))]));
            await run(
              () =>
                check(
                  supabase!
                    .from('situation_reports')
                    .update({ ...payload, status })
                    .eq('id', s.id),
                ),
              status === 'approved' ? 'Situation report approved.' : 'Situation report saved.',
            );
          }}
        >
          {fields.map(([key, name]) => (
            <Field key={key} label={name}>
              {readonly ? (
                <p className="preserve report-text">{s[key] || 'Not specified'}</p>
              ) : (
                <textarea
                  name={key}
                  required={key === 'summary'}
                  defaultValue={s[key]}
                  rows={key === 'summary' ? 4 : 3}
                  maxLength={20000}
                />
              )}
            </Field>
          ))}
          <dl className="metadata">
            <div>
              <dt>Prepared by</dt>
              <dd>
                {data.members.find((m) => m.user_id === s.reported_by)?.profiles?.full_name ||
                  'Team member'}
              </dd>
            </div>
            <div>
              <dt>Approved by</dt>
              <dd>
                {data.members.find((m) => m.user_id === s.approved_by)?.profiles?.full_name ||
                  'Pending approval'}
              </dd>
            </div>
          </dl>
          {!readonly && (
            <div className="form-actions no-print">
              <button className="btn secondary" value={s.status} disabled={busy}>
                Save changes
              </button>
              {s.status === 'draft' && (
                <button className="btn primary" value="submitted" disabled={busy}>
                  Submit for approval
                </button>
              )}
              {s.status === 'submitted' && (
                <>
                  <button className="btn secondary" value="draft" disabled={busy}>
                    Return to draft
                  </button>
                  <button className="btn primary" value="approved" disabled={busy}>
                    Approve report
                  </button>
                </>
              )}
            </div>
          )}
          {s.status === 'approved' && (
            <p className="notice">Approved reports are locked to preserve the official record.</p>
          )}
        </form>
      </section>
    </>
  );
}
