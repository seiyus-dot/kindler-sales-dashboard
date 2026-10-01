-- UTAGE イベント申込 Webhook（/api/webhooks/utage-application）用
-- 申込番号（%event_applicant_id%）で二重登録を防ぐ

alter table aicamp_consultations add column if not exists utage_applicant_id text;
alter table aicamp_consultations add column if not exists utage_event_name   text;
alter table aicamp_consultations add column if not exists line_friend_id     text;

create unique index if not exists aicamp_consultations_utage_applicant_id_key
  on aicamp_consultations (utage_applicant_id)
  where utage_applicant_id is not null;

comment on column aicamp_consultations.utage_applicant_id is 'UTAGEのイベント申込番号。Webhook取込時の重複防止キー';
comment on column aicamp_consultations.utage_event_name   is 'UTAGEのイベント名（例: AI CAMP®︎個別相談会）';
comment on column aicamp_consultations.line_friend_id     is 'UTAGEのLINE友だちID（%line_id%）。line_friends.line_user_id と照合して LINE追加確認 を自動化する';
