-- 発注リクエストテーブル
-- Supabase SQL Editor で実行してください

create table order_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  -- 企業情報
  company_name       text not null,
  rep_name_kanji     text not null,
  rep_name_kana      text not null,
  company_phone      text not null,

  -- 担当者情報
  contact_name_kanji text not null,
  contact_name_kana  text not null,
  department         text,
  position           text,
  contact_email      text not null,
  contact_phone      text,

  -- 請求書送付先
  billing_zip          text not null,
  billing_address      text not null,
  billing_name_kanji   text not null,
  billing_name_kana    text not null,
  billing_position     text,
  billing_department   text,
  billing_email        text,

  -- 発注内容
  services     text[] not null default '{}',
  order_detail text,

  -- 管理
  status text not null default '未対応'
);
