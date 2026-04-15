-- Product AI CAMP 管理テーブル
-- Supabase SQL Editor で実行してください

-- 開催セッションテーブル
create table product_aicamp_sessions (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,         -- 例: "第3期"
  session_date date not null,         -- 開始日
  end_date     date not null,         -- 終了日（通常 session_date + 1日）
  max_capacity int,                   -- 定員
  notes        text,
  created_at   timestamptz default now()
);

-- 受講生（顧客）テーブル
create table product_aicamp_customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,           -- 顧客名
  phone      text not null,           -- 電話番号
  email      text not null,           -- メールアドレス
  session_id uuid references product_aicamp_sessions(id) on delete set null,
  status     text not null default '申込済',  -- 申込済 / キャンセル / 修了
  notes      text,
  created_at timestamptz default now()
);
