-- AI CAMP 日次ログ
create table if not exists aicamp_daily_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  application_count int default 0,
  cancel_count int default 0,
  contract_count int default 0,
  hold_count int default 0,
  loss_count int default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- すでにテーブルが存在する場合はこちらを実行
-- ALTER TABLE utage_deliveries ADD COLUMN IF NOT EXISTS content text;

-- Utage 配信メトリクス
create table if not exists utage_deliveries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  sent_at timestamptz not null,
  sent_count int default 0,
  open_count int default 0,
  click_count int default 0,
  application_count int,
  block_count int,
  content text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
