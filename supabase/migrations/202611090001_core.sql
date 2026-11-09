-- Apply in Supabase SQL Editor, or with `supabase db push`.
begin;
create table public.countries (code text primary key check(length(code)=2), name text not null);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '', email text not null, created_at timestamptz not null default now()
);
create table public.companies (
 id uuid primary key default gen_random_uuid(), country_code text not null references public.countries(code),
 name text not null check(length(trim(name)) between 2 and 120), email text not null default '', phone text not null default '',
 address text not null default '', created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create unique index companies_unique_name on public.companies(country_code,lower(trim(name)));
create table public.memberships (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 user_id uuid not null references public.profiles(id), role text not null default 'viewer'
 check(role in ('company-admin','supervisor','camp-manager','service-provider','viewer')),
 status text not null default 'pending' check(status in ('pending','active','rejected')),
 created_at timestamptz not null default now(), unique(company_id,user_id)
);
create table public.camps (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 name text not null check(length(trim(name))>0), camp_number text not null, location text not null,
 capacity integer not null default 0 check(capacity>=0), status text not null default 'active' check(status in ('active','inactive')),
 created_at timestamptz not null default now(), unique(company_id,id), unique(company_id,camp_number)
);
create table public.service_providers (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 name text not null, category text not null, phone text not null default '', email text not null default '',
 status text not null default 'active' check(status in ('active','inactive')), created_at timestamptz not null default now(), unique(company_id,id)
);
create table public.issue_types (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 name text not null, description text not null default '', severity_default text not null default 'medium'
 check(severity_default in ('low','medium','high','critical')), is_active boolean not null default true,
 created_at timestamptz not null default now(), unique(company_id,id), unique(company_id,name)
);
create sequence public.incident_number_seq;
create table public.service_reports (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 report_no text not null unique default ('INC-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.incident_number_seq')::text,6,'0')),
 title text not null check(length(trim(title)) between 3 and 200), camp_id uuid, issue_type_id uuid not null, assigned_to uuid,
 provider_id uuid, severity text not null check(severity in ('low','medium','high','critical')),
 status text not null default 'open' check(status in ('draft','open','in-progress','escalated','resolved','closed')),
 location text not null, description text not null, action_taken text not null default '',
 reported_by uuid not null default auth.uid() references public.profiles(id), reported_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(company_id,id),
 foreign key(company_id,camp_id) references public.camps(company_id,id),
 foreign key(company_id,issue_type_id) references public.issue_types(company_id,id),
 foreign key(company_id,provider_id) references public.service_providers(company_id,id)
);
create sequence public.sitrep_number_seq;
create table public.situation_reports (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 service_report_id uuid not null unique,
 sitrep_no text not null unique default ('SITREP-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.sitrep_number_seq')::text,6,'0')),
 summary text not null, impact text not null default '', current_situation text not null default '',
 immediate_actions text not null default '', resources_required text not null default '', recommendations text not null default '',
 status text not null default 'draft' check(status in ('draft','submitted','approved')),
 reported_by uuid not null default auth.uid() references public.profiles(id), approved_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,id),
 foreign key(company_id,service_report_id) references public.service_reports(company_id,id)
);
create table public.comments (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), report_id uuid not null,
 author_id uuid not null default auth.uid() references public.profiles(id), body text not null check(length(trim(body)) between 1 and 5000),
 created_at timestamptz not null default now(), foreign key(company_id,report_id) references public.service_reports(company_id,id)
);
create table public.attachments (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), report_id uuid not null,
 uploaded_by uuid not null default auth.uid() references public.profiles(id), filename text not null, path text not null unique,
 mime_type text not null, size_bytes bigint not null check(size_bytes between 1 and 10485760), created_at timestamptz not null default now(),
 foreign key(company_id,report_id) references public.service_reports(company_id,id),
 check(path like company_id::text||'/'||report_id::text||'/%')
);
create table public.activity_logs (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 user_id uuid references public.profiles(id), action text not null, entity_type text not null, entity_id uuid not null,
 old_data jsonb, new_data jsonb, created_at timestamptz not null default now()
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 user_id uuid not null references public.profiles(id), title text not null, report_id uuid, read_at timestamptz,
 created_at timestamptz not null default now()
);
create index memberships_user on public.memberships(user_id,status);
create index reports_company on public.service_reports(company_id,reported_at desc);
create index sitreps_company on public.situation_reports(company_id,created_at desc);
create index comments_report on public.comments(report_id,created_at);
create index attachments_report on public.attachments(report_id);
create index activity_company on public.activity_logs(company_id,created_at desc);
create index notifications_user on public.notifications(user_id,created_at desc);

