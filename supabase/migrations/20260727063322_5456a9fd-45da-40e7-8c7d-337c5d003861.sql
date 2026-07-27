
-- ============ ENUMS ============
create type public.app_role as enum ('super_admin','tenant_admin','regional_manager','outlet_manager','supervisor','viewer');
create type public.entity_status as enum ('active','inactive','suspended','archived');
create type public.camera_status as enum ('online','offline','degraded','maintenance');
create type public.alert_severity as enum ('critical','high','medium','low','info');
create type public.alert_status as enum ('open','acknowledged','resolved','dismissed');
create type public.sentiment_label as enum ('very_negative','negative','neutral','positive','very_positive');

-- ============ SHARED TRIGGER ============
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ TABLES ============
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  industry text not null default 'retail',
  logo_url text,
  contact_email text,
  contact_phone text,
  address text,
  subscription_plan text not null default 'enterprise',
  status public.entity_status not null default 'active',
  timezone text not null default 'UTC',
  preferred_languages text[] not null default '{en}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create table public.outlets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text not null,
  address text,
  city text,
  country text,
  region text,
  timezone text not null default 'UTC',
  manager_name text,
  manager_email text,
  status public.entity_status not null default 'active',
  opened_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create table public.cameras (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  outlet_id uuid references public.outlets(id) on delete set null,
  name text not null,
  rtsp_url text,
  location text,
  status public.camera_status not null default 'online',
  audio_enabled boolean not null default true,
  firmware text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  outlet_id uuid references public.outlets(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  job_title text,
  directory_role public.app_role not null default 'viewer',
  status public.entity_status not null default 'active',
  avatar_url text,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  company_id uuid references public.companies(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.languages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  native_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz,
  unique (company_id, code)
);

create table public.keywords (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  term text not null,
  category text not null default 'general',
  weight numeric(4,2) not null default 1.0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  outlet_id uuid references public.outlets(id) on delete set null,
  camera_id uuid references public.cameras(id) on delete set null,
  reference text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  language_code text not null default 'en',
  sentiment_score numeric(4,3) not null default 0,
  sentiment public.sentiment_label not null default 'neutral',
  topic text,
  agent_name text,
  customer_type text,
  escalated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  speaker text not null,
  sequence integer not null default 0,
  content text not null,
  start_ms integer not null default 0,
  end_ms integer not null default 0,
  confidence numeric(4,3) not null default 0.9,
  language_code text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  summary text not null,
  key_points text[] not null default '{}',
  intent text,
  resolution_status text not null default 'resolved',
  model text not null default 'aegis-cx-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  outlet_id uuid references public.outlets(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  title text not null,
  description text,
  category text not null default 'service_quality',
  severity public.alert_severity not null default 'medium',
  status public.alert_status not null default 'open',
  triggered_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  ip_address text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============ INDEXES ============
create index idx_outlets_company on public.outlets(company_id);
create index idx_cameras_company on public.cameras(company_id);
create index idx_cameras_outlet on public.cameras(outlet_id);
create index idx_profiles_company on public.profiles(company_id);
create index idx_profiles_user on public.profiles(user_id);
create index idx_user_roles_user on public.user_roles(user_id);
create index idx_languages_company on public.languages(company_id);
create index idx_keywords_company on public.keywords(company_id);
create index idx_conversations_company_started on public.conversations(company_id, started_at desc);
create index idx_conversations_outlet on public.conversations(outlet_id);
create index idx_conversations_sentiment on public.conversations(sentiment);
create index idx_transcripts_conversation on public.transcripts(conversation_id);
create index idx_summaries_conversation on public.summaries(conversation_id);
create index idx_alerts_company_triggered on public.alerts(company_id, triggered_at desc);
create index idx_audit_logs_company_created on public.audit_logs(company_id, created_at desc);

-- ============ TRIGGERS ============
do $$
declare t text;
begin
  foreach t in array array['companies','outlets','cameras','profiles','languages','keywords','conversations','transcripts','summaries','alerts']
  loop
    execute format('create trigger set_updated_at_%1$s before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ============ SECURITY DEFINER HELPERS ============
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_company_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'tenant_admin');
$$;

create or replace function public.can_operate()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'super_admin')
      or public.has_role(auth.uid(),'tenant_admin')
      or public.has_role(auth.uid(),'regional_manager')
      or public.has_role(auth.uid(),'outlet_manager')
      or public.has_role(auth.uid(),'supervisor');
$$;

-- ============ GRANTS ============
grant select, insert, update, delete on public.companies, public.outlets, public.cameras,
  public.profiles, public.languages, public.keywords, public.conversations,
  public.transcripts, public.summaries, public.alerts to authenticated;
grant select on public.user_roles, public.audit_logs to authenticated;
grant all on public.companies, public.outlets, public.cameras, public.profiles, public.user_roles,
  public.languages, public.keywords, public.conversations, public.transcripts, public.summaries,
  public.alerts, public.audit_logs to service_role;

-- ============ RLS ============
alter table public.companies enable row level security;
alter table public.outlets enable row level security;
alter table public.cameras enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.languages enable row level security;
alter table public.keywords enable row level security;
alter table public.conversations enable row level security;
alter table public.transcripts enable row level security;
alter table public.summaries enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_logs enable row level security;

create policy "roles_read_own" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'super_admin'));

