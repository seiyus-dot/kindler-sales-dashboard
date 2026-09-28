-- MoneyForward連携MCPツールの書き込み系操作（作成・更新・削除など）の実行履歴。
-- 「誰が(actor)・いつ・どのツールで・何に対して・成功したか」を残す。
-- actorは接続トークンのラベル（MCP_AUTH_TOKENSの "label:secret" 形式）から取る。
create table if not exists mf_write_audit_log (
  id uuid primary key default gen_random_uuid(),
  tool_name text not null,
  action text not null,
  actor text not null,
  target_type text,
  target_id text,
  success boolean not null,
  error_message text,
  summary jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mf_write_audit_log_created_at_idx on mf_write_audit_log (created_at desc);
create index if not exists mf_write_audit_log_target_idx on mf_write_audit_log (target_type, target_id);

alter table mf_write_audit_log enable row level security;

create policy "mf_write_audit_log_select_authenticated" on mf_write_audit_log
  for select using (auth.uid() is not null);
