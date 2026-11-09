// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from '../src/context';

const mock = vi.hoisted(() => ({
  onAuth: null as null | ((event: string, session: unknown) => void),
  joined: true,
  delayCompany: null as null | Promise<unknown>,
}));
const sessionA = { user: { id: 'user-a', email: 'a@example.test' }, access_token: 'a' };
const member = {
  id: 'member-a',
  company_id: 'company-a',
  user_id: 'user-a',
  role: 'company-admin',
  status: 'active',
};
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'user-a', email: 'a@example.test' }, access_token: 'a' } },
        error: null,
      }),
      onAuthStateChange: (fn: typeof mock.onAuth) => {
        mock.onAuth = fn;
        return {
          data: {
            listener: null,
            subscription: {
              unsubscribe: () => {
                mock.onAuth = null;
              },
            },
          },
        };
      },
    },
    from: (table: string) => {
      const filters: Record<string, string> = {};
      let single = false;
      const builder = {
        select: () => builder,
        eq: (key: string, value: string) => {
          filters[key] = value;
          return builder;
        },
        order: () => builder,
        range: () => builder,
        single: () => {
          single = true;
          return builder;
        },
        then: async (resolve: (value: unknown) => void) => {
          if (table === 'companies' && mock.delayCompany) await mock.delayCompany;
          let data: unknown = [];
          if (table === 'memberships')
            data =
              mock.joined && filters.user_id !== 'user-b'
                ? [
                    {
                      id: 'member-a',
                      company_id: 'company-a',
                      user_id: 'user-a',
                      role: 'company-admin',
                      status: 'active',
                    },
                  ]
                : [];
          if (table === 'companies') data = single ? { id: 'company-a', name: 'Company A' } : [];
          if (table === 'service_reports') data = [{ id: 'report-a', company_id: 'company-a' }];
          resolve({ data, error: null });
        },
      };
      return builder;
    },
  },
}));
let latest: ReturnType<typeof useApp>;
let snapshots: {
  user: string | undefined;
  member: string | undefined;
  company: string | undefined;
  reports: number;
}[];
function Probe() {
  latest = useApp();
  snapshots.push({
    user: latest.session?.user.id,
    member: latest.membership?.id,
    company: latest.company?.id,
    reports: latest.data.incidents.length,
  });
  return null;
}
beforeEach(() => {
  mock.joined = true;
  mock.delayCompany = null;
  snapshots = [];
});
afterEach(cleanup);
it('never publishes an active membership before its company is available', async () => {
  mock.joined = false;
  render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  await waitFor(() => expect(latest.loading).toBe(false));
  let finish!: () => void;
  mock.delayCompany = new Promise<void>((resolve) => {
    finish = resolve;
  });
  mock.joined = true;
  let refresh!: Promise<void>;
  await act(async () => {
    refresh = latest.refresh();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(snapshots.some((s) => s.member === member.id && !s.company)).toBe(false);
  await act(async () => {
    finish();
    await refresh;
  });
  expect(latest.membership?.id).toBe(member.id);
  expect(latest.company?.id).toBe('company-a');
});
it('clears the previous company immediately when account identity changes', async () => {
  render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  await waitFor(() => expect(latest.membership?.id).toBe(member.id));
  await act(async () => {
    mock.onAuth?.('SIGNED_IN', { ...sessionA, user: { id: 'user-b', email: 'b@example.test' } });
  });
  await waitFor(() => expect(latest.loading).toBe(false));
  expect(
    snapshots
      .filter((s) => s.user === 'user-b')
      .some((s) => s.company === 'company-a' || s.reports > 0 || s.member === 'member-a'),
  ).toBe(false);
});
