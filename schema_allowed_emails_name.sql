-- allowed_emails に name カラムを追加
alter table allowed_emails add column if not exists name text;
