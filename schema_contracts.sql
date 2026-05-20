-- =============================================
-- Contract Automation Gateway
-- 営業 → CS の契約申請フロー
-- Supabase SQL Editor で実行してください
-- =============================================

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  member_id uuid references members(id) on delete set null,
  contract_type text not null check (contract_type in ('training', 'advisor')),
  advisor_months int,
  start_date date not null,
  total_tax_excl bigint not null,
  tax_amount     bigint not null,
  total_tax_inc  bigint not null,
  status text not null default '新規受付（未対応）'
    check (status in ('新規受付（未対応）', '契約書作成中', '送付済', '締結完了')),
  submitted_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create table if not exists contract_items (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  sort_order int not null default 0,
  name text not null,
  quantity int not null,
  unit_price bigint not null,
  subtotal_tax_excl bigint not null
);

create index if not exists idx_contracts_status        on contracts(status);
create index if not exists idx_contracts_submitted_at  on contracts(submitted_at desc);
create index if not exists idx_contract_items_contract on contract_items(contract_id);

-- =============================================
-- RLS（schema_rls.sql と同じ「認証ユーザーのみ」ポリシー）
-- =============================================

alter table contracts enable row level security;
create policy "authenticated users only" on contracts
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter table contract_items enable row level security;
create policy "authenticated users only" on contract_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
