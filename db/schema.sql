-- ============================================================
-- ECM AI TEAM — schema (multi-tenant by brand_id)
-- All tables prefixed ait_ to coexist with existing ECM tables
-- in the shared Neon database. Idempotent (IF NOT EXISTS).
-- ============================================================

-- ---------- Identity / access ----------
create table if not exists ait_users (
  id            bigserial primary key,
  brand_id      text not null,
  email         text not null,
  name          text,
  role          text not null default 'viewer',  -- owner|admin|sales|marketing|cs|viewer
  telegram_id   text,
  created_at    timestamptz not null default now(),
  unique (brand_id, email)
);

-- ---------- CRM core ----------
create table if not exists ait_companies (
  id            bigserial primary key,
  brand_id      text not null,
  name          text not null,
  domain        text,
  website       text,
  industry      text,
  size          text,
  country       text,
  city          text,
  socials       jsonb not null default '{}',
  source        text,
  created_at    timestamptz not null default now(),
  unique (brand_id, domain)
);

create table if not exists ait_leads (
  id            bigserial primary key,
  brand_id      text not null,
  company_id    bigint references ait_companies(id) on delete set null,
  full_name     text,
  title         text,
  email         text,
  phone         text,
  linkedin_url  text,
  website       text,
  source        text,                         -- linkedin|gmaps|web|directory|manual
  status        text not null default 'new',  -- new|enriched|scored|contacted|engaged|qualified|meeting|won|lost
  owner_user_id bigint references ait_users(id) on delete set null,
  raw           jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ait_leads_brand_status on ait_leads(brand_id, status);

create table if not exists ait_lead_scores (
  id            bigserial primary key,
  brand_id      text not null,
  lead_id       bigint not null references ait_leads(id) on delete cascade,
  score         int not null,                 -- 0..100
  grade         text,                          -- A|B|C|D
  reasons       jsonb not null default '[]',
  scored_by     text,
  created_at    timestamptz not null default now()
);
create index if not exists ait_lead_scores_lead on ait_lead_scores(lead_id);

-- ---------- Activity / outreach ----------
create table if not exists ait_activities (
  id            bigserial primary key,
  brand_id      text not null,
  lead_id       bigint references ait_leads(id) on delete cascade,
  type          text not null,                 -- email|whatsapp|linkedin|call|note|status
  direction     text default 'out',            -- in|out
  channel       text,
  subject       text,
  body          text,
  meta          jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists ait_activities_lead on ait_activities(lead_id);

create table if not exists ait_sequences (
  id            bigserial primary key,
  brand_id      text not null,
  name          text not null,
  channel       text not null default 'email',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists ait_sequence_steps (
  id            bigserial primary key,
  sequence_id   bigint not null references ait_sequences(id) on delete cascade,
  step_no       int not null,
  delay_hours   int not null default 24,
  channel       text not null default 'email',
  template      text,                          -- prompt/template for the LLM
  created_at    timestamptz not null default now()
);

create table if not exists ait_enrollments (
  id            bigserial primary key,
  brand_id      text not null,
  lead_id       bigint not null references ait_leads(id) on delete cascade,
  sequence_id   bigint not null references ait_sequences(id) on delete cascade,
  current_step  int not null default 0,
  status        text not null default 'active', -- active|paused|done|replied
  next_run_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (lead_id, sequence_id)
);

create table if not exists ait_messages (
  id            bigserial primary key,
  brand_id      text not null,
  lead_id       bigint references ait_leads(id) on delete cascade,
  channel       text not null,                 -- email|whatsapp|linkedin
  direction     text not null default 'out',
  to_addr       text,
  subject       text,
  body          text,
  status        text not null default 'queued',-- queued|sent|delivered|failed|replied
  provider      text,
  meta          jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

-- ---------- Voice ----------
create table if not exists ait_calls (
  id            bigserial primary key,
  brand_id      text not null,
  lead_id       bigint references ait_leads(id) on delete cascade,
  direction     text not null default 'out',
  status        text not null default 'queued',-- queued|dialing|connected|completed|no-answer|failed
  outcome       text,                          -- booked|callback|not-interested|voicemail
  transcript    text,
  recording_url text,
  duration_sec  int,
  meta          jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

-- ---------- Meetings ----------
create table if not exists ait_meetings (
  id            bigserial primary key,
  brand_id      text not null,
  lead_id       bigint references ait_leads(id) on delete cascade,
  scheduled_at  timestamptz,
  status        text not null default 'booked', -- booked|confirmed|done|no-show|cancelled
  channel       text,                            -- gmeet|zoom|phone
  link          text,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ---------- Proposals / contracts ----------
create table if not exists ait_proposals (
  id            bigserial primary key,
  brand_id      text not null,
  lead_id       bigint references ait_leads(id) on delete set null,
  kind          text not null default 'proposal', -- proposal|quote|contract
  title         text,
  body          text,
  amount        numeric(12,2),
  currency      text default 'INR',
  status        text not null default 'draft',    -- draft|sent|accepted|rejected
  pdf_path      text,
  meta          jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

-- ---------- Clients / delivery ----------
create table if not exists ait_clients (
  id            bigserial primary key,
  brand_id      text not null,
  company_id    bigint references ait_companies(id) on delete set null,
  lead_id       bigint references ait_leads(id) on delete set null,
  name          text not null,
  status        text not null default 'onboarding', -- onboarding|active|paused|churned
  mrr           numeric(12,2) default 0,
  health        text default 'green',                -- green|amber|red
  created_at    timestamptz not null default now()
);

create table if not exists ait_projects (
  id            bigserial primary key,
  brand_id      text not null,
  client_id     bigint references ait_clients(id) on delete cascade,
  name          text not null,
  status        text not null default 'active',
  progress      int not null default 0,
  due_at        timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists ait_tasks (
  id            bigserial primary key,
  brand_id      text not null,
  project_id    bigint references ait_projects(id) on delete cascade,
  title         text not null,
  status        text not null default 'todo',  -- todo|doing|done
  assignee      text,
  due_at        timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------- Content ----------
create table if not exists ait_content (
  id            bigserial primary key,
  brand_id      text not null,
  kind          text not null,                 -- social|blog|ad|video_script|brief
  topic         text,
  title         text,
  body          text,
  status        text not null default 'draft', -- draft|approved|published
  meta          jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

-- ---------- Platform: agents, memory, bus, audit ----------
create table if not exists ait_agent_runs (
  id            bigserial primary key,
  brand_id      text not null,
  agent         text not null,
  department    text not null,
  label         text,
  status        text not null default 'running', -- running|done|error
  ms            int,
  result        jsonb,
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index if not exists ait_agent_runs_brand on ait_agent_runs(brand_id, started_at desc);

create table if not exists ait_agent_memory (
  id            bigserial primary key,
  brand_id      text not null,
  namespace     text not null,
  mem_key       text not null,
  value         jsonb,
  meta          jsonb not null default '{}',
  updated_at    timestamptz not null default now(),
  unique (brand_id, namespace, mem_key)
);

create table if not exists ait_agent_messages (
  id            bigserial primary key,
  brand_id      text not null,
  from_agent    text not null,
  to_agent      text not null,
  topic         text,
  payload       jsonb not null default '{}',
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists ait_agent_messages_to on ait_agent_messages(brand_id, to_agent, created_at desc);

create table if not exists ait_audit_log (
  id            bigserial primary key,
  brand_id      text not null,
  actor         text not null default 'system',
  action        text not null,
  entity        text,
  entity_id     text,
  meta          jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists ait_audit_brand on ait_audit_log(brand_id, created_at desc);

-- Auth: api_key_hash for JWT login (idempotent alter)
alter table ait_users add column if not exists api_key_hash text;
alter table ait_users add column if not exists password_changed_at timestamptz;

-- updated_at on tables that were missing it
alter table ait_companies   add column if not exists updated_at timestamptz not null default now();
alter table ait_enrollments add column if not exists updated_at timestamptz not null default now();
alter table ait_messages    add column if not exists updated_at timestamptz not null default now();

-- Performance indexes for autopilot hot paths
create index if not exists ait_enrollments_due
  on ait_enrollments(brand_id, next_run_at)
  where status = 'active';

create index if not exists ait_enrollments_lead
  on ait_enrollments(brand_id, lead_id, status);

create index if not exists ait_lead_scores_brand_grade
  on ait_lead_scores(brand_id, grade);

create index if not exists ait_leads_updated
  on ait_leads(brand_id, updated_at)
  where status in ('contacted','engaged');

create index if not exists ait_messages_lead
  on ait_messages(brand_id, lead_id);
