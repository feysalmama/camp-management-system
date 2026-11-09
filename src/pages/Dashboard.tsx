import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Plus,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  Zap,
  ArrowRight,
  MapPin,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useApp } from '../context';
import { Badge, Empty, PageHeading } from '../components/ui';
import { canWrite, dateTime } from '../lib/workflow';

export function Dashboard() {
  const { company, data, membership } = useApp();
  const active = data.incidents.filter((r) => !['closed', 'resolved', 'draft'].includes(r.status));
  const critical = active.filter((r) => r.severity === 'critical');
  const chart = data.issueTypes
    .map((t) => ({
      name: t.name,
      count: data.incidents.filter((r) => r.issue_type_id === t.id).length,
    }))
    .filter((t) => t.count)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const counts = [
    {
      title: 'Total incidents',
      value: data.incidents.length,
      note: 'All service reports',
      Icon: ClipboardList,
      tone: 'green',
    },
    {
      title: 'Active incidents',
      value: active.length,
      note: 'Awaiting resolution',
      Icon: AlertTriangle,
      tone: 'amber',
    },
    {
      title: 'Critical attention',
      value: critical.length,
      note: 'Active critical reports',
      Icon: Zap,
      tone: 'red',
    },
    {
      title: 'Resolved & closed',
      value: data.incidents.filter((r) => ['resolved', 'closed'].includes(r.status)).length,
      note: 'Actions completed',
      Icon: CheckCircle2,
      tone: 'blue',
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="OPERATIONS OVERVIEW"
        title="A clearer view of your operations."
        subtitle={`${company?.name} · Monitor reports, coordinate teams, and keep action moving.`}
        actions={
          canWrite(membership!.role) && (
            <Link className="btn primary" to="/incidents/new">
              <Plus size={17} /> Report incident
            </Link>
          )
        }
      />
      <div className="summary-strip">
        <span>
          <span className="live-dot" /> Company workspace
        </span>
        <span>{data.camps.length} camps</span>
        <span>{data.members.filter((m) => m.status === 'active').length} active team members</span>
        <span>Times shown in your local timezone</span>
      </div>
      <div className="stat-grid">
        {counts.map(({ title, value, note, Icon, tone }) => (
          <article className="stat-card" key={title}>
            <div>
              <span>{title}</span>
              <Icon size={19} className={`tone-${tone}`} />
            </div>
            <strong>{value.toLocaleString()}</strong>
            <p>{note}</p>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Recent incidents</h2>
              <p>The latest reports from your teams</p>
            </div>
            <Link className="text-link" to="/incidents">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          {data.incidents.length ? (
            <div className="recent-list">
              {data.incidents.slice(0, 5).map((r) => (
                <Link to={`/incidents/${r.id}`} className="recent-row" key={r.id}>
                  <span className={`incident-dot ${r.severity}`} />
                  <div className="grow">
                    <span className="reference">{r.report_no}</span>
                    <h3>{r.title}</h3>
                    <p>
                      <MapPin size={12} />
                      {r.location} <span>·</span> {dateTime(r.reported_at)}
                    </p>
                  </div>
                  <Badge value={r.status} />
                  <ArrowRight size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty title="Your operations start here">
              Create your first incident to start tracking field reports.
            </Empty>
          )}
        </section>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Reports by issue</h2>
              <p>Where your team’s attention goes</p>
            </div>
          </div>
          {chart.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={chart} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid horizontal={false} stroke="#edf0eb" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={125}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="count" name="Incidents" fill="#237b63" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="No reporting trends yet">
              Your incident categories will appear as reports come in.
            </Empty>
          )}
        </section>
      </div>
      <section className="workflow-banner">
        <div className="workflow-symbol">↗</div>
        <div>
          <span className="eyebrow">FROM FIELD TO DECISION</span>
          <h2>One report. A connected response.</h2>
          <p>
            Record in Tool 9, review with your supervisor, and escalate into Tool 10 when management
            action is needed.
          </p>
        </div>
        <Link className="btn secondary" to="/situation-reports">
          Situation reports <ArrowRight size={16} />
        </Link>
      </section>
    </>
  );
}
