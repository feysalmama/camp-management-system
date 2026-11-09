begin;
create unique index memberships_one_workspace on public.memberships(user_id) where status in ('active','pending');
create table public.platform_access (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 role text not null check(role in ('super-admin','country-admin')), country_code text references public.countries(code),
 check((role='super-admin' and country_code is null) or (role='country-admin' and country_code is not null)),
 created_at timestamptz not null default now()
);
create unique index platform_access_unique on public.platform_access(user_id,role,coalesce(country_code,''));
alter table public.platform_access enable row level security;
create function public.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.platform_access where user_id=auth.uid() and role='super-admin')
$$;
create function public.can_manage_country(country text) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_super_admin() or exists(select 1 from public.platform_access where user_id=auth.uid() and role='country-admin' and country_code=country)
$$;
create or replace function public.company_role(target uuid) returns text language sql stable security definer set search_path='' as $$
 select case when public.is_super_admin() then 'company-admin'
 when exists(select 1 from public.companies c where c.id=target and public.can_manage_country(c.country_code)) then 'supervisor'
 else (select role from public.memberships where company_id=target and user_id=auth.uid() and status='active') end
$$;
create policy access_read on public.platform_access for select to authenticated using(user_id=auth.uid() or public.is_super_admin());
create policy access_write on public.platform_access for all to authenticated using(public.is_super_admin() and user_id<>auth.uid()) with check(public.is_super_admin() and user_id<>auth.uid());
create policy countries_manage on public.countries for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy profiles_platform on public.profiles for select to authenticated using(public.is_super_admin());
create policy companies_platform_insert on public.companies for insert to authenticated with check(public.can_manage_country(country_code) and created_by=auth.uid());
create policy companies_platform_update on public.companies for update to authenticated using(public.can_manage_country(country_code)) with check(public.can_manage_country(country_code));
create function public.lookup_account(account_email text) returns table(id uuid,full_name text,email text) language sql stable security definer set search_path='' as $$
 select p.id,p.full_name,p.email from public.profiles p where lower(p.email)=lower(trim(account_email)) and public.is_super_admin()
$$;
create table public.movements (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 group_name text not null, origin text not null, destination text not null, scheduled_at timestamptz not null,
 pilgrim_count integer not null check(pilgrim_count>=0), arrived_count integer not null default 0 check(arrived_count>=0),
 transport text not null default '', leader text not null default '', contact_phone text not null default '',
 status text not null default 'planned' check(status in ('planned','departed','arrived','cancelled')),
 notes text not null default '', created_at timestamptz not null default now(), check(origin<>destination),
 check(status<>'arrived' or arrived_count=pilgrim_count)
);
create table public.camp_vacatings (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), camp_id uuid not null,
 departure_at timestamptz not null, pilgrims_expected integer not null check(pilgrims_expected>=0),
 pilgrims_verified integer not null default 0 check(pilgrims_verified>=0), baggage_expected integer not null default 0 check(baggage_expected>=0),
 baggage_verified integer not null default 0 check(baggage_verified>=0), transport_confirmed boolean not null default false,
 final_sweep_done boolean not null default false, status text not null default 'preparing' check(status in ('preparing','cleared')),
 notes text not null default '', created_at timestamptz not null default now(),
 foreign key(company_id,camp_id) references public.camps(company_id,id),
 check(status<>'cleared' or (pilgrims_expected=pilgrims_verified and baggage_expected=baggage_verified and transport_confirmed and final_sweep_done))
);
do $$ declare t text; begin
 foreach t in array array['movements','camp_vacatings'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy ops_read on public.%I for select to authenticated using(public.is_member(company_id))',t);
 execute format('create policy ops_insert on public.%I for insert to authenticated with check(public.can_write(company_id))',t);
 execute format('create policy ops_update on public.%I for update to authenticated using(public.can_write(company_id)) with check(public.can_write(company_id))',t);
 execute format('create trigger ops_audit after insert or update or delete on public.%I for each row execute function public.audit_change()',t);
 end loop;
end $$;
create index movements_company on public.movements(company_id,scheduled_at);
create index vacatings_company on public.camp_vacatings(company_id,departure_at);
create function public.notify_sitrep() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or new.status is distinct from old.status then
 insert into public.notifications(company_id,user_id,title,report_id)
 select new.company_id,user_id,new.sitrep_no||': situation report '||new.status,new.service_report_id
 from public.memberships where company_id=new.company_id and status='active' and role in ('company-admin','supervisor');
 end if; return new;
end $$;
create trigger notify_situation after insert or update on public.situation_reports for each row execute function public.notify_sitrep();
-- Explicit grants; elevated roles are assigned through SQL by the project owner initially.
revoke all on public.platform_access,public.movements,public.camp_vacatings from anon,authenticated;
grant select,insert,delete on public.platform_access to authenticated;
grant select,insert,update on public.movements,public.camp_vacatings to authenticated;
grant insert on public.companies to authenticated;
grant insert,update,delete on public.countries to authenticated;
revoke execute on function public.is_super_admin(),public.can_manage_country(text),public.lookup_account(text),public.notify_sitrep() from public,anon;
grant execute on function public.is_super_admin(),public.can_manage_country(text),public.lookup_account(text) to authenticated;
commit;
