import type { IncidentStatus, Role } from './types';
export const roles: Role[] = [
  'company-admin',
  'supervisor',
  'camp-manager',
  'service-provider',
  'viewer',
];
export const severities = ['low', 'medium', 'high', 'critical'] as const;
export const statuses: IncidentStatus[] = [
  'draft',
  'open',
  'in-progress',
  'escalated',
  'resolved',
  'closed',
];
export const isManager = (role: Role) => ['company-admin', 'supervisor'].includes(role);
export const canWrite = (role: Role) => role !== 'viewer';
export const label = (value: string) =>
  value
    .replaceAll('-', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
export function nextStatuses(status: IncidentStatus, role: Role): IncidentStatus[] {
  if (!canWrite(role)) return [];
  const map: Record<IncidentStatus, IncidentStatus[]> = {
    draft: ['open'],
    open: ['in-progress', 'resolved'],
    'in-progress': ['resolved'],
    escalated: ['resolved'],
    resolved: ['in-progress', ...(isManager(role) ? ['closed' as const] : [])],
    closed: [],
  };
  return map[status];
}
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    let s = String(v ?? '');
    // Spreadsheet apps must not execute formulas from incident descriptions.
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    '\uFEFF' +
    [
      headers.map(escape).join(','),
      ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
    ].join('\r\n')
  );
}
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
export function downloadCsv(rows: Record<string, unknown>[], name: string) {
  const url = URL.createObjectURL(new Blob([csv(rows)], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