create function public.company_role(target uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.memberships where company_id=target and user_id=auth.uid() and status='active'
$$;
create function public.is_member(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.company_role(target) is not null
$$;
create function public.is_manager(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.company_role(target) in ('company-admin','supervisor'),false)
$$;
create function public.can_write(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.company_role(target) in ('company-admin','supervisor','camp-manager','service-provider'),false)
$$;
create function public.new_user_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,full_name,email) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),120),new.email);
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_user_profile();
-- Backfill accounts created before this migration.
insert into public.profiles(id,full_name,email) select id,left(coalesce(raw_user_meta_data->>'full_name',''),120),email from auth.users on conflict do nothing;

create function public.company_directory(country text) returns table(id uuid,name text) language sql stable security definer set search_path='' as $$
 select c.id,c.name from public.companies c where c.country_code=country and auth.uid() is not null order by c.name
$$;
create function public.create_company(country text,company_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if exists(select 1 from public.memberships where user_id=auth.uid() and status in ('active','pending')) then raise exception 'An account can belong to one company'; end if;
 insert into public.companies(country_code,name,created_by) values(country,trim(company_name),auth.uid()) returning id into cid;
 insert into public.memberships(company_id,user_id,role,status) values(cid,auth.uid(),'company-admin','active');
 insert into public.issue_types(company_id,name,severity_default) values
 (cid,'Lost Pilgrim','high'),(cid,'Medical Emergency','critical'),(cid,'Crowd Congestion','high'),
 (cid,'Transportation Delay','medium'),(cid,'Water Shortage','high'),(cid,'Electricity Failure','medium'),
 (cid,'Security Concern','high'),(cid,'Missing Baggage','low'),(cid,'Fire Hazard','critical'),(cid,'Camp Maintenance','low') on conflict(company_id,name) do nothing;
 return cid;
end $$;
create function public.request_membership(target uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if exists(select 1 from public.memberships where user_id=auth.uid() and status in ('active','pending')) then raise exception 'You already have an active or pending membership'; end if;
 insert into public.memberships(company_id,user_id,role,status) values(target,auth.uid(),'viewer','pending')
 on conflict(company_id,user_id) do update set status='pending',role='viewer';
end $$;
create function public.review_membership(member_id uuid,new_role text,new_status text) returns void language plpgsql security definer set search_path='' as $$
declare m public.memberships;
begin
 select * into m from public.memberships where id=member_id for update;
 if public.company_role(m.company_id) is distinct from 'company-admin' then raise exception 'Company admin required'; end if;
 if m.user_id=auth.uid() then raise exception 'You cannot change your own membership'; end if;
 -- Serialize admin demotion checks to prevent concurrent removal of the final admin.
 perform 1 from public.companies where id=m.company_id for update;
 if new_status not in ('active','rejected') then raise exception 'Invalid status'; end if;
 update public.memberships set role=new_role,status=new_status where id=member_id;
end $$;
create function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare item jsonb; previous jsonb;
begin
 if TG_OP='DELETE' then item=to_jsonb(old); else item=to_jsonb(new); end if;
 if TG_OP<>'INSERT' then previous=to_jsonb(old); end if;
 insert into public.activity_logs(company_id,user_id,action,entity_type,entity_id,old_data,new_data)
 values((item->>'company_id')::uuid,auth.uid(),lower(TG_OP),TG_TABLE_NAME,(item->>'id')::uuid,previous,case when TG_OP='DELETE' then null else item end);
 if TG_OP='DELETE' then return old; else return new; end if;
end $$;
do $$ declare t text; begin
 foreach t in array array['memberships','camps','service_providers','issue_types','service_reports','situation_reports','comments','attachments'] loop
 execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_change()',t,t);
 end loop;
end $$;

create function public.guard_incident() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then
  if new.reported_by is distinct from auth.uid() or new.status not in ('draft','open') then raise exception 'Invalid report author or initial status'; end if;
 else
  if (new.company_id,new.id,new.reported_by,new.reported_at,new.report_no) is distinct from (old.company_id,old.id,old.reported_by,old.reported_at,old.report_no) then raise exception 'Report identity cannot be changed'; end if;
  if old.status='closed' then raise exception 'Closed reports are immutable'; end if;
  if new.status is distinct from old.status then
   if not ((old.status='draft' and new.status='open') or
    (old.status='open' and new.status in ('in-progress','resolved','escalated')) or
    (old.status='in-progress' and new.status in ('resolved','escalated')) or
    (old.status='escalated' and new.status='resolved') or
    (old.status='resolved' and new.status in ('closed','in-progress','escalated'))) then raise exception 'Invalid status transition'; end if;
   if new.status in ('escalated','closed') and not public.is_manager(new.company_id) then raise exception 'Supervisor approval required'; end if;
   if new.status='escalated' and not exists(select 1 from public.situation_reports where service_report_id=new.id) then raise exception 'Use the escalation operation'; end if;
   if new.status in ('resolved','closed') and length(trim(new.action_taken))=0 then raise exception 'Record the action taken before resolving'; end if;
  end if;
 end if;
 if new.assigned_to is not null and not exists(select 1 from public.memberships where company_id=new.company_id and user_id=new.assigned_to and status='active') then raise exception 'Assignee must be an active company member'; end if;
 new.updated_at=now(); return new;
end $$;
create trigger guard_report before insert or update on public.service_reports for each row execute function public.guard_incident();
create function public.guard_sitrep() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then
  if not public.is_manager(new.company_id) or new.reported_by is distinct from auth.uid() or new.status<>'draft' or new.approved_by is not null then raise exception 'Invalid situation report'; end if;
 else
  if (new.company_id,new.id,new.service_report_id,new.reported_by,new.created_at,new.sitrep_no) is distinct from (old.company_id,old.id,old.service_report_id,old.reported_by,old.created_at,old.sitrep_no) then raise exception 'Report identity cannot be changed'; end if;
  if old.status='approved' then raise exception 'Approved situation reports are immutable'; end if;
  if new.status is distinct from old.status and not ((old.status='draft' and new.status='submitted') or (old.status='submitted' and new.status in ('approved','draft'))) then raise exception 'Invalid situation report transition'; end if;
 end if;
 if new.status in ('submitted','approved') and (length(trim(new.impact))=0 or length(trim(new.recommendations))=0) then raise exception 'Impact and recommendations are required'; end if;
 new.approved_by=case when new.status='approved' then auth.uid() else null end;
 new.updated_at=now(); return new;
end $$;
create trigger guard_situation_report before insert or update on public.situation_reports for each row execute function public.guard_sitrep();

-- SECURITY INVOKER keeps table policies active throughout this atomic operation.
create function public.escalate_incident(incident_id uuid) returns uuid language plpgsql set search_path='' as $$
declare r public.service_reports; sid uuid;
begin
 select * into r from public.service_reports where id=incident_id for update;
 if r.id is null or not public.is_manager(r.company_id) then raise exception 'Supervisor access required'; end if;
 if r.status in ('draft','closed') then raise exception 'Submit the incident before escalation; closed reports cannot be escalated'; end if;
 insert into public.situation_reports(company_id,service_report_id,summary,immediate_actions,current_situation)
 values(r.company_id,r.id,r.title||E'\n'||r.description,r.action_taken,r.status)
 on conflict(service_report_id) do nothing;
 select id into sid from public.situation_reports where service_report_id=r.id;
 if r.status<>'escalated' then update public.service_reports set status='escalated' where id=r.id; end if;
 return sid;
end $$;
create function public.notify_report() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or new.status is distinct from old.status then
  insert into public.notifications(company_id,user_id,title,report_id)
  select new.company_id,user_id,new.report_no||': '||new.title||' ('||new.status||')',new.id
  from public.memberships where company_id=new.company_id and status='active';
 end if;
 return new;
end $$;
create trigger notify_incident after insert or update on public.service_reports for each row execute function public.notify_report();

-- Policies: no direct membership writes, no audit edits, no incident deletion.
alter table public.countries enable row level security;
create policy countries_read on public.countries for select to authenticated using(true);
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or exists(
 select 1 from public.memberships m where m.user_id=profiles.id and public.is_member(m.company_id) and m.status<>'rejected'));
alter table public.companies enable row level security;
create policy companies_read on public.companies for select to authenticated using(public.is_member(id) or exists(select 1 from public.memberships where company_id=companies.id and user_id=auth.uid()));
create policy companies_update on public.companies for update to authenticated using(public.company_role(id)='company-admin') with check(public.company_role(id)='company-admin');
alter table public.memberships enable row level security;
create policy memberships_read on public.memberships for select to authenticated using(user_id=auth.uid() or public.is_member(company_id));
do $$ declare t text; begin
 foreach t in array array['camps','service_providers','issue_types'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy read_rows on public.%I for select to authenticated using(public.is_member(company_id))',t);
 execute format('create policy insert_rows on public.%I for insert to authenticated with check(public.is_manager(company_id))',t);
 execute format('create policy update_rows on public.%I for update to authenticated using(public.is_manager(company_id)) with check(public.is_manager(company_id))',t);
 execute format('create policy delete_rows on public.%I for delete to authenticated using(public.is_manager(company_id))',t);
 end loop;
end $$;
alter table public.service_reports enable row level security;
create policy reports_read on public.service_reports for select to authenticated using(public.is_member(company_id));
create policy reports_insert on public.service_reports for insert to authenticated with check(public.can_write(company_id) and reported_by=auth.uid());
create policy reports_update on public.service_reports for update to authenticated using(public.can_write(company_id)) with check(public.can_write(company_id));
alter table public.situation_reports enable row level security;
create policy sitrep_read on public.situation_reports for select to authenticated using(public.is_member(company_id));
create policy sitrep_insert on public.situation_reports for insert to authenticated with check(public.is_manager(company_id));
create policy sitrep_update on public.situation_reports for update to authenticated using(public.is_manager(company_id)) with check(public.is_manager(company_id));
alter table public.comments enable row level security;
create policy comments_read on public.comments for select to authenticated using(public.is_member(company_id));
create policy comments_insert on public.comments for insert to authenticated with check(public.can_write(company_id) and author_id=auth.uid());
alter table public.attachments enable row level security;
create policy attachments_read on public.attachments for select to authenticated using(public.is_member(company_id));
create policy attachments_insert on public.attachments for insert to authenticated with check(public.can_write(company_id) and uploaded_by=auth.uid());
create policy attachments_delete on public.attachments for delete to authenticated using(public.is_manager(company_id) or (public.can_write(company_id) and uploaded_by=auth.uid()));
alter table public.activity_logs enable row level security;
create policy logs_read on public.activity_logs for select to authenticated using(public.is_manager(company_id));
alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid() and public.is_member(company_id));
create policy notifications_update on public.notifications for update to authenticated using(user_id=auth.uid() and public.is_member(company_id)) with check(user_id=auth.uid() and public.is_member(company_id));

-- Restrict column updates for public API clients.
revoke all on all tables in schema public from anon,authenticated;
grant select on all tables in schema public to authenticated;
grant insert,update,delete on public.camps,public.service_providers,public.issue_types to authenticated;
grant insert,update on public.service_reports,public.situation_reports to authenticated;
grant insert on public.comments to authenticated;
grant insert,delete on public.attachments to authenticated;
revoke update on public.companies from authenticated;
grant update(name,email,phone,address) on public.companies to authenticated;
revoke update on public.notifications from authenticated;
grant update(read_at) on public.notifications to authenticated;
revoke insert,update,delete on public.memberships,public.activity_logs,public.profiles,public.countries from authenticated;
grant usage on sequence public.incident_number_seq,public.sitrep_number_seq to authenticated;
revoke execute on all functions in schema public from public,anon;
grant execute on function public.company_role(uuid),public.is_member(uuid),public.is_manager(uuid),public.can_write(uuid),public.company_directory(text),public.create_company(text,text),public.request_membership(uuid),public.review_membership(uuid,text,text),public.escalate_incident(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('incident-attachments','incident-attachments',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict(id) do nothing;
-- Prefix is validated against an actual incident, without casting user-controlled paths.
create function public.attachment_access(object_path text,writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.service_reports r where r.company_id::text=split_part(object_path,'/',1)
 and r.id::text=split_part(object_path,'/',2) and case when writing then public.can_write(r.company_id) else public.is_member(r.company_id) end)
$$;
revoke execute on function public.attachment_access(text,boolean) from public,anon;
grant execute on function public.attachment_access(text,boolean) to authenticated;
create policy incident_files_read on storage.objects for select to authenticated using(bucket_id='incident-attachments' and public.attachment_access(name));
create policy incident_files_upload on storage.objects for insert to authenticated with check(bucket_id='incident-attachments' and public.attachment_access(name,true));
create policy incident_files_delete on storage.objects for delete to authenticated using(bucket_id='incident-attachments' and public.attachment_access(name,true) and (owner_id=auth.uid()::text or public.is_manager((select r.company_id from public.service_reports r where r.id::text=split_part(name,'/',2)))));
commit;