create policy "companies_read" on public.companies for select to authenticated
  using (id = public.current_company_id() or public.has_role(auth.uid(),'super_admin'));
create policy "companies_write" on public.companies for update to authenticated
  using ((id = public.current_company_id() and public.is_company_admin()) or public.has_role(auth.uid(),'super_admin'))
  with check ((id = public.current_company_id() and public.is_company_admin()) or public.has_role(auth.uid(),'super_admin'));
create policy "companies_insert" on public.companies for insert to authenticated
  with check (public.has_role(auth.uid(),'super_admin'));

do $$
declare t text;
begin
  foreach t in array array['outlets','cameras','languages','keywords','conversations','transcripts','summaries']
  loop
    execute format($f$
      create policy "%1$s_tenant_read" on public.%1$s for select to authenticated
        using (company_id = public.current_company_id() or public.has_role(auth.uid(),'super_admin'));
      create policy "%1$s_tenant_insert" on public.%1$s for insert to authenticated
        with check (company_id = public.current_company_id() and public.is_company_admin());
      create policy "%1$s_tenant_update" on public.%1$s for update to authenticated
        using (company_id = public.current_company_id() and public.is_company_admin())
        with check (company_id = public.current_company_id() and public.is_company_admin());
      create policy "%1$s_tenant_delete" on public.%1$s for delete to authenticated
        using (company_id = public.current_company_id() and public.is_company_admin());
    $f$, t);
  end loop;
end $$;

create policy "profiles_tenant_read" on public.profiles for select to authenticated
  using (company_id = public.current_company_id() or public.has_role(auth.uid(),'super_admin'));
create policy "profiles_self_update" on public.profiles for update to authenticated
  using (user_id = auth.uid() or (company_id = public.current_company_id() and public.is_company_admin()))
  with check (user_id = auth.uid() or (company_id = public.current_company_id() and public.is_company_admin()));
create policy "profiles_admin_insert" on public.profiles for insert to authenticated
  with check (company_id = public.current_company_id() and public.is_company_admin());
create policy "profiles_admin_delete" on public.profiles for delete to authenticated
  using (company_id = public.current_company_id() and public.is_company_admin());

create policy "alerts_tenant_read" on public.alerts for select to authenticated
  using (company_id = public.current_company_id() or public.has_role(auth.uid(),'super_admin'));
create policy "alerts_operate_update" on public.alerts for update to authenticated
  using (company_id = public.current_company_id() and public.can_operate())
  with check (company_id = public.current_company_id() and public.can_operate());
create policy "alerts_admin_insert" on public.alerts for insert to authenticated
  with check (company_id = public.current_company_id() and public.is_company_admin());
create policy "alerts_admin_delete" on public.alerts for delete to authenticated
  using (company_id = public.current_company_id() and public.is_company_admin());

create policy "audit_logs_admin_read" on public.audit_logs for select to authenticated
  using ((company_id = public.current_company_id() and public.is_company_admin()) or public.has_role(auth.uid(),'super_admin'));

-- ============ NEW USER BOOTSTRAP ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare demo_company uuid := '11111111-1111-4111-8111-111111111111';
begin
  insert into public.profiles (user_id, company_id, full_name, email, job_title, directory_role)
  values (new.id, demo_company,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email, 'Platform User', 'tenant_admin')
  on conflict (user_id) do nothing;
  insert into public.user_roles (user_id, company_id, role)
  values (new.id, demo_company, 'tenant_admin')
  on conflict (user_id, role) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ DEMO DATA ============
insert into public.companies (id, name, legal_name, industry, contact_email, contact_phone, address, subscription_plan, status, timezone, preferred_languages)
values ('11111111-1111-4111-8111-111111111111','Meridian Retail Group','Meridian Retail Group PLC','retail','operations@meridianretail.com','+44 20 7946 0812','120 Kingsway, London WC2B 6PA, United Kingdom','enterprise','active','Europe/London', array['en','ar','fr','es','hi','zh']);

insert into public.languages (company_id, code, name, native_name, is_active) values
('11111111-1111-4111-8111-111111111111','en','English','English',true),
('11111111-1111-4111-8111-111111111111','ar','Arabic','العربية',true),
('11111111-1111-4111-8111-111111111111','fr','French','Français',true),
('11111111-1111-4111-8111-111111111111','es','Spanish','Español',true),
('11111111-1111-4111-8111-111111111111','hi','Hindi','हिन्दी',true),
('11111111-1111-4111-8111-111111111111','zh','Mandarin','中文',true);

