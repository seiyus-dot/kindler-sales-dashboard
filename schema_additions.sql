-- =============================================
-- KINDLER schema additions
-- Supabase の SQL Editor で実行してください
-- =============================================

-- アクション履歴テーブル
create table if not exists deal_actions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null,
  deal_type text not null check (deal_type in ('tob', 'toc')),
  member_id uuid references members(id),
  action_type text not null,
  action_date date not null default current_date,
  notes text,
  created_at timestamptz default now()
);

-- 失注理由カラムを deals_tob に追加
alter table deals_tob add column if not exists loss_reason text;
alter table deals_tob add column if not exists loss_detail text;

-- 失注理由カラムを deals_toc に追加
alter table deals_toc add column if not exists loss_reason text;
alter table deals_toc add column if not exists loss_detail text;

-- deals_tob に service / payment_date / actual_amount が未追加の場合
alter table deals_tob add column if not exists service text;
alter table deals_tob add column if not exists payment_date date;
alter table deals_tob add column if not exists actual_amount int;

-- deals_toc に payment_date / actual_amount が未追加の場合
alter table deals_toc add column if not exists payment_date date;
alter table deals_toc add column if not exists actual_amount int;

-- サブ担当者カラム追加
alter table deals_tob add column if not exists sub_member_id uuid references members(id);
alter table deals_toc add column if not exists sub_member_id uuid references members(id);

-- サブスク関連カラム
alter table deals_toc add column if not exists deal_type text default 'spot';
alter table deals_tob add column if not exists deal_type text default 'spot';
alter table deals_toc add column if not exists monthly_amount int;
alter table deals_tob add column if not exists monthly_amount int;
alter table deals_toc add column if not exists contract_start date;
alter table deals_tob add column if not exists contract_start date;
alter table deals_toc add column if not exists contract_end date;
alter table deals_tob add column if not exists contract_end date;
alter table deals_toc add column if not exists payment_status text default '正常';
alter table deals_tob add column if not exists payment_status text default '正常';
alter table deals_toc add column if not exists payment_error_date date;
alter table deals_tob add column if not exists payment_error_date date;
alter table deals_toc add column if not exists stripe_subscription_id text unique;
alter table deals_tob add column if not exists stripe_subscription_id text unique;
alter table deals_toc add column if not exists stripe_customer_id text;
alter table deals_tob add column if not exists stripe_customer_id text;

-- 契約締結日（売上集計の軸）
alter table deals_tob add column if not exists contract_date date;

-- member_id を nullable に（Stripe インポート時に担当者未割り当てを許容）
alter table deals_toc alter column member_id drop not null;
alter table deals_tob alter column member_id drop not null;

-- =============================================
-- AI CAMP 専用テーブル
-- =============================================

-- ロードマップ作成会（商談）管理
create table if not exists aicamp_consultations (
  id uuid primary key default gen_random_uuid(),
  line_name text,
  name text,
  age int,
  consultation_date timestamptz,
  member_id uuid references members(id),
  source text,
  registration_source text,
  status text default '予定', -- 予定/成約/失注/保留/ドタキャン/キャンセル
  payment_amount int,
  payment_method text,
  customer_attribute text,
  motivation text,
  reason text,
  reply_deadline date,
  minutes_url text,
  occupation text,
  monthly_income text,
  ai_experience text,
  ai_purpose text,
  expectation text,
  question text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 月次目標管理
create table if not exists aicamp_monthly_goals (
  id uuid primary key default gen_random_uuid(),
  month text not null unique, -- YYYY-MM
  contract_goal int default 50,
  created_at timestamptz default now()
);

-- column_config に商品名・サブ担当者・加重金額を追加
-- ※ column_config テーブルが存在する前提で実行してください
insert into column_config (table_type, column_key, label, visible, sort_order)
select * from (values
  ('tob', 'service',         '商品名',       true,  25),
  ('tob', 'sub_member',      'サブ担当',     true,  26),
  ('tob', 'weighted_amount', '加重金額',     true,  27),
  ('toc', 'service',         '検討サービス', true,  25),
  ('toc', 'sub_member',      'サブ担当',     true,  26),
  ('toc', 'weighted_amount', '加重金額',     true,  27)
) as v(table_type, column_key, label, visible, sort_order)
where not exists (
  select 1 from column_config c where c.table_type = v.table_type and c.column_key = v.column_key
);
