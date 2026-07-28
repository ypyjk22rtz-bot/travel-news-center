create table if not exists flight_deals (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  deal_type text not null check (deal_type in ('fare','promotion')),
  origin_code text,
  origin_name text,
  destination_code text,
  destination_name text,
  airline_code text,
  airline_name text,
  cabin_class text default 'economy',
  trip_type text default 'roundtrip',
  departure_date date,
  return_date date,
  price numeric(12,2),
  currency text default 'EUR',
  original_price numeric(12,2),
  discount_percent integer,
  promo_code text,
  booking_url text not null,
  source_url text,
  title text not null,
  description text,
  terms text,
  region text,
  relevance_romania integer default 0 check (relevance_romania between 0 and 100),
  deal_score integer default 0 check (deal_score between 0 and 100),
  verified boolean default false,
  featured boolean default false,
  status text default 'new' check (status in ('new','review','approved','expired','rejected')),
  valid_from timestamptz,
  valid_until timestamptz,
  detected_at timestamptz default now(),
  last_checked_at timestamptz default now(),
  price_hash text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists flight_deals_status_idx on flight_deals(status);
create index if not exists flight_deals_score_idx on flight_deals(deal_score desc);
create index if not exists flight_deals_route_idx on flight_deals(origin_code, destination_code);
create index if not exists flight_deals_valid_until_idx on flight_deals(valid_until);
create unique index if not exists flight_deals_price_hash_uidx on flight_deals(price_hash) where price_hash is not null;

create table if not exists deal_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider_type text not null check (provider_type in ('api','airline','affiliate','rss','web')),
  url text,
  api_base_url text,
  active boolean default true,
  priority integer default 50,
  scan_frequency_minutes integer default 60,
  supports_fares boolean default false,
  supports_promotions boolean default true,
  countries text[] default '{}',
  airlines text[] default '{}',
  last_scan_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists deal_price_history (
  id bigint generated always as identity primary key,
  deal_id uuid references flight_deals(id) on delete cascade,
  price numeric(12,2) not null,
  currency text not null,
  checked_at timestamptz default now()
);

create index if not exists deal_price_history_deal_idx on deal_price_history(deal_id, checked_at desc);

alter table flight_deals enable row level security;
alter table deal_sources enable row level security;
alter table deal_price_history enable row level security;
