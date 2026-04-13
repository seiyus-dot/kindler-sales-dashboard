-- AI顧問 メモ・記録テーブル
CREATE TABLE IF NOT EXISTS aicoach_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES aicoach_clients(id) ON DELETE CASCADE,
  content    text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS aicoach_notes_client_id_idx ON aicoach_notes(client_id);

-- AI顧問 添付ファイルテーブル
CREATE TABLE IF NOT EXISTS aicoach_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES aicoach_clients(id) ON DELETE CASCADE,
  name         text NOT NULL,
  storage_path text NOT NULL,
  size         int  NOT NULL DEFAULT 0,
  mime_type    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ファイルアップロード用ストレージバケット（Supabase Dashboardで作成）
-- バケット名: aicoach-files
-- Public: true（ダウンロードリンクを公開URLで表示するため）
-- または RLS ポリシーで認証ユーザーのみ許可
