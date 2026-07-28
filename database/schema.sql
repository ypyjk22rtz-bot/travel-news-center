create extension if not exists pgcrypto;

-- Travel News Center uses only tnc_* tables so it can safely share a Supabase project.

create table if not exists public.tnc_sources (
  id text primary key,
  name text not null,
  source_type text not null check (source_type in ('airline','airport','tourism_ministry','authority','publication','other')),
  method text not null check (method in ('rss','api','web')),
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

create table if not exists public.tnc_source_checks (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  status text not null check (status in ('ok','error')),
  http_status integer,
  content_hash text,
  changed boolean not null default false,
  items_found integer not null default 0,
  page_title text,
  error_message text,
  duration_ms integer,
  checked_at timestamptz not null default now()
);

create table if not exists public.tnc_news_items (
  id uuid primary key default gen_random_uuid(),
  source_id text,
  source_url text not null,
  canonical_url text,
  source_title text not null,
  source_excerpt text,
  source_language text,
  country_codes text[] not null default '{}',
  category text not null,
  status text not null default 'new' check (status in ('new','reviewing','generated','approved','wordpress_draft','published','rejected')),
  importance text not null default 'medium' check (importance in ('breaking','important','medium','low','ignore')),
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

create table if not exists public.tnc_generated_content (
  id uuid primary key default gen_random_uuid(),
  news_item_id uuid not null unique references public.tnc_news_items(id) on delete cascade,
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

create table if not exists public.tnc_social_content (
  id uuid primary key default gen_random_uuid(),
  news_item_id uuid not null unique references public.tnc_news_items(id) on delete cascade,
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

create table if not exists public.tnc_publication_jobs (
  id uuid primary key default gen_random_uuid(),
  news_item_id uuid not null references public.tnc_news_items(id) on delete cascade,
  destination text not null default 'travelistul.com',
  requested_status text not null default 'draft',
  wordpress_post_id bigint,
  wordpress_url text,
  status text not null default 'queued',
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.tnc_activity_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text,
  entity_id text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tnc_sources_active on public.tnc_sources(active);
create index if not exists idx_tnc_news_status on public.tnc_news_items(status);
create index if not exists idx_tnc_news_detected_at on public.tnc_news_items(detected_at desc);
create index if not exists idx_tnc_news_score on public.tnc_news_items(intelligence_score desc);
create index if not exists idx_tnc_checks_source on public.tnc_source_checks(source_id, checked_at desc);

alter table public.tnc_sources enable row level security;
alter table public.tnc_source_checks enable row level security;
alter table public.tnc_news_items enable row level security;
alter table public.tnc_generated_content enable row level security;
alter table public.tnc_social_content enable row level security;
alter table public.tnc_publication_jobs enable row level security;
alter table public.tnc_activity_logs enable row level security;
