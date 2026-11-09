import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

const db = new PGlite();
const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
const viewer = '00000000-0000-4000-8000-000000000003';
const pending = '00000000-0000-4000-8000-000000000004';
const field = '00000000-0000-4000-8000-000000000005';
const superAdmin = '00000000-0000-4000-8000-000000000006';
const countryAdmin = '00000000-0000-4000-8000-000000000007';
let companyA: string, companyB: string, issueA: string;
async function as(user: string) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
}
async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows;
}
async function createIncident() {
  return (
    await query<{ id: string; report_no: string }>(
      "insert into public.service_reports(company_id,title,issue_type_id,severity,location,description) values($1,'Medical assistance',$2,'high','Mina, Zone A','A pilgrim needs assistance') returning id,report_no",
      [companyA, issueA],
    )
  )[0];
}

beforeAll(async () => {
  await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public,storage to authenticated,anon;
 grant execute on function auth.uid() to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated;
 `);
  await db.exec(readFileSync('supabase/migrations/202611090001_core.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202611090002_countries.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202611090003_operations.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202611090004_delivery.sql', 'utf8'));
  for (const [id, name] of [
    [alice, 'Alice'],
    [bob, 'Bob'],
    [viewer, 'Viewer'],
    [pending, 'Pending'],
    [field, 'Field'],
    [superAdmin, 'Super'],
    [countryAdmin, 'Country'],
  ])
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [
      id,
      `${name.toLowerCase()}@example.test`,
      JSON.stringify({ full_name: name }),
    ]);
  await db.query("insert into public.platform_access(user_id,role) values($1,'super-admin')", [
    superAdmin,
  ]);
  await db.query(
    "insert into public.platform_access(user_id,role,country_code) values($1,'country-admin','SA')",
    [countryAdmin],
  );
  await as(alice);
  companyA = (
    await query<{ id: string }>("select public.create_company('SA','Company A') as id")
  )[0].id;
  issueA = (
    await query<{ id: string }>('select id from public.issue_types where company_id=$1 limit 1', [
      companyA,
    ])
  )[0].id;
  await as(bob);
  companyB = (
    await query<{ id: string }>("select public.create_company('KE','Company B') as id")
  )[0].id;
  for (const [user, role] of [
    [viewer, 'viewer'],
    [field, 'camp-manager'],
  ]) {
    await as(user);
    await db.query('select public.request_membership($1)', [companyA]);
    await as(alice);
    const m = (
      await query<{ id: string }>('select id from public.memberships where user_id=$1', [user])
    )[0];
    await db.query("select public.review_membership($1,$2,'active')", [m.id, role]);
  }
  await as(pending);
  await db.query('select public.request_membership($1)', [companyA]);
}, 60000);
beforeEach(() => as(alice));
afterAll(() => db.close());

describe('Supabase schema and company isolation', () => {
  it('seeds every country and creates default issue types', async () => {
    expect(
      (await query<{ count: number }>('select count(*)::int as count from public.countries'))[0]
        .count,
    ).toBe(249);
    expect(
      (await query('select id from public.issue_types where company_id=$1', [companyA])).length,
    ).toBe(10);
  });
  it('prevents another company from reading or updating incidents', async () => {
    const report = await createIncident();
    await as(bob);
    expect(
      await query('select * from public.service_reports where id=$1', [report.id]),
    ).toHaveLength(0);
    expect(
      await query(
        "update public.service_reports set title='Compromised' where id=$1 returning id",
        [report.id],
      ),
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.service_reports(company_id,title,issue_type_id,severity,location,description) values($1,'Forged incident',$2,'low','Mina','Invalid')",
        [companyA, issueA],
      ),
    ).rejects.toThrow();
  });
  it('blocks pending members from operational data and self-approval', async () => {
    await as(pending);
    expect(await query('select * from public.issue_types')).toHaveLength(0);
    await expect(
      db.query("update public.memberships set status='active' where user_id=$1", [pending]),
    ).rejects.toThrow();
    const m = (
      await query<{ id: string }>('select id from public.memberships where user_id=$1', [pending])
    )[0];
    await expect(
      db.query("select public.review_membership($1,'company-admin','active')", [m.id]),
    ).rejects.toThrow('Company admin required');
  });
  it('allows viewers to read but never write or escalate', async () => {
    const report = await createIncident();
    await as(viewer);
    expect(
      await query('select id from public.service_reports where id=$1', [report.id]),
    ).toHaveLength(1);
    expect(
      await query(
        "update public.service_reports set status='in-progress' where id=$1 returning id",
        [report.id],
      ),
    ).toHaveLength(0);
    await expect(db.query('select public.escalate_incident($1)', [report.id])).rejects.toThrow(
      'Supervisor access required',
    );
  });
  it('rejects cross-company foreign keys', async () => {
    await as(bob);
    const camp = (
      await query<{ id: string }>(
        "insert into public.camps(company_id,name,camp_number,location) values($1,'B camp','B-01','Mina') returning id",
        [companyB],
      )
    )[0];
    await as(alice);
    await expect(
      db.query(
        "insert into public.service_reports(company_id,title,issue_type_id,camp_id,severity,location,description) values($1,'Invalid camp',$2,$3,'low','Mina','Invalid')",
        [companyA, issueA, camp.id],
      ),
    ).rejects.toThrow();
  });
  it('disallows moving a report identity or forging the author', async () => {
    const report = await createIncident();
    await expect(
      db.query('update public.service_reports set reported_by=$1 where id=$2', [bob, report.id]),
    ).rejects.toThrow('Report identity');
  });
  it('requires recorded actions and supervisor approval for closure', async () => {
    const r = await createIncident();
    await expect(
      db.query("update public.service_reports set status='resolved' where id=$1", [r.id]),
    ).rejects.toThrow('Record the action');
    await as(field);
    await db.query(
      "update public.service_reports set status='resolved',action_taken='Transferred to medical team' where id=$1",
      [r.id],
    );
    await expect(
      db.query("update public.service_reports set status='closed' where id=$1", [r.id]),
    ).rejects.toThrow('Supervisor approval');
    await as(alice);
    await db.query("update public.service_reports set status='closed' where id=$1", [r.id]);
    await expect(
      db.query("update public.service_reports set description='Changed' where id=$1", [r.id]),
    ).rejects.toThrow('Closed reports are immutable');
  });
  it('creates Tool 10 atomically and makes repeated escalation idempotent', async () => {
    const r = await createIncident();
    const first = (
      await query<{ id: string }>('select public.escalate_incident($1) as id', [r.id])
    )[0].id;
    const second = (
      await query<{ id: string }>('select public.escalate_incident($1) as id', [r.id])
    )[0].id;
    expect(first).toBe(second);
    expect(
      (
        await query<{ status: string }>('select status from public.service_reports where id=$1', [
          r.id,
        ])
      )[0].status,
    ).toBe('escalated');
    expect(
      await query('select id from public.situation_reports where service_report_id=$1', [r.id]),
    ).toHaveLength(1);
  });
  it('requires complete submitted reports and locks approved reports', async () => {
    const r = await createIncident();
    const s = (await query<{ id: string }>('select public.escalate_incident($1) as id', [r.id]))[0];
    await expect(
      db.query("update public.situation_reports set status='submitted' where id=$1", [s.id]),
    ).rejects.toThrow('Impact and recommendations');
    await db.query(
      "update public.situation_reports set status='submitted',impact='One pilgrim affected',recommendations='Maintain medical coverage' where id=$1",
      [s.id],
    );
    await db.query("update public.situation_reports set status='approved' where id=$1", [s.id]);
    expect(
      (
        await query<{ approved_by: string }>(
          'select approved_by from public.situation_reports where id=$1',
          [s.id],
        )
      )[0].approved_by,
    ).toBe(alice);
    await expect(
      db.query("update public.situation_reports set summary='Changed' where id=$1", [s.id]),
    ).rejects.toThrow('Approved situation reports are immutable');
  });
  it('records immutable audit changes and prevents users creating notifications', async () => {
    const r = await createIncident();
    expect(
      (await query('select id from public.activity_logs where entity_id=$1', [r.id])).length,
    ).toBeGreaterThan(0);
    await expect(db.query('delete from public.activity_logs')).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.notifications(company_id,user_id,title) values($1,$2,'Forged')",
        [companyA, bob],
      ),
    ).rejects.toThrow();
    expect(
      (await query('select * from public.notifications where report_id=$1', [r.id])).length,
    ).toBe(1);
  });
  it('restricts private storage to an existing incident in the correct company', async () => {
    const r = await createIncident();
    const path = `${companyA}/${r.id}/test.pdf`;
    await db.query(
      "insert into storage.objects(bucket_id,name,owner_id) values('incident-attachments',$1,$2)",
      [path, alice],
    );
    await as(bob);
    expect(await query('select * from storage.objects where name=$1', [path])).toHaveLength(0);
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name,owner_id) values('incident-attachments',$1,$2)",
        [path, bob],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name,owner_id) values('incident-attachments','malformed/path',$1)",
        [bob],
      ),
    ).rejects.toThrow();
  });
  it('does not let one account create multiple active companies', async () => {
    await expect(db.query("select public.create_company('SA','Second company')")).rejects.toThrow(
      'one company',
    );
  });
  it('prevents browser clients from granting themselves paid billing status', async () => {
    await expect(
      db.query("insert into public.subscriptions(company_id,status) values($1,'active')", [
        companyA,
      ]),
    ).rejects.toThrow();
    await as(viewer);
    expect(await query('select * from public.subscriptions')).toHaveLength(0);
  });
  it('keeps notification delivery metadata server-owned', async () => {
    await expect(db.query('update public.notifications set email_sent_at=now()')).rejects.toThrow();
  });
  it('hides inactive companies from onboarding and stops new reporting', async () => {
    await db.query("update public.companies set status='inactive' where id=$1", [companyA]);
    try {
      expect(
        await query("select * from public.company_directory('SA') where id=$1", [companyA]),
      ).toHaveLength(0);
      await expect(createIncident()).rejects.toThrow();
      await as(pending);
      await expect(db.query('select public.request_membership($1)', [companyA])).rejects.toThrow(
        'not accepting',
      );
    } finally {
      await as(alice);
      await db.query("update public.companies set status='active' where id=$1", [companyA]);
    }
  });
  it('limits country administrators to their own country', async () => {
    await as(countryAdmin);
    expect(await query('select id from public.companies where id=$1', [companyA])).toHaveLength(1);
    expect(await query('select id from public.companies where id=$1', [companyB])).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.companies(name,country_code,created_by) values('Wrong scope','KE',$1)",
        [countryAdmin],
      ),
    ).rejects.toThrow();
    await expect(
      db.query("insert into public.platform_access(user_id,role) values($1,'super-admin')", [
        countryAdmin,
      ]),
    ).rejects.toThrow();
  });
  it('lets super administrators inspect all companies and protects their own access', async () => {
    await as(superAdmin);
    expect(
      await query('select id from public.companies where id in ($1,$2)', [companyA, companyB]),
    ).toHaveLength(2);
    expect(
      await query('delete from public.platform_access where user_id=$1 returning id', [superAdmin]),
    ).toHaveLength(0);
  });
  it('rejects arrival completion until pilgrim counts reconcile', async () => {
    const m = (
      await query<{ id: string }>(
        "insert into public.movements(company_id,group_name,origin,destination,scheduled_at,pilgrim_count) values($1,'Group 1','Mina','Arafat',now(),50) returning id",
        [companyA],
      )
    )[0];
    await expect(
      db.query("update public.movements set status='arrived',arrived_count=49 where id=$1", [m.id]),
    ).rejects.toThrow();
    await db.query("update public.movements set status='arrived',arrived_count=50 where id=$1", [
      m.id,
    ]);
    await as(bob);
    expect(await query('select id from public.movements where id=$1', [m.id])).toHaveLength(0);
  });
  it('requires all reconciliation checks before clearing a camp', async () => {
    const camp = (
      await query<{ id: string }>(
        "insert into public.camps(company_id,name,camp_number,location) values($1,'Main camp','MAIN','Mina') returning id",
        [companyA],
      )
    )[0];
    const v = (
      await query<{ id: string }>(
        'insert into public.camp_vacatings(company_id,camp_id,departure_at,pilgrims_expected,baggage_expected) values($1,$2,now(),20,30) returning id',
        [companyA, camp.id],
      )
    )[0];
    await expect(
      db.query("update public.camp_vacatings set status='cleared' where id=$1", [v.id]),
    ).rejects.toThrow();
    await db.query(
      "update public.camp_vacatings set status='cleared',pilgrims_verified=20,baggage_verified=30,transport_confirmed=true,final_sweep_done=true where id=$1",
      [v.id],
    );
  });
});