insert into public.outlets (id, company_id, name, code, address, city, country, region, timezone, manager_name, manager_email, status, opened_at) values
('22222222-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Meridian Oxford Street','MRG-LON-01','311 Oxford Street','London','United Kingdom','London & South East','Europe/London','Charlotte Ellis','charlotte.ellis@meridianretail.com','active','2016-03-14'),
('22222222-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','Meridian Canary Wharf','MRG-LON-02','Cabot Place, Canary Wharf','London','United Kingdom','London & South East','Europe/London','Daniel Okafor','daniel.okafor@meridianretail.com','active','2018-09-01'),
('22222222-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','Meridian Manchester Arndale','MRG-MAN-01','Market Street, Arndale Centre','Manchester','United Kingdom','North West','Europe/London','Priya Raman','priya.raman@meridianretail.com','active','2019-05-22'),
('22222222-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','Meridian Birmingham Bullring','MRG-BHM-01','Bullring Shopping Centre','Birmingham','United Kingdom','Midlands','Europe/London','Tomasz Nowak','tomasz.nowak@meridianretail.com','active','2020-11-10'),
('22222222-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','Meridian Dubai Mall','MRG-DXB-01','Financial Center Road, Downtown','Dubai','United Arab Emirates','Middle East','Asia/Dubai','Amira Haddad','amira.haddad@meridianretail.com','active','2022-02-18');

-- 32 cameras
insert into public.cameras (company_id, outlet_id, name, rtsp_url, location, status, audio_enabled, firmware, last_seen_at)
select '11111111-1111-4111-8111-111111111111',
       o.id,
       o.code || '-CAM-' || lpad(g::text,2,'0'),
       'rtsp://stream.meridianretail.internal/' || lower(o.code) || '/cam' || lpad(g::text,2,'0'),
       (array['Main Entrance','Checkout Lane 1','Checkout Lane 2','Customer Service Desk','Returns Counter','Electronics Aisle','Fitting Rooms'])[1 + ((g + row_number() over ())::int % 7)],
       (array['online','online','online','online','degraded','offline','maintenance'])[1 + ((g)::int % 7)]::public.camera_status,
       (g % 5) <> 0,
       'AegisEdge 4.2.1',
       now() - ((g * 7)::text || ' minutes')::interval
from public.outlets o
cross join generate_series(1, 7) g
where o.company_id = '11111111-1111-4111-8111-111111111111'
limit 32;

-- 50 staff profiles
insert into public.profiles (company_id, outlet_id, full_name, email, phone, job_title, directory_role, status, last_active_at)
select '11111111-1111-4111-8111-111111111111',
  (select id from public.outlets order by code limit 1 offset (i % 5)),
  fn || ' ' || ln,
  lower(fn) || '.' || lower(ln) || i || '@meridianretail.com',
  '+44 7' || lpad(((i * 137) % 1000000)::text, 9, '0'),
  (array['Store Associate','Shift Supervisor','Outlet Manager','Regional Manager','CX Analyst','Operations Lead'])[1 + (i % 6)],
  (array['viewer','supervisor','outlet_manager','regional_manager','viewer','tenant_admin'])[1 + (i % 6)]::public.app_role,
  case when i % 17 = 0 then 'inactive' else 'active' end::public.entity_status,
  now() - ((i * 41)::text || ' minutes')::interval
from generate_series(1,50) i,
lateral (select (array['Amelia','Noah','Sofia','Liam','Aisha','Mateo','Chloe','Omar','Isabella','Ethan'])[1 + (i % 10)] as fn,
                (array['Whitfield','Adeyemi','Bianchi','Kaur','Hassan','Silva','Novak','Rahman','Fischer','Okonkwo'])[1 + ((i*3) % 10)] as ln) n;

insert into public.keywords (company_id, term, category, weight)
select '11111111-1111-4111-8111-111111111111', t.term, t.category, t.weight
from (values
 ('refund','service',2.0),('waiting time','experience',2.5),('out of stock','inventory',2.2),
 ('rude','risk',3.0),('discount','sales',1.4),('warranty','service',1.8),
 ('manager','escalation',2.6),('price match','sales',1.6),('delivery','logistics',1.9),
 ('faulty','quality',2.8),('exchange','service',1.5),('loyalty card','sales',1.2),
 ('complaint','risk',3.0),('queue','experience',2.1),('helpful','positive',1.1),
 ('thank you','positive',1.0),('cancel order','risk',2.4),('installation','service',1.7),
 ('damaged','quality',2.7),('gift card','sales',1.3),('slow','experience',2.0),
 ('escalate','escalation',2.9),('fraud','risk',3.0),('recommend','positive',1.2)
) as t(term, category, weight);

