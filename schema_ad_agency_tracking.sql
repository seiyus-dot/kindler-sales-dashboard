-- =============================================
-- 代理店ごとの UTAGE 登録経路（LINE友だち追加の経路名）
-- 広告セット名が fb_ads に無い代理店（辛嶋さんチーム）は、専用シナリオの登録経路で面談申込を振り分ける。
--   辛嶋さんチーム: シナリオ「AI CAMPステップ配信（広告）_コピー20260624152354」の登録経路 lp3-a
-- 経路を増やすときは配列に足す（大文字小文字は区別しない）。
-- schema_ad_agencies.sql の後に Supabase SQL Editor で実行（再実行安全）
-- =============================================

alter table ad_agencies add column if not exists tracking_names text[] not null default '{}';
update ad_agencies set tracking_names = array['lp3-a'] where slug = 'agency2';
