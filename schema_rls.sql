-- =============================================
-- RLS 有効化 + ポリシー設定
-- Supabase SQL Editor で実行してください
-- =============================================

-- =============================================
-- 内部管理テーブル（認証ユーザーのみ）
-- =============================================

-- members
alter table members enable row level security;
create policy "authenticated users only" on members
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- deals_tob
alter table deals_tob enable row level security;
create policy "authenticated users only" on deals_tob
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- deals_toc
alter table deals_toc enable row level security;
create policy "authenticated users only" on deals_toc
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- weekly_logs
alter table weekly_logs enable row level security;
create policy "authenticated users only" on weekly_logs
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- deal_actions
alter table deal_actions enable row level security;
create policy "authenticated users only" on deal_actions
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- aicamp_consultations
alter table aicamp_consultations enable row level security;
create policy "authenticated users only" on aicamp_consultations
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- aicamp_monthly_goals
alter table aicamp_monthly_goals enable row level security;
create policy "authenticated users only" on aicamp_monthly_goals
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- aicamp_ad_weekly
alter table aicamp_ad_weekly enable row level security;
create policy "authenticated users only" on aicamp_ad_weekly
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- source_master
alter table source_master enable row level security;
create policy "authenticated users only" on source_master
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- aicoach_clients（既存の using(true) ポリシーを置き換え）
drop policy if exists "allow all aicoach_clients" on aicoach_clients;
alter table aicoach_clients enable row level security;
create policy "authenticated users only" on aicoach_clients
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- aicoach_items（既存の using(true) ポリシーを置き換え）
drop policy if exists "allow all aicoach_items" on aicoach_items;
alter table aicoach_items enable row level security;
create policy "authenticated users only" on aicoach_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- aicoach_notes
alter table aicoach_notes enable row level security;
create policy "authenticated users only" on aicoach_notes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- aicoach_files
alter table aicoach_files enable row level security;
create policy "authenticated users only" on aicoach_files
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- order_requests（API Route / service_role 経由のため実質影響なし）
alter table order_requests enable row level security;
create policy "authenticated users only" on order_requests
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- allowed_emails
alter table allowed_emails enable row level security;
create policy "authenticated users only" on allowed_emails
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- master_options
alter table master_options enable row level security;
create policy "authenticated users only" on master_options
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- column_config
alter table column_config enable row level security;
create policy "authenticated users only" on column_config
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- member_monthly_goals
alter table member_monthly_goals enable row level security;
create policy "authenticated users only" on member_monthly_goals
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- =============================================
-- 公開テーブル（特殊ポリシー）
-- =============================================

-- product_aicamp_sessions
-- anon ユーザーは SELECT のみ可（申込フォームでセッション一覧表示に必要）
-- INSERT/UPDATE/DELETE は認証ユーザーのみ
alter table product_aicamp_sessions enable row level security;
create policy "public select" on product_aicamp_sessions
  for select using (true);
create policy "authenticated write" on product_aicamp_sessions
  for insert with check (auth.uid() is not null);
create policy "authenticated update" on product_aicamp_sessions
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated delete" on product_aicamp_sessions
  for delete using (auth.uid() is not null);

-- product_aicamp_customers
-- INSERT は API Route (service_role) 経由のみ → anon からの直接 INSERT は不可
-- SELECT/UPDATE/DELETE は認証ユーザーのみ
alter table product_aicamp_customers enable row level security;
create policy "authenticated users only" on product_aicamp_customers
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
