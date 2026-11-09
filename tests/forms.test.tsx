// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NewIncident, IncidentDetail } from '../src/pages/Incidents';
import { Auth } from '../src/pages/Auth';

const state = vi.hoisted(() => ({
  role: 'camp-manager',
  toast: vi.fn(),
  insert: vi.fn(),
  signUp: vi.fn(),
  signIn: vi.fn(),
  resend: vi.fn(),
  query: vi.fn(),
}));
vi.mock('../src/context', () => ({
  useApp: () => ({
    membership: { role: state.role, user_id: 'user-1' },
    company: { id: 'company-1', name: 'Company' },
    data: {
      issueTypes: [
        { id: 'issue-1', name: 'Medical Emergency', is_active: true, severity_default: 'critical' },
      ],
      camps: [],
      members: [],
      providers: [],
      incidents: [],
      sitreps: [],
    },
    busy: false,
    run: async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        return true;
      } catch {
        return false;
      }
    },
    toast: state.toast,
  }),
  check: async (promise: Promise<{ data: unknown; error: unknown }>) => {
    const result = await promise;
    if (result.error) throw result.error;
    return result.data;
  },
}));
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: state.insert, select: state.query }),
    auth: { signUp: state.signUp, signInWithPassword: state.signIn, resend: state.resend },
  },
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  state.role = 'camp-manager';
  state.insert.mockReturnValue({
    select: () => ({ single: async () => ({ data: { id: 'incident-1' }, error: null }) }),
  });
});
function mount(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}
async function fillReport() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Incident title'), 'Heat exhaustion');
  await user.selectOptions(screen.getByLabelText('Issue type'), 'issue-1');
  await user.type(screen.getByLabelText('Location'), 'Mina Zone A');
  await user.type(screen.getByLabelText('What happened?'), 'A pilgrim needs medical attention.');
  return user;
}
describe('Reporting and account forms', () => {
  it('continues immediately when signup returns a session without email verification', async () => {
    state.signUp.mockResolvedValue({
      data: { session: { access_token: 'test-session' } },
      error: null,
    });
    mount(<Auth />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    await user.type(screen.getByLabelText('Full name'), 'Amina Hassan');
    await user.type(screen.getByLabelText('Email address'), 'amina@example.test');
    await user.type(screen.getByLabelText(/Password/), 'StrongPassword123');
    await user.click(screen.getByRole('button', { name: 'Create account', exact: true }));
    await waitFor(() =>
      expect(state.toast).toHaveBeenCalledWith(
        'Account created. Choose your country and company to continue.',
      ),
    );
    expect(screen.queryByRole('heading', { name: 'Confirm your email' })).toBeNull();
    expect(state.resend).not.toHaveBeenCalled();
  });
  it('lets an unconfirmed user request another signup confirmation without re-registering', async () => {
    state.signIn.mockResolvedValue({
      data: null,
      error: { message: 'Email not confirmed', code: 'email_not_confirmed' },
    });
    state.resend.mockResolvedValue({ data: {}, error: null });
    mount(<Auth />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'amina@example.test');
    await user.type(screen.getByLabelText('Password'), 'StrongPassword123');
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    await screen.findByRole('heading', { name: 'Confirm your email' });
    await user.click(screen.getByRole('button', { name: 'Resend confirmation' }));
    await waitFor(() =>
      expect(state.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'amina@example.test',
        options: { emailRedirectTo: window.location.origin },
      }),
    );
    expect(state.signUp).not.toHaveBeenCalled();
  });
  it('shows a persistent explanation when Supabase refuses a non-team email address', async () => {
    state.signIn.mockResolvedValue({
      data: null,
      error: { message: 'Email not confirmed', code: 'email_not_confirmed' },
    });
    state.resend.mockResolvedValue({
      data: null,
      error: { message: 'Email address not authorized', code: 'email_address_not_authorized' },
    });
    mount(<Auth />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'amina@example.test');
    await user.type(screen.getByLabelText('Password'), 'StrongPassword123');
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    await user.click(await screen.findByRole('button', { name: 'Resend confirmation' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('configure custom SMTP'),
    );
  });
  it('submits Tool 9 with the selected issue severity and company', async () => {
    mount(<NewIncident />);
    const user = await fillReport();
    await user.click(screen.getByRole('button', { name: 'Submit report' }));
    await waitFor(() => expect(state.insert).toHaveBeenCalled());
    expect(state.insert.mock.calls[0][0]).toMatchObject({
      company_id: 'company-1',
      issue_type_id: 'issue-1',
      severity: 'critical',
      status: 'open',
      camp_id: null,
    });
  });
  it('saves a draft without silently submitting it as open', async () => {
    mount(<NewIncident />);
    const user = await fillReport();
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(state.insert).toHaveBeenCalled());
    expect(state.insert.mock.calls[0][0].status).toBe('draft');
  });
  it('does not render the incident creation form for a viewer', () => {
    state.role = 'viewer';
    mount(<NewIncident />);
    expect(screen.queryByRole('button', { name: 'Submit report' })).toBeNull();
    expect(screen.getByText('View-only access')).toBeTruthy();
  });
  it('registers the user with a name and confirmation redirect', async () => {
    state.signUp.mockResolvedValue({ data: { session: null }, error: null });
    mount(<Auth />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    await user.type(screen.getByLabelText('Full name'), 'Amina Hassan');
    await user.type(screen.getByLabelText('Email address'), 'amina@example.test');
    await user.type(screen.getByLabelText(/Password/), 'StrongPassword123');
    await user.click(screen.getByRole('button', { name: 'Create account', exact: true }));
    await waitFor(() => expect(state.signUp).toHaveBeenCalled());
    expect(state.signUp.mock.calls[0][0]).toMatchObject({
      email: 'amina@example.test',
      options: { data: { full_name: 'Amina Hassan' } },
    });
    expect(state.toast).toHaveBeenCalledWith(
      'Check your email to confirm your account, then sign in.',
    );
  });
});
