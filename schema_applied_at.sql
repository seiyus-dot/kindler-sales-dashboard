-- aicamp_consultations に申し込み日時カラムを追加
ALTER TABLE aicamp_consultations ADD COLUMN IF NOT EXISTS applied_at timestamptz;
