-- 001_init.sql

create table if not exists ingest_jobs (
  id bigserial primary key,
  requested_by text,
  season int not null,
  round int not null,
  session_code text, -- deprecated, use session_codes
  session_codes text,
  status text not null default 'QUEUED',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  log_url text,
  error text
);

create index if not exists idx_ingest_jobs_status on ingest_jobs(status);
create index if not exists idx_ingest_jobs_params on ingest_jobs(season, round, session_code);

create table if not exists weekends (
  id bigserial primary key,
  season int not null,
  round int not null,
  name text,
  circuit text,
  date date,
  unique (season, round)
);

create table if not exists sessions (
  id bigserial primary key,
  weekend_id bigint references weekends(id) on delete cascade,
  session_code text not null,
  start_time_utc timestamptz,
  unique (weekend_id, session_code)
);

create table if not exists drivers (
  id bigserial primary key,
  code text unique,
  name text
);

create table if not exists session_results (
  id bigserial primary key,
  session_id bigint references sessions(id) on delete cascade,
  driver_id bigint references drivers(id) on delete cascade,
  position int,
  best_lap_time_ms int,
  status text,
  points numeric,
  grid int,
  unique (session_id, driver_id)
);

create table if not exists laps (
  id bigserial primary key,
  session_id bigint references sessions(id) on delete cascade,
  driver_id bigint references drivers(id) on delete cascade,
  lap_number int,
  lap_time_ms int,
  compound text,
  stint int,
  is_personal_best boolean,
  unique (session_id, driver_id, lap_number)
);

create table if not exists telemetry_keylaps (
  id bigserial primary key,
  session_id bigint references sessions(id) on delete cascade,
  driver_id bigint references drivers(id) on delete cascade,
  lap_number int not null,
  n_points int not null,
  distance_m jsonb not null,
  speed_kph jsonb,
  throttle jsonb,
  brake jsonb,
  gear jsonb,
  drs jsonb,
  pos_x jsonb,
  pos_y jsonb,
  unique (session_id, driver_id, lap_number)
);

create table if not exists pit_stops (
  id bigserial primary key,
  session_id bigint references sessions(id) on delete cascade,
  driver_id bigint references drivers(id) on delete cascade,
  lap_number int not null,
  duration_ms int,
  pit_in_time timestamptz,
  pit_out_time timestamptz,
  unique (session_id, driver_id, lap_number)
);

create table if not exists stints (
  id bigserial primary key,
  session_id bigint references sessions(id) on delete cascade,
  driver_id bigint references drivers(id) on delete cascade,
  stint_number int not null,
  compound text not null,
  start_lap int not null,
  end_lap int,
  tire_age_at_start int default 0,
  unique (session_id, driver_id, stint_number)
);

create table if not exists lap_positions (
  id bigserial primary key,
  session_id bigint references sessions(id) on delete cascade,
  lap_number int not null,
  driver_id bigint references drivers(id) on delete cascade,
  position int not null,
  gap_to_leader_ms int,
  interval_ms int,
  unique (session_id, lap_number, driver_id)
);
