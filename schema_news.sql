-- news テーブル
create table if not exists news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'お知らせ',
  is_faq boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table news enable row level security;

-- 認証済みユーザーは全操作可能
create policy "authenticated users only" on news
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- feedback テーブル
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'その他',
  body text not null,
  member_name text,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

-- 認証済みユーザーは全操作可能
create policy "authenticated users only" on feedback
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
