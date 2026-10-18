-- Creattivamente / CreaCloud – schema iniziale
-- Orari in minuti dalla mezzanotte, giorni 0 = lunedì … 6 = domenica,
-- importi in centesimi di euro (IVA esclusa, gestita a parte).

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ staff

create table staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'coordinatore' check (role in ('titolare', 'coordinatore')),
  created_at timestamptz not null default now()
);

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where id = auth.uid());
$$;

-- ------------------------------------------------------------------ anagrafiche

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text not null default '',
  privacy_consent_at timestamptz,
  minors_contact_consent boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table parents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  first_name text not null,
  last_name text not null default '',
  phone text unique,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  first_name text not null,
  last_name text not null default '',
  school_level text not null default '',
  phone text unique,
  hourly_rate_cents integer,
  group_hourly_rate_cents integer,
  max_lessons_per_day smallint,
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table tutors (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null default '',
  phone text unique,
  email text,
  modes text[] not null default array['presenza', 'online'],
  hourly_rate_cents integer not null default 0,
  group_hourly_rate_cents integer,
  max_weekly_minutes integer,
  max_daily_minutes integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table tutor_subjects (
  tutor_id uuid not null references tutors (id) on delete cascade,
  subject_id uuid not null references subjects (id) on delete cascade,
  levels text[] not null default '{}',
  primary key (tutor_id, subject_id)
);

create table tutor_availability (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_min smallint not null check (start_min between 0 and 1440),
  end_min smallint not null check (end_min between 0 and 1440),
  source text not null default 'coordinatore' check (source in ('ai', 'coordinatore')),
  created_at timestamptz not null default now(),
  check (end_min > start_min)
);

create table tutor_absences (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  date date not null,
  start_min smallint not null default 0,
  end_min smallint not null default 1440,
  note text not null default '',
  source text not null default 'coordinatore' check (source in ('ai', 'coordinatore')),
  created_at timestamptz not null default now(),
  check (end_min > start_min)
);

-- Impegni degli studenti con priorità: 1 inderogabile … 4 gradimento.
create table student_constraints (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  priority smallint not null check (priority between 1 and 4),
  category text not null default 'altro',
  label text not null,
  weekday smallint check (weekday between 0 and 6),
  date date,
  start_min smallint not null default 0,
  end_min smallint not null default 1440,
  valid_from date,
  valid_to date,
  source text not null default 'coordinatore' check (source in ('ai', 'coordinatore')),
  priority_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_min > start_min),
  check ((weekday is null) <> (date is null))
);

-- ------------------------------------------------------------------ centro

create table center_hours (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  start_min smallint not null,
  end_min smallint not null,
  check (end_min > start_min)
);

create table center_closures (
  date date primary key,
  note text not null default ''
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacity smallint not null default 1 check (capacity >= 1),
  active boolean not null default true
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into settings (key, value) values
  ('whatsapp_provider', '"baileys"'),
  ('cancellation_hours', '24'),
  ('default_hourly_rate_cents', '2000'),
  ('default_group_hourly_rate_cents', '1500'),
  ('default_tutor_hourly_rate_cents', '1200'),
  ('default_tutor_group_hourly_rate_cents', '1500'),
  ('ai_monthly_budget_eur', '14'),
  ('ai_enabled', 'true'),
  ('engine_weights', '{}');

-- ------------------------------------------------------------------ lezioni

create table lesson_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'ricorrente' check (kind in ('ricorrente', 'singola')),
  subject_id uuid not null references subjects (id),
  sessions_per_week smallint not null default 1 check (sessions_per_week between 1 and 7),
  duration_min smallint not null default 60 check (duration_min in (60, 90, 120)),
  flexible_duration boolean not null default true,
  mode text not null default 'presenza' check (mode in ('presenza', 'online', 'indifferente')),
  preferred_tutor_id uuid references tutors (id),
  priority smallint not null default 2 check (priority between 1 and 3),
  topic text,
  window_from date,
  window_to date,
  valid_from date not null default current_date,
  valid_to date,
  -- i gruppi richiedono l'autorizzazione del coordinatore
  status text not null default 'attiva'
    check (status in ('attiva', 'da_approvare', 'sospesa', 'chiusa')),
  approved_by uuid references staff (id),
  approved_at timestamptz,
  notes text not null default '',
  source text not null default 'coordinatore' check (source in ('ai', 'coordinatore')),
  created_at timestamptz not null default now()
);

