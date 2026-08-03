-- AI CAMP 商談（aicamp_consultations）に「LINE追加確認」フラグを追加
--   参加予定として登録された人が公式LINEを追加済みかを担当者がその場で確認・記録するための列。
--   false（未確認）が既定。案件一覧テーブルでは未確認セルを赤くハイライトし、
--   開催前の追加催促の対象を一括で洗い出せるようにする。
-- Supabase SQL Editor で実行してください（再実行安全・冪等）。

alter table aicamp_consultations
  add column if not exists line_added boolean not null default false;

comment on column aicamp_consultations.line_added is 'LINE追加確認。true=確認済み / false=未確認（既定）。参加者への案内が届くかの担当者チェック用';
