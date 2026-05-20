-- =============================================
-- Phase 1: クライアントマスタ + 契約テーブル拡張
-- マネーフォワード / クラウドサイン連携の前準備
-- Supabase SQL Editor で実行してください
-- =============================================

-- ---------------------------------------------
-- clients: クライアント（取引先）マスタ
-- ---------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),

  -- 法人情報
  company_name      text not null,    -- 正式法人名（前株・後株に注意）
  company_name_kana text,             -- 法人名カナ
  rep_name          text,             -- 代表者氏名
  rep_title         text,             -- 代表者役職（例：代表取締役）

  -- 担当者
  contact_name  text,
  contact_title text,
  contact_email text,
  contact_phone text,

  -- 住所
  postal_code text,
  address     text,

  -- 外部連携ID（Phase 2 以降で使用）
  mf_partner_id        text,          -- マネーフォワード 取引先ID
  cloudsign_send_email text,          -- クラウドサイン送付先メール（担当者と別の場合）

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clients_company_name on clients(company_name);
create unique index if not exists idx_clients_mf_partner_id
  on clients(mf_partner_id) where mf_partner_id is not null;

-- ---------------------------------------------
-- contracts への外部連携カラム追加
-- ---------------------------------------------
alter table contracts add column if not exists client_id            uuid references clients(id) on delete set null;
alter table contracts add column if not exists mf_quote_id          text;       -- MF見積書ID
alter table contracts add column if not exists mf_quote_pdf_url     text;       -- MF見積書PDFのURL
alter table contracts add column if not exists mf_invoice_id        text;       -- MF請求書ID
alter table contracts add column if not exists mf_invoice_pdf_url   text;       -- MF請求書PDFのURL
alter table contracts add column if not exists cloudsign_doc_id     text;       -- クラウドサイン書類ID
alter table contracts add column if not exists cloudsign_sent_at    timestamptz; -- クラウドサイン送付日時

create index if not exists idx_contracts_client_id on contracts(client_id);

-- ---------------------------------------------
-- updated_at 自動更新トリガ
-- ---------------------------------------------
create or replace function set_updated_at_clients() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_clients_updated_at on clients;
create trigger trg_clients_updated_at
  before update on clients
  for each row execute function set_updated_at_clients();

-- ---------------------------------------------
-- RLS（既存と同じ「認証ユーザーのみ」ポリシー）
-- ---------------------------------------------
alter table clients enable row level security;
create policy "authenticated users only" on clients
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
