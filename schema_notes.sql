-- =============================================
-- 新規作成の場合はこちらを実行
-- =============================================

CREATE TABLE IF NOT EXISTS aicoach_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES aicoach_clients(id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT '',
  content    text NOT NULL DEFAULT '',
  note_date  date,
  sort_order int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aicoach_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES aicoach_clients(id) ON DELETE CASCADE,
  name         text NOT NULL,
  storage_path text NOT NULL,
  size         int  NOT NULL DEFAULT 0,
  mime_type    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- すでにテーブルを作成済みの場合はこちらを実行
-- =============================================

-- DROP INDEX IF EXISTS aicoach_notes_client_id_idx;
-- ALTER TABLE aicoach_notes ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
-- ALTER TABLE aicoach_notes ADD COLUMN IF NOT EXISTS note_date date;
-- ALTER TABLE aicoach_notes ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;
-- ALTER TABLE aicoach_notes ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- =============================================
-- ストレージバケット（Supabase Dashboard > Storage）
-- バケット名: aicoach-files  Public: true
-- =============================================
