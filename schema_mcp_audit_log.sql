-- =============================================
-- MCPツールの実行ログ（誰が・いつ・どのツールで・何をしたか）
-- 読み取りも含めて全ツールの呼び出しを1行ずつ残す（lib/mcp-audit.ts が記録）。
-- 閲覧できるのは管理者だけ（/mcp-logs）。書き込みは Service Role のサーバー側からのみ。
-- Supabase SQL Editor で実行（再実行安全）。schema_rls_hardening.sql の後に実行すること。
-- =============================================

create table if not exists mcp_audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor         text not null,          -- Googleで接続した人はメールアドレス、共有キーはそのラベル
  client        text,                   -- 呼び出し元AIのUser-Agent（Claude / ChatGPT などの判別用）
  user_request  text,                   -- 利用者の依頼内容（AIが申告したもの。原文と一致する保証はない）
  tool_name     text not null,
  args          jsonb,                  -- 引数の要約（メール本文などは文字数だけ残す）
  result_summary text,                  -- 結果の先頭部分（メール本文・スニペットは伏せる）
  success       boolean not null,
  error_message text,
  duration_ms   integer,
  created_at    timestamptz not null default now()
);

-- 先に旧版を作っていた場合の追加分
alter table mcp_audit_log add column if not exists client text;
alter table mcp_audit_log add column if not exists user_request text;
alter table mcp_audit_log add column if not exists result_summary text;

create index if not exists mcp_audit_log_created_at_idx on mcp_audit_log (created_at desc);
create index if not exists mcp_audit_log_actor_idx on mcp_audit_log (actor, created_at desc);

alter table mcp_audit_log enable row level security;

-- ログは改ざんさせない: ブラウザ側（anon / authenticated）からは閲覧だけ許し、それも管理者に限る
revoke all on mcp_audit_log from anon, authenticated;
grant select on mcp_audit_log to authenticated;

drop policy if exists "authenticated users only" on mcp_audit_log;
drop policy if exists "admin read" on mcp_audit_log;
create policy "admin read" on mcp_audit_log
  for select to authenticated using (public.is_admin_user());
