-- =============================================
-- 営業メンバー個人のGmail連携（MCP経由のメール下書き・送信・参照）
-- 1人=1行。MCP接続時の「Googleアカウントで接続」で本人が同意したときに保存する。
-- refresh_token は lib/gmail-auth.ts で AES-256-GCM 暗号化した値だけを入れる（平文は保存しない）。
-- =============================================

create table if not exists gmail_tokens (
  email             text primary key,
  refresh_token_enc text not null,
  scope             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create or replace function set_updated_at_gmail_tokens() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_gmail_tokens_updated_at on gmail_tokens;
create trigger trg_gmail_tokens_updated_at
  before update on gmail_tokens
  for each row execute function set_updated_at_gmail_tokens();

-- RLS: 正規アクセスは lib/gmail-auth.ts が SUPABASE_SERVICE_ROLE_KEY で行う。
-- ブラウザからは一切触らせないため、ポリシーを定義せず全ロール拒否にする（mf_tokens と同じ方針）。
alter table gmail_tokens enable row level security;
revoke all on gmail_tokens from anon, authenticated;
