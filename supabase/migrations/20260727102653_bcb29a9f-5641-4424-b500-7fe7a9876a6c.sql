-- Enums -------------------------------------------------------------------
create type public.risk_level as enum ('low','medium','high');
create type public.conversation_status as enum ('new','in_review','escalated','resolved','closed');
create type public.emotion_label as enum ('satisfied','happy','confused','frustrated','angry','neutral');

-- Conversations: intelligence columns -------------------------------------
alter table public.conversations
  add column risk_level public.risk_level not null default 'low',
  add column status public.conversation_status not null default 'new',
  add column emotion public.emotion_label not null default 'neutral',
  add column secondary_language_code text,
  add column language_confidence numeric not null default 0.9;

create index if not exists conversations_risk_idx on public.conversations (company_id, risk_level);
create index if not exists conversations_status_idx on public.conversations (company_id, status);

-- Detected keywords per conversation --------------------------------------
create table public.conversation_keywords (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  keyword text not null,
  category text not null default 'custom',
  confidence numeric not null default 0.8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.conversation_keywords to authenticated;
grant all on public.conversation_keywords to service_role;

alter table public.conversation_keywords enable row level security;

create policy "conversation_keywords_select" on public.conversation_keywords
  for select to authenticated using (company_id = public.current_company_id());
create policy "conversation_keywords_insert" on public.conversation_keywords
  for insert to authenticated
  with check (company_id = public.current_company_id() and public.can_operate());
create policy "conversation_keywords_update" on public.conversation_keywords
  for update to authenticated
  using (company_id = public.current_company_id() and public.can_operate())
  with check (company_id = public.current_company_id());
create policy "conversation_keywords_delete" on public.conversation_keywords
  for delete to authenticated
  using (company_id = public.current_company_id() and public.is_company_admin());

create index conversation_keywords_conv_idx on public.conversation_keywords (conversation_id);
create index conversation_keywords_term_idx on public.conversation_keywords (company_id, keyword);

create trigger conversation_keywords_updated_at
  before update on public.conversation_keywords
  for each row execute function public.set_updated_at();

-- Conversation timeline events --------------------------------------------
create table public.conversation_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  label text not null,
  detail text,
  sequence integer not null default 0,
  offset_ms integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.conversation_events to authenticated;
grant all on public.conversation_events to service_role;

alter table public.conversation_events enable row level security;

create policy "conversation_events_select" on public.conversation_events
  for select to authenticated using (company_id = public.current_company_id());
create policy "conversation_events_insert" on public.conversation_events
  for insert to authenticated
  with check (company_id = public.current_company_id() and public.can_operate());
create policy "conversation_events_update" on public.conversation_events
  for update to authenticated
  using (company_id = public.current_company_id() and public.can_operate())
  with check (company_id = public.current_company_id());
create policy "conversation_events_delete" on public.conversation_events
  for delete to authenticated
  using (company_id = public.current_company_id() and public.is_company_admin());

create index conversation_events_conv_idx on public.conversation_events (conversation_id, sequence);

create trigger conversation_events_updated_at
  before update on public.conversation_events
  for each row execute function public.set_updated_at();

-- Languages: detection confidence -----------------------------------------
alter table public.languages
  add column detection_confidence numeric not null default 0.9;