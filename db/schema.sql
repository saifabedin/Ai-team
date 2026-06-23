-- ============================================================
-- ECM AI TEAM — schema (multi-tenant by brand_id)
-- All tables prefixed ait_ to coexist with existing ECM tables
-- in the shared Neon database. Idempotent (IF NOT EXISTS).
-- ============================================================

-- ---------- Brand registry ----------
create table if not exists ait_brands (
  id          bigserial primary key,
  brand_id    text not null unique,
  name        text not null,
  owner_email text not null,
  plan        text not null default 'free',   -- free|pro|enterprise
  status      text not null default 'active', -- active|suspended
  created_at  timestamptz not null default now()
);

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

-- ============================================================
-- FML HEALTH — Patient management schema (multi-tenant by brand_id)
-- All tables prefixed fmlh_ to coexist with ait_ ECM tables.
-- Idempotent (IF NOT EXISTS).
-- ============================================================

-- ---------- Patients ----------
create table if not exists fmlh_patients (
  id              bigserial primary key,
  brand_id        text not null,
  full_name       text not null,
  phone           text not null,
  email           text,
  dob             date,
  gender          text,                          -- male|female|other
  language        text not null default 'en',    -- en|hi|ta|te|mr|bn
  blood_group     text,
  allergies       text,
  medical_history jsonb not null default '[]',
  address         text,
  city            text,
  referral_code   text unique,
  referred_by     bigint references fmlh_patients(id) on delete set null,
  status          text not null default 'active', -- active|inactive|blacklisted
  preferred_channel text default 'whatsapp',     -- whatsapp|sms|email|chat
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists fmlh_patients_brand on fmlh_patients(brand_id, status);
create index if not exists fmlh_patients_phone on fmlh_patients(brand_id, phone);
create index if not exists fmlh_patients_referral on fmlh_patients(brand_id, referral_code);

-- ---------- Doctors ----------
create table if not exists fmlh_doctors (
  id                bigserial primary key,
  brand_id          text not null,
  full_name         text not null,
  specialty         text not null,               -- cardiologist|dermatologist|general|etc
  phone             text,
  email             text,
  calendar_id       text,                        -- Google Calendar ID
  consultation_fee  numeric(10,2) default 0,
  follow_up_fee     numeric(10,2) default 0,
  available_slots   jsonb not null default '{}', -- {"mon":[{"start":"09:00","end":"12:00"}],...}
  buffer_min        int not null default 15,     -- gap between appointments
  slot_duration_min int not null default 15,
  status            text not null default 'active',
  meta              jsonb not null default '{}',
  created_at        timestamptz not null default now()
);
create index if not exists fmlh_doctors_brand on fmlh_doctors(brand_id, status);
create index if not exists fmlh_doctors_specialty on fmlh_doctors(brand_id, specialty);

-- ---------- Appointments ----------
create table if not exists fmlh_appointments (
  id                  bigserial primary key,
  brand_id            text not null,
  patient_id          bigint not null references fmlh_patients(id) on delete cascade,
  doctor_id           bigint not null references fmlh_doctors(id) on delete cascade,
  scheduled_at        timestamptz not null,
  duration_min        int not null default 15,
  type                text not null default 'consultation', -- consultation|follow_up|emergency
  status              text not null default 'booked',
    -- booked|confirmed|arrived|in_consultation|completed|no_show|cancelled
  channel             text,                      -- whatsapp|sms|phone|walk_in|online
  reminder_24h_sent   boolean not null default false,
  reminder_2h_sent    boolean not null default false,
  reminder_30m_sent   boolean not null default false,
  pre_prep_status     text not null default 'pending',  -- pending|sent|acknowledged
  post_care_status    text not null default 'pending',  -- pending|sent|acknowledged
  notes               text,
  meta                jsonb not null default '{}',
  created_at          timestamptz not null default now()
);
create index if not exists fmlh_appt_brand_time on fmlh_appointments(brand_id, scheduled_at);
create index if not exists fmlh_appt_patient on fmlh_appointments(brand_id, patient_id);
create index if not exists fmlh_appt_doctor on fmlh_appointments(brand_id, doctor_id);
create index if not exists fmlh_appt_reminders
  on fmlh_appointments(brand_id, scheduled_at)
  where status in ('booked','confirmed');

-- ---------- Pre-appointment Prep ----------
create table if not exists fmlh_prep_workflows (
  id              bigserial primary key,
  brand_id        text not null,
  appointment_id  bigint not null references fmlh_appointments(id) on delete cascade,
  patient_id      bigint not null references fmlh_patients(id) on delete cascade,
  steps           jsonb not null default '[]',   -- [{step, instruction, sent, acknowledged}]
  current_step    int not null default 0,
  status          text not null default 'active', -- active|completed|skipped
  language        text not null default 'en',
  created_at      timestamptz not null default now()
);
create index if not exists fmlh_prep_appt on fmlh_prep_workflows(brand_id, appointment_id);

-- ---------- Aftercare ----------
create table if not exists fmlh_aftercare (
  id              bigserial primary key,
  brand_id        text not null,
  appointment_id  bigint not null references fmlh_appointments(id) on delete cascade,
  patient_id      bigint not null references fmlh_patients(id) on delete cascade,
  doctor_id       bigint references fmlh_doctors(id) on delete set null,
  instructions    jsonb not null default '[]',   -- [{type, detail, sent, acknowledged}]
  follow_up_date  date,
  medication      jsonb not null default '[]',
  diet_notes      text,
  warning_signs   jsonb not null default '[]',
  compliance      text not null default 'pending', -- pending|compliant|non_compliant
  language        text not null default 'en',
  created_at      timestamptz not null default now()
);
create index if not exists fmlh_aftercare_patient on fmlh_aftercare(brand_id, patient_id);

-- ---------- Reviews ----------
create table if not exists fmlh_reviews (
  id              bigserial primary key,
  brand_id        text not null,
  patient_id      bigint references fmlh_patients(id) on delete set null,
  appointment_id  bigint references fmlh_appointments(id) on delete set null,
  platform        text not null default 'google', -- google|practo|justdial|other
  rating          int,                           -- 1-5
  review_text     text,
  sentiment       text,                          -- positive|neutral|negative
  response        text,
  response_at     timestamptz,
  status          text not null default 'pending', -- pending|responded|escalated|hidden
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists fmlh_reviews_brand on fmlh_reviews(brand_id, status);
create index if not exists fmlh_reviews_sentiment on fmlh_reviews(brand_id, sentiment);

-- ---------- Referrals ----------
create table if not exists fmlh_referrals (
  id                    bigserial primary key,
  brand_id              text not null,
  referrer_patient_id   bigint not null references fmlh_patients(id) on delete cascade,
  referral_code         text not null,
  referred_name         text,
  referred_phone        text,
  referred_patient_id   bigint references fmlh_patients(id) on delete set null,
  status                text not null default 'pending', -- pending|contacted|converted|expired
  incentive_type        text,                            -- discount|free_consult|cash
  incentive_value       numeric(10,2) default 0,
  incentive_claimed     boolean not null default false,
  meta                  jsonb not null default '{}',
  created_at            timestamptz not null default now()
);
create index if not exists fmlh_referrals_code on fmlh_referrals(brand_id, referral_code);
create index if not exists fmlh_referrals_referrer on fmlh_referrals(brand_id, referrer_patient_id);

-- ---------- Patient Journey (audit trail) ----------
create table if not exists fmlh_patient_journey (
  id              bigserial primary key,
  brand_id        text not null,
  patient_id      bigint not null references fmlh_patients(id) on delete cascade,
  appointment_id  bigint references fmlh_appointments(id) on delete set null,
  stage           text not null,                 -- new|appointment_booked|prep_sent|visited|post_care|review_sent|referral_given|retained
  action          text not null,
  channel         text,
  actor           text default 'system',        -- system|aria|chronos|healer|sentinel|connector|doctor|patient
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists fmlh_journey_patient on fmlh_patient_journey(brand_id, patient_id);
create index if not exists fmlh_journey_stage on fmlh_patient_journey(brand_id, stage);

-- ---------- Messages (patient comms) ----------
create table if not exists fmlh_messages (
  id              bigserial primary key,
  brand_id        text not null,
  patient_id      bigint references fmlh_patients(id) on delete set null,
  channel         text not null,                 -- whatsapp|sms|chat|email
  direction       text not null default 'out',   -- in|out
  to_addr         text,
  body            text,
  status          text not null default 'queued', -- queued|sent|delivered|failed|replied
  provider        text,
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists fmlh_messages_patient on fmlh_messages(brand_id, patient_id);
create index if not exists fmlh_messages_brand_time on fmlh_messages(brand_id, created_at desc);

-- ============================================================
-- ECM AGENCY — Marketing agency operational schema
-- Tables prefixed ait_ (shared with existing ECM AI Team)
-- ============================================================

-- ---------- Campaigns ----------
create table if not exists ait_campaigns (
  id              bigserial primary key,
  brand_id        text not null,
  client_id       bigint references ait_clients(id) on delete set null,
  name            text not null,
  type            text not null default 'lead_gen', -- lead_gen|awareness|retargeting|seasonal|product_launch
  status          text not null default 'draft',    -- draft|active|paused|completed|cancelled
  budget          numeric(12,2) default 0,
  spend           numeric(12,2) default 0,
  currency        text default 'INR',
  start_date      date,
  end_date        date,
  channels        jsonb not null default '[]',      -- ["facebook","instagram","google","email"]
  target_audience jsonb not null default '{}',
  goals           jsonb not null default '{}',      -- {impressions:10000, clicks:500, leads:50}
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists ait_campaigns_brand on ait_campaigns(brand_id, status);
create index if not exists ait_campaigns_client on ait_campaigns(brand_id, client_id);

-- ---------- Social Accounts ----------
create table if not exists ait_social_accounts (
  id              bigserial primary key,
  brand_id        text not null,
  client_id       bigint references ait_clients(id) on delete cascade,
  platform        text not null,                   -- instagram|facebook|linkedin|twitter|youtube
  account_name    text,
  account_id      text,                            -- platform-specific ID
  access_token    text,
  refresh_token   text,
  token_expires   timestamptz,
  status          text not null default 'active',  -- active|expired|disconnected
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists ait_social_brand on ait_social_accounts(brand_id, client_id);

-- ---------- Social Posts (Content Calendar) ----------
create table if not exists ait_social_posts (
  id              bigserial primary key,
  brand_id        text not null,
  client_id       bigint references ait_clients(id) on delete cascade,
  campaign_id     bigint references ait_campaigns(id) on delete set null,
  content_id      bigint references ait_content(id) on delete set null,
  platform        text not null,                   -- instagram|facebook|linkedin|twitter|youtube
  post_type       text not null default 'image',   -- image|video|carousel|story|reel|text
  caption         text,
  media_urls      jsonb not null default '[]',
  hashtags        jsonb not null default '[]',
  scheduled_at    timestamptz,
  published_at    timestamptz,
  status          text not null default 'draft',   -- draft|scheduled|publishing|published|failed
  platform_post_id text,                           -- ID from platform after publish
  engagement      jsonb not null default '{}',     -- {likes, comments, shares, reach, impressions}
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists ait_social_brand_time on ait_social_posts(brand_id, scheduled_at);
create index if not exists ait_social_client on ait_social_posts(brand_id, client_id);
create index if not exists ait_social_status on ait_social_posts(brand_id, status)
  where status in ('draft','scheduled');

-- ---------- Ad Campaigns ----------
create table if not exists ait_ad_campaigns (
  id              bigserial primary key,
  brand_id        text not null,
  client_id       bigint references ait_clients(id) on delete cascade,
  campaign_id     bigint references ait_campaigns(id) on delete set null,
  platform        text not null,                   -- meta|google|linkedin
  account_id      text,                            -- ad account ID
  campaign_id_ext text,                            -- platform campaign ID
  name            text not null,
  objective       text,                            -- conversions|traffic|awareness|leads
  status          text not null default 'draft',   -- draft|active|paused|completed
  daily_budget    numeric(10,2),
  total_budget    numeric(10,2),
  spend           numeric(10,2) default 0,
  currency        text default 'INR',
  targeting       jsonb not null default '{}',
  creatives       jsonb not null default '[]',
  start_date      date,
  end_date        date,
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists ait_ads_brand on ait_ad_campaigns(brand_id, status);
create index if not exists ait_ads_client on ait_ad_campaigns(brand_id, client_id);

-- ---------- Ad Performance (daily metrics) ----------
create table if not exists ait_ad_metrics (
  id              bigserial primary key,
  brand_id        text not null,
  ad_campaign_id  bigint not null references ait_ad_campaigns(id) on delete cascade,
  date            date not null,
  impressions     int default 0,
  clicks          int default 0,
  ctr             numeric(5,2) default 0,
  cpc             numeric(8,2) default 0,
  cpm             numeric(8,2) default 0,
  spend           numeric(10,2) default 0,
  conversions     int default 0,
  cpa             numeric(8,2) default 0,
  roas            numeric(5,2) default 0,
  meta            jsonb not null default '{}',
  unique (ad_campaign_id, date)
);
create index if not exists ait_ad_metrics_date on ait_ad_metrics(brand_id, date);

-- ---------- Client Reports ----------
create table if not exists ait_client_reports (
  id              bigserial primary key,
  brand_id        text not null,
  client_id       bigint not null references ait_clients(id) on delete cascade,
  report_type     text not null default 'weekly',  -- weekly|monthly|custom
  period_start    date,
  period_end      date,
  summary         text,
  metrics         jsonb not null default '{}',     -- {impressions, clicks, leads, spend, roi}
  highlights      jsonb not null default '[]',
  recommendations jsonb not null default '[]',
  pdf_path        text,
  status          text not null default 'draft',   -- draft|sent|viewed
  sent_at         timestamptz,
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists ait_reports_brand on ait_client_reports(brand_id, client_id);
create index if not exists ait_reports_period on ait_client_reports(brand_id, period_start);

-- ---------- White-Label Config ----------
create table if not exists ait_white_label (
  id              bigserial primary key,
  brand_id        text not null unique,
  agency_name     text not null,
  logo_url        text,
  primary_color   text default '#2563eb',
  secondary_color text default '#1e40af',
  custom_domain   text,
  email_from_name text,
  email_from_addr text,
  favicon_url     text,
  css_overrides   jsonb not null default '{}',
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

-- ---------- Deliverables Tracking ----------
create table if not exists ait_deliverables (
  id              bigserial primary key,
  brand_id        text not null,
  client_id       bigint not null references ait_clients(id) on delete cascade,
  campaign_id     bigint references ait_campaigns(id) on delete set null,
  type            text not null,                   -- social_post|blog|ad_creative|video|report|email|other
  title           text,
  description     text,
  quantity        int not null default 1,
  unit            text default 'posts',            -- posts|blogs|ads|videos|hours
  status          text not null default 'planned', -- planned|in_progress|delivered|approved|revision
  due_date        date,
  delivered_at    timestamptz,
  approved_at     timestamptz,
  content_id      bigint references ait_content(id) on delete set null,
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists ait_deliverables_brand on ait_deliverables(brand_id, client_id);
create index if not exists ait_deliverables_status on ait_deliverables(brand_id, status);

-- ---------- Client Health Score ----------
create table if not exists ait_client_health (
  id              bigserial primary key,
  brand_id        text not null,
  client_id       bigint not null references ait_clients(id) on delete cascade,
  score           int not null default 50,         -- 0-100
  grade           text,                            -- A|B|C|D
  factors         jsonb not null default '{}',     -- {engagement:80, payment:90, satisfaction:70, churn_risk:20}
  churn_risk      int default 0,                   -- 0-100
  nps_score       int,                             -- -100 to 100
  last_survey_at  timestamptz,
  recommendations jsonb not null default '[]',
  calculated_at   timestamptz not null default now()
);
create index if not exists ait_health_brand on ait_client_health(brand_id, client_id);