-- 1,000 conversations
insert into public.conversations (company_id, outlet_id, camera_id, reference, started_at, ended_at, duration_seconds, language_code, sentiment_score, sentiment, topic, agent_name, customer_type, escalated)
select '11111111-1111-4111-8111-111111111111',
  c.outlet_id, c.id,
  'CVX-' || to_char(now() - ((i % 90)::text || ' days')::interval, 'YYYYMMDD') || '-' || lpad(i::text, 5, '0'),
  started, started + ((dur)::text || ' seconds')::interval, dur,
  (array['en','en','en','ar','fr','es','hi','zh'])[1 + (i % 8)],
  score,
  case when score < -0.6 then 'very_negative' when score < -0.2 then 'negative'
       when score < 0.2 then 'neutral' when score < 0.6 then 'positive' else 'very_positive' end::public.sentiment_label,
  (array['Refund request','Product availability','Warranty claim','Checkout experience','Delivery status','Price enquiry','Loyalty programme','Technical support'])[1 + (i % 8)],
  (array['Charlotte Ellis','Daniel Okafor','Priya Raman','Tomasz Nowak','Amira Haddad','Noah Adeyemi','Sofia Bianchi'])[1 + (i % 7)],
  (array['new','returning','vip','walk-in'])[1 + (i % 4)],
  score < -0.55
from generate_series(1,1000) i
cross join lateral (select id, outlet_id from public.cameras order by md5(id::text || i::text) limit 1) c
cross join lateral (select (now() - ((i % 90)::text || ' days')::interval - ((i % 540)::text || ' minutes')::interval) as started,
                           (60 + (i * 7) % 900) as dur,
                           round((sin(i::numeric / 11) * 0.75)::numeric, 3) as score) v;

insert into public.summaries (company_id, conversation_id, summary, key_points, intent, resolution_status)
select company_id, id,
  'Customer discussed ' || lower(topic) || ' with ' || agent_name || ' at the ' || coalesce(language_code,'en') || ' service point. Interaction lasted ' || duration_seconds || ' seconds and closed with a ' || replace(sentiment::text,'_',' ') || ' tone.',
  array[topic, 'Sentiment ' || sentiment::text, case when escalated then 'Escalated to manager' else 'Handled in first contact' end],
  topic,
  case when escalated then 'escalated' when sentiment_score < 0 then 'follow_up' else 'resolved' end
from public.conversations;

insert into public.transcripts (company_id, conversation_id, speaker, sequence, content, start_ms, end_ms, confidence, language_code)
select c.company_id, c.id, s.speaker, s.seq, s.content, s.seq * 4000, s.seq * 4000 + 3500, 0.88 + (s.seq::numeric / 100), c.language_code
from public.conversations c
cross join lateral (values
  (1,'customer','Hi, I need help with ' || lower(c.topic) || ' please.'),
  (2,'agent','Of course, I can help with that. May I take your order reference?'),
  (3,'customer','Yes, it is ' || c.reference || '.'),
  (4,'agent','Thank you. Let me check that for you right now.')
) as s(seq, speaker, content);

insert into public.alerts (company_id, outlet_id, conversation_id, title, description, category, severity, status, triggered_at)
select c.company_id, c.outlet_id, c.id,
  'Negative sentiment detected — ' || c.topic,
  'Conversation ' || c.reference || ' recorded a sentiment score of ' || c.sentiment_score || ' with escalation keywords present.',
  (array['service_quality','risk','compliance','staffing','experience'])[1 + (row_number() over (order by c.started_at desc))::int % 5],
  case when c.sentiment_score < -0.7 then 'critical' when c.sentiment_score < -0.6 then 'high' else 'medium' end::public.alert_severity,
  (array['open','open','acknowledged','resolved'])[1 + (row_number() over (order by c.started_at desc))::int % 4]::public.alert_status,
  c.started_at
from public.conversations c
where c.sentiment_score < -0.55
limit 120;

insert into public.audit_logs (company_id, actor_name, action, entity_type, ip_address, metadata, created_at)
select '11111111-1111-4111-8111-111111111111',
  (array['Charlotte Ellis','Daniel Okafor','Priya Raman','System','Amira Haddad'])[1 + (i % 5)],
  (array['user.login','camera.updated','outlet.created','alert.acknowledged','settings.updated','report.exported'])[1 + (i % 6)],
  (array['user','camera','outlet','alert','settings','report'])[1 + (i % 6)],
  '10.24.' || (i % 250) || '.' || ((i * 7) % 250),
  jsonb_build_object('source','web','session', 'sess_' || lpad(i::text,6,'0')),
  now() - ((i * 97)::text || ' minutes')::interval
from generate_series(1,80) i;
