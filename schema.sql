-- =============================================
-- KINDLER 営業見込み管理アプリ スキーマ
-- =============================================

-- 担当者マスタ
create table members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

insert into members (name, sort_order) values
  ('門脇', 1),
  ('白岩', 2),
  ('佐々木', 3),
  ('宮瀬', 4),
  ('稲葉', 5),
  ('髙橋', 6);

-- toB案件
create table deals_tob (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id),
  company_name text not null,
  contact_name text,
  industry text,
  status text,
  priority text check (priority in ('高', '中', '低')),
  first_contact_date date,
  last_contact_date date,
  expected_amount int, -- 万円
  win_probability int check (win_probability between 0 and 100), -- %
  source text, -- 流入経路
  next_action text,
  next_action_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- toC案件
create table deals_toc (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id),
  name text not null,
  contact text,
  source text, -- 流入経路
  status text,
  priority text check (priority in ('高', '中', '低')),
  first_contact_date date,
  last_contact_date date,
  service text, -- 検討サービス
  expected_amount int, -- 万円
  win_probability int check (win_probability between 0 and 100),
  next_action text,
  next_action_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 週次ログ
create table weekly_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  tob_count int default 0,
  toc_count int default 0,
  tob_amount int default 0,  -- 万円
  toc_amount int default 0,  -- 万円
  weighted_total int default 0, -- 万円
  cumulative_orders int default 0,
  memo text,
  created_at timestamptz default now()
);

-- 既存ログデータ投入
insert into weekly_logs (log_date, tob_count, toc_count, tob_amount, toc_amount, weighted_total, cumulative_orders, memo) values
  ('2026-03-05', 8,  12, 1200, 180, 520, 1, '今月から本格稼働。まずは既存リードの棚卸し'),
  ('2026-03-12', 10, 14, 1500, 210, 630, 1, 'toB2件新規追加（セミナー経由）。toC相談予約が増加傾向'),
  ('2026-03-19', 11, 13, 1700, 195, 710, 2, '○○建設 受注確定。toC1件離脱（日程合わず）'),
  ('2026-03-26', 12, 15, 1900, 225, 780, 2, 'ABCホールディングス見積提出済。来週クロージング予定'),
  ('2026-04-02', 13, 16, 2100, 240, 850, 3, 'ABC受注。toB金額が順調に積み上がっている。toC no-show対策を議論');

-- updated_at自動更新トリガー
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger deals_tob_updated_at before update on deals_tob
  for each row execute function update_updated_at();

create trigger deals_toc_updated_at before update on deals_toc
  for each row execute function update_updated_at();
