-- =============================================
-- 顧客マスタ設計: 1顧客 × 複数プロダクト対応
-- Supabase SQL Editor でそのまま実行してください
-- =============================================

-- 個人顧客マスタ（B2C）
create table if not exists contacts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  email      text,
  notes      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 法人顧客マスタ（B2B）
create table if not exists companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  industry   text,
  notes      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 既存テーブルへの FK 追加（すべて nullable = 既存データはそのまま動作）
alter table deals_toc
  add column if not exists contact_id uuid references contacts(id) on delete set null;

alter table aicamp_consultations
  add column if not exists contact_id uuid references contacts(id) on delete set null;

alter table product_aicamp_customers
  add column if not exists contact_id uuid references contacts(id) on delete set null;

alter table deals_tob
  add column if not exists company_id uuid references companies(id) on delete set null;

-- RLS を無効化（他テーブルと同様の設定）
alter table contacts disable row level security;
alter table companies disable row level security;
