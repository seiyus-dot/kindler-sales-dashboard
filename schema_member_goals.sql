-- メンバー別月次目標管理
create table if not exists member_monthly_goals (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) not null,
  month text not null, -- YYYY-MM
  target_amount int default 0, -- 万円
  created_at timestamptz default now(),
  unique(member_id, month)
);

-- 初期データの投入（2026年4月分）
-- メンバーIDを取得するためにサブクエリを使用
insert into member_monthly_goals (member_id, month, target_amount)
select id, '2026-04', 100 from members where name = '門脇'
on conflict (member_id, month) do update set target_amount = 100;

insert into member_monthly_goals (member_id, month, target_amount)
select id, '2026-04', 80 from members where name = '白岩'
on conflict (member_id, month) do update set target_amount = 80;

insert into member_monthly_goals (member_id, month, target_amount)
select id, '2026-04', 50 from members where name = '佐々木'
on conflict (member_id, month) do update set target_amount = 50;

insert into member_monthly_goals (member_id, month, target_amount)
select id, '2026-04', 50 from members where name = '宮瀬'
on conflict (member_id, month) do update set target_amount = 50;

insert into member_monthly_goals (member_id, month, target_amount)
select id, '2026-04', 30 from members where name = '稲葉'
on conflict (member_id, month) do update set target_amount = 30;

insert into member_monthly_goals (member_id, month, target_amount)
select id, '2026-04', 30 from members where name = '髙橋'
on conflict (member_id, month) do update set target_amount = 30;
