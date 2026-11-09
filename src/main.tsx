import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  Navigate,
  useLocation,
} from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Tent,
  Building2,
  Tags,
  Users,
  History,
  Settings as SettingsIcon,
  LogOut,
  Bell,
  RefreshCw,
  Menu,
  X,
  ChevronRight,
  Bus,
  CheckSquare,
  Globe,
} from 'lucide-react';
import { AppProvider, useApp, check } from './context';
import { supabase } from './lib/supabase';
import { label, dateTime, isManager } from './lib/workflow';
import { Auth, Onboarding, ResetPassword } from './pages/Auth';
import { lazy, Suspense } from 'react';
const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })),
);
import { Operations } from './pages/Operations';
import { Platform } from './pages/Platform';
import { Billing } from './pages/Billing';
import { Incidents, NewIncident, IncidentDetail } from './pages/Incidents';
import { SituationReports, SituationReportDetail } from './pages/SituationReports';
import { Manage, Team, Settings, Audit } from './pages/Manage';
import { Loading } from './components/ui';
import './style.css';
import './refinements.css';

function App() {
  const { session, membership, platformAccess, loading, error, refresh, run } = useApp();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!session) return <Auth />;
  if (error)
    return (
      <div className="onboarding">
        <section className="panel onboarding-card">
          <h1>Workspace could not load</h1>
          <p className="notice error">{error}</p>
          <p>Confirm your Supabase migrations have been applied and try again.</p>
          <button className="btn primary" onClick={() => run(refresh)}>
            Try again
          </button>
          <button className="text-btn signout" onClick={() => supabase!.auth.signOut()}>
            Sign out
          </button>
        </section>
      </div>
    );
  if (location.pathname === '/reset-password') return <ResetPassword />;
  if ((!membership || membership.status !== 'active') && platformAccess.length)
    return (
      <main className="content">
        <Platform />
        <button className="text-btn signout" onClick={() => supabase!.auth.signOut()}>
          Sign out
        </button>
      </main>
    );
  if (!membership || membership.status !== 'active') return <Onboarding />;
  return <Workspace />;
}
function Workspace() {
  const {
    company,
    membership,
    platformAccess,
    companies,
    selectCompany,
    session,
    data,
    run,
    busy,
    refresh,
  } = useApp();
  const [menu, setMenu] = useState(false),
    [notifications, setNotifications] = useState(false);
  const location = useLocation();
  const manager = isManager(membership!.role);
  const unread = data.notifications.filter((n) => !n.read_at).length;
  const nav = [
    {
      section: 'WORKSPACE',
      items: [
        { path: '/', name: 'Overview', Icon: LayoutDashboard },
        { path: '/incidents', name: 'Incident reports', Icon: ClipboardList },
        { path: '/situation-reports', name: 'Situation reports', Icon: FileText },
      ],
    },
    {
      section: 'ORGANIZATION',
      items: [
        { path: '/camps', name: 'Camps', Icon: Tent },
        { path: '/providers', name: 'Service providers', Icon: Building2 },
        { path: '/issue-types', name: 'Issue types', Icon: Tags },
        { path: '/team', name: 'Team & access', Icon: Users },
        { path: '/movements', name: 'Site movements', Icon: Bus },
        { path: '/vacating', name: 'Camp vacating', Icon: CheckSquare },
      ],
    },
    {
      section: 'ADMINISTRATION',
      items: [
        ...(platformAccess.length
          ? [{ path: '/platform', name: 'Platform admin', Icon: Globe }]
          : []),
        ...(manager ? [{ path: '/audit', name: 'Audit history', Icon: History }] : []),
        { path: '/settings', name: 'Settings', Icon: SettingsIcon },
        ...(membership!.role === 'company-admin'
          ? [{ path: '/billing', name: 'Billing', Icon: Building2 }]
          : []),
      ],
    },
  ];
  return (
    <div className="app-shell">
      <button
        className={`sidebar-backdrop ${menu ? 'visible' : ''}`}
        onClick={() => setMenu(false)}
        aria-label="Close navigation"
      />
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <Link className="brand" to="/">
          <span className="brand-mark">◈</span>
          <div>
            MANASIK<small>OPERATIONS PLATFORM</small>
          </div>
        </Link>
        <div className="workspace-name">
          <span className="company-avatar">{company!.name.slice(0, 1)}</span>
          <div>
            <strong>{company!.name}</strong>
            <small>{company!.country_code} · Company workspace</small>
          </div>
        </div>
        {platformAccess.length > 0 && (
          <select
            className="company-picker"
            aria-label="Switch company"
            value={company!.id}
            onChange={(e) => selectCompany(e.target.value)}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <nav>
          {nav.map((group) => (
            <div className="nav-group" key={group.section}>
              <p>{group.section}</p>
              {group.items.map(({ path, name, Icon }) => (
                <NavLink key={path} to={path} end={path === '/'} onClick={() => setMenu(false)}>
                  <Icon size={18} />
                  <span>{name}</span>
                  {path === '/incidents' && (
                    <span className="nav-count">
                      {
                        data.incidents.filter(
                          (r) => !['closed', 'resolved', 'draft'].includes(r.status),
                        ).length
                      }
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card">
            <span className="live-dot" />
            <strong>Connected operations</strong>
            <p>Every report is a step toward a safer journey.</p>
          </div>
          <button
            className="signout-btn"
            onClick={() => run(() => check(supabase!.auth.signOut()))}
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {location.pathname === '/' ? 'Overview' : label(location.pathname.split('/')[1])}
            </strong>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-btn"
              aria-label="Refresh workspace"
              disabled={busy}
              onClick={() => run(refresh, 'Workspace refreshed.')}
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="icon-btn notification-button"
              aria-label={`Notifications, ${unread} unread`}
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </button>
            <span className="topbar-separator" />
            <div className="account">
              <span className="avatar">
                {String(session?.user.user_metadata.full_name || session?.user.email || 'U')
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
              <div>
                <strong>{session?.user.user_metadata.full_name || 'Team member'}</strong>
                <small>{label(membership!.role)}</small>
              </div>
            </div>
          </div>
        </header>
        <main className="content">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/incidents/new" element={<NewIncident />} />
              <Route path="/incidents/:id" element={<IncidentDetail />} />
              <Route path="/situation-reports" element={<SituationReports />} />
              <Route path="/situation-reports/:id" element={<SituationReportDetail />} />
              <Route path="/camps" element={<Manage key="camps" entity="camps" />} />
              <Route path="/providers" element={<Manage key="providers" entity="providers" />} />
              <Route
                path="/issue-types"
                element={<Manage key="issueTypes" entity="issueTypes" />}
              />
              <Route path="/team" element={<Team />} />
              <Route path="/platform" element={<Platform />} />
              <Route path="/movements" element={<Operations />} />
              <Route path="/vacating" element={<Operations key="vacating" vacating />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <footer className="workspace-footer">
            <span>MANASIK · Holy Sites Operations</span>
            <span>Mina · Arafat · Muzdalifah</span>
          </footer>
        </main>
      </div>
      {notifications && (
        <section className="notification-panel panel">
          <div className="panel-title">
            <h2>Notifications</h2>
            <button
              className="icon-btn"
              onClick={() => setNotifications(false)}
              aria-label="Close notifications"
            >
              <X size={18} />
            </button>
          </div>
          <button
            className="text-btn"
            disabled={busy || !unread}
            onClick={() =>
              run(
                () =>
                  check(
                    supabase!
                      .from('notifications')
                      .update({ read_at: new Date().toISOString() })
                      .is('read_at', null),
                  ),
                'Notifications marked as read.',
              )
            }
          >
            Mark all as read
          </button>
          {!data.notifications.length && (
            <p className="muted">Your company’s incident updates will appear here.</p>
          )}
          {data.notifications.map((n) => (
            <Link
              key={n.id}
              to={n.report_id ? `/incidents/${n.report_id}` : '/'}
              className={`notification-item ${!n.read_at ? 'unread' : ''}`}
              onClick={() => {
                setNotifications(false);
                void run(() =>
                  check(
                    supabase!
                      .from('notifications')
                      .update({ read_at: new Date().toISOString() })
                      .eq('id', n.id),
                  ),
                );
              }}
            >
              <strong>{n.title}</strong>
              <small>{dateTime(n.created_at)}</small>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
// Reuse the root when Vite replaces this entry module during development.
const root = import.meta.hot?.data.root ?? ReactDOM.createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