create table lesson_request_students (
  request_id uuid not null references lesson_requests (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  primary key (request_id, student_id)
);

create table planning_runs (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  status text not null default 'bozza' check (status in ('bozza', 'confermato', 'scartato', 'errore')),
  problem jsonb,
  solution jsonb,
  error text,
  created_by uuid references staff (id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references lesson_requests (id) on delete set null,
  session_index smallint not null default 0,
  run_id uuid references planning_runs (id) on delete set null,
  subject_id uuid not null references subjects (id),
  tutor_id uuid not null references tutors (id),
  room_id uuid references rooms (id),
  date date not null,
  start_min smallint not null,
  end_min smallint not null,
  mode text not null check (mode in ('presenza', 'online')),
  status text not null default 'programmata' check (status in (
    'programmata', 'svolta', 'annullata_in_tempo', 'annullata_tardiva', 'annullata_senza_compenso'
  )),
  locked boolean not null default false,
  duration_changed boolean not null default false,
  relocated boolean not null default false,
  violations jsonb not null default '[]',
  cancelled_at timestamptz,
  cancelled_by text,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  check (end_min > start_min)
);
create index lessons_date_idx on lessons (date);
create index lessons_tutor_idx on lessons (tutor_id, date);

create table lesson_students (
  lesson_id uuid not null references lessons (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  primary key (lesson_id, student_id)
);

-- ------------------------------------------------------------------ contabilità (contanti)

create table family_payments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  paid_on date not null default current_date,
  period_month date,
  note text not null default '',
  recorded_by uuid references staff (id),
  created_at timestamptz not null default now()
);

create table tutor_payouts (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  paid_on date not null default current_date,
  period_month date,
  note text not null default '',
  recorded_by uuid references staff (id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ chat WhatsApp

create table chats (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  display_name text not null default '',
  parent_id uuid references parents (id) on delete set null,
  student_id uuid references students (id) on delete set null,
  tutor_id uuid references tutors (id) on delete set null,
  -- 'ai': l'agente risponde; 'manuale': mai intervento dell'agente
  mode text not null default 'ai' check (mode in ('ai', 'manuale')),
  -- presa di controllo temporanea del coordinatore
  takeover_until timestamptz,
  state jsonb not null default '{}',
  last_inbound_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text not null default '',
  unread_count integer not null default 0,
  needs_attention boolean not null default false,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  author text not null check (author in ('utente', 'ai', 'coordinatore', 'telefono', 'sistema')),
  body text not null default '',
  media_type text,
  transcript text,
  provider text not null,
  provider_message_id text,
  status text not null default 'ricevuto'
    check (status in ('ricevuto', 'bozza', 'in_invio', 'inviato', 'consegnato', 'letto', 'errore')),
  error text,
  created_at timestamptz not null default now(),
  unique (provider, provider_message_id)
);
create index messages_chat_idx on messages (chat_id, created_at);

-- Azioni proposte dall'AI che richiedono il coordinatore.
create table pending_actions (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references chats (id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  summary text not null,
  reason text not null default '',
  status text not null default 'in_attesa'
    check (status in ('in_attesa', 'approvata', 'rifiutata', 'applicata', 'errore')),
  source_message_id uuid references messages (id) on delete set null,
  decided_by uuid references staff (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table ai_events (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references chats (id) on delete set null,
  message_id uuid references messages (id) on delete set null,
  model text not null,
  tier smallint not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_micro_usd bigint not null default 0,
  intent text,
  confidence real,
  output jsonb,
  created_at timestamptz not null default now()
);
create index ai_events_month_idx on ai_events (created_at);

create table audit_log (
  id bigint generated always as identity primary key,
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ sicurezza
-- Solo lo staff autenticato legge e scrive; webhook e agente usano la service role.

do $$
declare t text;
begin
  foreach t in array array[
    'staff', 'families', 'parents', 'students', 'tutors', 'subjects', 'tutor_subjects',
    'tutor_availability', 'tutor_absences', 'student_constraints', 'center_hours',
    'center_closures', 'rooms', 'settings', 'lesson_requests', 'lesson_request_students',
    'planning_runs', 'lessons', 'lesson_students', 'family_payments', 'tutor_payouts',
    'chats', 'messages', 'pending_actions', 'ai_events', 'audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy staff_all on %I for all to authenticated using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;

-- Aggiornamenti in tempo reale per la dashboard chat.
alter publication supabase_realtime add table chats, messages, pending_actions;
