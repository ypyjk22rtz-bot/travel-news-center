create extension if not exists pgcrypto;

create type source_type as enum ('airline','airport','tourism_ministry','authority','publication','other');
create type source_method as enum ('rss','api','web');
create type news_status as enum ('new','reviewing','generated','approved','wordpress_draft','published','rejected');
create type importance_level as enum ('breaking','important','medium','low','ignore');

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type source_type not null,
  method source_method not null,
  country_code text,
  website_url text not null,
  feed_url text,
  active boolean not null default true,
  official boolean not null default true,
  scan_frequency_minutes integer not null default 60,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  consecutive_errors integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists source_checks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  status_code integer,
  changed boolean not null default false,
  items_found integer not null default 0,
  error_message text,
  duration_ms integer,
  checked_at timestamptz not null default now()
);

create table if not exists news_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete set null,
  source_url text not null,
  canonical_url text,
  source_title text not null,
  source_excerpt text,
  source_language text,
  country_codes text[] not null default '{}',
  category text not null,
  status news_status not null default 'new',
  importance importance_level not null default 'medium',
  intelligence_score integer not null default 50 check (intelligence_score between 0 and 100),
  discover_score integer not null default 50 check (discover_score between 0 and 100),
  factual_confidence integer not null default 50 check (factual_confidence between 0 and 100),
  content_hash text unique,
  duplicate_group_id uuid,
  detected_at timestamptz not null default now(),
  source_published_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists generated_content (
  id uuid primary key default gen_random_uuid(),
  news_item_id uuid not null unique references news_items(id) on delete cascade,
  seo_title text,
  subtitle text,
  article_html text,
  meta_description text,
  slug text,
  excerpt text,
  keywords text[] not null default '{}',
  tags text[] not null default '{}',
  faq jsonb not null default '[]'::jsonb,
  cta_html text,
  model text,
  prompt_version text,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_content (
  id uuid primary key default gen_random_uuid(),
  news_item_id uuid not null unique references news_items(id) on delete cascade,
  facebook text,
  x_text text,
  instagram text,
  threads text,
  linkedin text,
  telegram text,
  newsletter text,
  push_notification text,
  updated_at timestamptz not null default now()
);

create table if not exists publication_jobs (
  id uuid primary key default gen_random_uuid(),
  news_item_id uuid not null references news_items(id) on delete cascade,
  destination text not null default 'travelistul.com',
  requested_status text not null default 'draft',
  wordpress_post_id bigint,
  wordpress_url text,
  status text not null default 'queued',
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text,
  entity_id uuid,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sources_active on sources(active);
create index if not exists idx_news_status on news_items(status);
create index if not exists idx_news_detected_at on news_items(detected_at desc);
create index if not exists idx_news_score on news_items(intelligence_score desc);
create index if not exists idx_checks_source on source_checks(source_id, checked_at desc);

-- Security policy principle: service-role backend writes; authenticated admin reads/writes.
alter table sources enable row level security;
alter table source_checks enable row level security;
alter table news_items enable row level security;
alter table generated_content enable row level security;
alter table social_content enable row level security;
alter table publication_jobs enable row level security;
alter table activity_logs enable row level security;
