begin;
alter table public.companies add column status text not null default 'active' check(status in ('active','inactive'));
grant update(status) on public.companies to authenticated;
create function public.seed_company_issue_types() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.issue_types(company_id,name,severity_default) values
 (new.id,'Lost Pilgrim','high'),(new.id,'Medical Emergency','critical'),(new.id,'Crowd Congestion','high'),
 (new.id,'Transportation Delay','medium'),(new.id,'Water Shortage','high'),(new.id,'Electricity Failure','medium'),
 (new.id,'Security Concern','high'),(new.id,'Missing Baggage','low'),(new.id,'Fire Hazard','critical'),(new.id,'Camp Maintenance','low');
 return new;
end $$;
create trigger company_default_issues after insert on public.companies for each row execute function public.seed_company_issue_types();
revoke execute on function public.seed_company_issue_types() from public,anon,authenticated;
create or replace function public.company_directory(country text) returns table(id uuid,name text) language sql stable security definer set search_path='' as $$
 select c.id,c.name from public.companies c where c.country_code=country and c.status='active' and auth.uid() is not null order by c.name
$$;
create or replace function public.can_write(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.company_role(target) in ('company-admin','supervisor','camp-manager','service-provider'),false)
 and exists(select 1 from public.companies where id=target and status='active')
$$;
create or replace function public.request_membership(target uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if not exists(select 1 from public.companies where id=target and status='active') then raise exception 'Company is not accepting membership requests'; end if;
 if exists(select 1 from public.memberships where user_id=auth.uid() and status in ('active','pending')) then raise exception 'You already have an active or pending membership'; end if;
 insert into public.memberships(company_id,user_id,role,status) values(target,auth.uid(),'viewer','pending')
 on conflict(company_id,user_id) do update set status='pending',role='viewer';
end $$;
alter table public.notifications add column email_sent_at timestamptz;
alter table public.notifications add column email_error text;
-- Payment records can only be written by the billing functions using the service role.
create table public.subscriptions (
 company_id uuid primary key references public.companies(id), stripe_customer_id text unique,
 stripe_subscription_id text unique, status text not null default 'free', current_period_end timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy billing_read on public.subscriptions for select to authenticated using(public.company_role(company_id)='company-admin');
revoke all on public.subscriptions from anon,authenticated;
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
-- Public API column grants remain limited to read_at; delivery metadata is server-owned.
create policy profiles_company_history on public.profiles for select to authenticated using(exists(
 select 1 from public.memberships m where m.user_id=profiles.id and public.is_member(m.company_id)));
commit;
