-- LINE友達一覧テーブル
create table if not exists line_friends (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique not null,
  line_display_name text,
  status text,
  registration_source text,
  blocked_at timestamptz,
  registered_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- updated_at 自動更新
create or replace function update_line_friends_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger line_friends_updated_at
  before update on line_friends
  for each row execute function update_line_friends_updated_at();
