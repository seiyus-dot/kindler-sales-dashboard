-- =============================================
-- fb_ads を代理店ごとに持てるようにする（広告2もAdveronix→シート→自動取り込み）
-- schema_ad_agencies.sql の後に Supabase SQL Editor で実行（再実行安全）
-- =============================================

-- 既存の行はすべて広告1（Adveronix → 広告1のシート → GAS）
alter table fb_ads add column if not exists agency_slug text not null default 'agency1' references ad_agencies(slug);
create index if not exists fb_ads_agency_day_idx on fb_ads (agency_slug, day);

-- 広告2も fb_ads（自動取り込み）を使う
update ad_agencies set uses_fb_ads = true where slug = 'agency2';

-- 代理店のシートから取り込むときの合言葉。その代理店の fb_ads しか書き込めない（/api/webhooks/fb-ads）。
-- 広告1・広告2とも委託先のシートなので、強い鍵（Service Role）を置かず、全代理店この合言葉で取り込む
alter table ad_agencies add column if not exists ingest_token text unique;
update ad_agencies set ingest_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
where ingest_token is null;
