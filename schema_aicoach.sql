-- AI顧問クライアント管理
create table if not exists aicoach_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default '6ヶ月',
  start_date date not null,
  phase text not null default 'ヒアリング',
  goals text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists aicoach_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references aicoach_clients(id) on delete cascade,
  label text not null,
  start_date date not null,
  end_date date not null,
  color_idx int default 0,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- RLS
alter table aicoach_clients enable row level security;
alter table aicoach_items enable row level security;

create policy "allow all aicoach_clients" on aicoach_clients for all using (true) with check (true);
create policy "allow all aicoach_items" on aicoach_items for all using (true) with check (true);
