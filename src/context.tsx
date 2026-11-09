import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type { Company, Membership, PlatformAccess, WorkspaceData } from './lib/types';
import { isManager } from './lib/workflow';
const blank: WorkspaceData = {
  camps: [],
  providers: [],
  issueTypes: [],
  incidents: [],
  sitreps: [],
  members: [],
  notifications: [],
  activities: [],
  movements: [],
  vacatings: [],
};
type ContextValue = {
  session: Session | null;
  membership: Membership | null;
  company: Company | null;
  platformAccess: PlatformAccess[];
  companies: Company[];
  selectCompany: (id: string) => void;
  data: WorkspaceData;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  toast: (text: string, error?: boolean) => void;
  busy: boolean;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<boolean>;
};
const Context = createContext<ContextValue>(null!);
export const useApp = () => useContext(Context);
export function AppProvider({ children }: { children: ReactNode }) {
  const generation = useRef(0),
    mutationBusy = useRef(false),
    identity = useRef<string | null>(null);
  const [session, setSession] = useState<Session | null>(null),
    [membership, setMembership] = useState<Membership | null>(null),
    [company, setCompany] = useState<Company | null>(null),
    [data, setData] = useState(blank),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [platformAccess, setPlatformAccess] = useState<PlatformAccess[]>([]),
    [companies, setCompanies] = useState<Company[]>([]),
    [activeCompany, selectCompany] = useState('');
  const toast = useCallback((text: string, error = false) => setMessage({ text, error }), []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 7000);
    return () => clearTimeout(t);
  }, [message]);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const acceptSession = (value: Session | null) => {
      if (!mounted) return;
      generation.current++;
      if (identity.current !== (value?.user.id || null)) {
        identity.current = value?.user.id || null;
        setMembership(null);
        setCompany(null);
        setData(blank);
        setPlatformAccess([]);
        setCompanies([]);
        setLoading(!!value);
      }
      setSession(value ? { ...value } : null);
    };
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setError(error.message);
      acceptSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, value) => {
      acceptSession(value);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!supabase || !session) {
      setMembership(null);
      setCompany(null);
      setData(blank);
      setPlatformAccess([]);
      setCompanies([]);
      return;
    }
    setError('');
    const access = await check(
      supabase.from('platform_access').select('*').eq('user_id', session.user.id),
    );
    if (request !== generation.current) return;
    setPlatformAccess(access as PlatformAccess[]);
    const { data: members, error: memberError } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (memberError) throw memberError;
    if (request !== generation.current) return;
    let member = (members?.find((m) => m.status === 'active') ||
      members?.find((m) => m.status === 'pending') ||
      members?.[0] ||
      null) as Membership | null;
    if (access.length) {
      const list = await check(supabase.from('companies').select('*').order('name'));
      if (request !== generation.current) return;
      setCompanies(list as Company[]);
      const selected = list.find((c) => c.id === activeCompany) || list[0];
      if (selected)
        member = {
          id: 'platform',
          company_id: selected.id,
          user_id: session.user.id,
          role: access.some((a) => a.role === 'super-admin') ? 'company-admin' : 'supervisor',
          status: 'active',
        };
      else member = null;
    } else setCompanies([]);
    if (!member) {
      setMembership(null);
      setData(blank);
      setCompany(null);
      return;
    }
    const result = await supabase
      .from('companies')
      .select('*')
      .eq('id', member.company_id)
      .single();
    if (result.error) throw result.error;
    if (request !== generation.current) return;
    setCompany(result.data);
    if (member.status !== 'active') {
      setData(blank);
      setMembership(member);
      return;
    }
    const tables = [
      'camps',
      'service_providers',
      'issue_types',
      'service_reports',
      'situation_reports',
      'memberships',
      'notifications',
      'movements',
      'camp_vacatings',
      ...(isManager(member.role) ? ['activity_logs'] : []),
    ];
    const results = await Promise.all(
      tables.map(async (table) => {
        const rows: unknown[] = [];
        const cap = table === 'notifications' ? 100 : table === 'activity_logs' ? 250 : 5000;
        for (let offset = 0; offset < cap; offset += 500) {
          const result = await supabase!
            .from(table)
            .select(table === 'memberships' ? '*, profiles(*)' : '*')
            .eq('company_id', member!.company_id)
            .order(table === 'service_reports' ? 'reported_at' : 'created_at', { ascending: false })
            .order('id')
            .range(offset, Math.min(offset + 499, cap - 1));
          if (result.error) throw result.error;
          rows.push(...(result.data || []));
          if ((result.data?.length || 0) < Math.min(500, cap - offset)) break;
        }
        if (rows.length === 5000)
          toast(
            'Showing the latest 5,000 records per module. This pilot needs server-side pagination for larger datasets.',
          );
        return rows;
      }),
    );
    if (request !== generation.current) return;
    setData({
      camps: results[0],
      providers: results[1],
      issueTypes: results[2],
      incidents: results[3],
      sitreps: results[4],
      members: results[5],
      notifications: results[6],
      movements: results[7],
      vacatings: results[8],
      activities: results[9] || [],
    } as unknown as WorkspaceData);
    setMembership(member);
  }, [session, activeCompany, toast]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    refresh()
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [refresh]);
  async function run(fn: () => Promise<unknown>, success?: string) {
    if (mutationBusy.current) return false;
    mutationBusy.current = true;
    setBusy(true);
    const operationIdentity = identity.current;
    try {
      await fn();
      if (identity.current === operationIdentity) await refresh();
      if (success) toast(success);
      return true;
    } catch (e) {
      toast(
        e instanceof Error ? e.message : String((e as { message?: string })?.message || e),
        true,
      );
      return false;
    } finally {
      mutationBusy.current = false;
      setBusy(false);
    }
  }
  return (
    <Context.Provider
      value={{
        session,
        membership,
        company,
        platformAccess,
        companies,
        selectCompany,
        data,
        loading,
        error,
        refresh,
        toast,
        busy,
        run,
      }}
    >
      {children}
      {message && (
        <div className={`toast ${message.error ? 'error' : ''}`} role="status">
          {message.text}
          <button onClick={() => setMessage(null)} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export async function check<T extends { data?: unknown; error: { message: string } | null }>(
  promise: PromiseLike<T>,
): Promise<NonNullable<T['data']>> {
  const result = await promise;
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T['data']>;
}
