-- deals_tob に drive_folder_id カラムを追加
ALTER TABLE deals_tob ADD COLUMN IF NOT EXISTS drive_folder_id text;
