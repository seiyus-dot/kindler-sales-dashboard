-- =============================================
-- 広告代理店ごとのレポート（/agency-report）と、代理店アカウントの締め出し
-- Supabase SQL Editor で実行してください（再実行安全）
-- 2026-10-02 聖悠さん承認済み（代理店アカウントはDB・APIの段階で社内データから締め出す）
-- =============================================

-- ---- 代理店マスタ ----
-- source_values: この代理店の成果とみなす aicamp_consultations.source の値
-- uses_fb_ads:   広告費・リスト数を fb_ads（Adveronix連携）から取るか。false なら ad_agency_spend の手入力
create table if not exists ad_agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  source_values text[] not null default '{}',
  uses_fb_ads boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

insert into ad_agencies (name, slug, source_values, uses_fb_ads, sort_order) values
  ('広告1（Meta広告）', 'agency1', array['Meta広告', 'meta広告'], true, 1),
  ('広告2', 'agency2', array['広告2'], false, 2)
on conflict (slug) do nothing;

-- ---- 手入力の週次広告費（fb_ads を使わない代理店用）----
create table if not exists ad_agency_spend (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references ad_agencies(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  spend integer not null default 0,        -- 円
  list_count integer,                      -- 件（LINE登録など）
  notes text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, week_start)
);

-- ---- ログインユーザーと代理店の紐づけ ----
alter table allowed_emails add column if not exists agency_id uuid references ad_agencies(id) on delete set null;

-- ---- 判定関数（security definer：RLSの影響を受けずに自分の権限だけを返す）----
create or replace function public.is_agency_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from allowed_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and agency_id is not null
  );
$$;

create or replace function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'role', role,
    'allowed_pages', to_jsonb(allowed_pages),
    'agency_id', agency_id
  )
  from allowed_emails
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

grant execute on function public.is_agency_user() to authenticated;
grant execute on function public.my_access() to authenticated;

-- ---- 新テーブルのRLS（社内メンバーのみ。代理店はAPI経由で集計だけ受け取る）----
alter table ad_agencies enable row level security;
drop policy if exists "internal users only" on ad_agencies;
create policy "internal users only" on ad_agencies
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter table ad_agency_spend enable row level security;
drop policy if exists "internal users only" on ad_agency_spend;
create policy "internal users only" on ad_agency_spend
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---- 代理店アカウントの締め出し ----
-- RLSが有効な public の全テーブルに「代理店アカウントは不可」の RESTRICTIVE ポリシーを追加する。
-- 既存ポリシーと AND で効くので、社内メンバー（agency_id が空）の動きは一切変わらない。
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists "no agency users" on public.%I', t.relname);
    execute format(
      'create policy "no agency users" on public.%I as restrictive for all using (not public.is_agency_user()) with check (not public.is_agency_user())',
      t.relname
    );
  end loop;
end $$;

-- ---- 棟近さん（広告2）の権限付け替え ----
update allowed_emails
set allowed_pages = array['/agency-report'],
    agency_id = (select id from ad_agencies where slug = 'agency2')
where lower(email) = 'munechi0819@gmail.com';
