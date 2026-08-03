-- aicamp_consultations を「着金ベース / 売上計上ベース」の2軸対応にする
--   着金ベース  : payment_amount(円) + payment_date     … 既存（実際に入金された額・入金日）
--   売上計上ベース: contract_amount(円) + contract_date  … 新規（成約時に契約満額を計上）
-- 単位はすべて「円」（deals_tob は万円なので合算時は ÷10000 で換算する）。

-- 売上計上軸（新規）
alter table aicamp_consultations add column if not exists contract_amount integer; -- 売上計上額（円, 成約満額）
alter table aicamp_consultations add column if not exists contract_date   date;    -- 成約日（売上計上ベースの集計キー）

-- 既存だが schema_*.sql に記録が無く Supabase で手動追加されていたカラムを冪等に正式化
alter table aicamp_consultations add column if not exists payment_date date;       -- 着金日
alter table aicamp_consultations add column if not exists service_type text;       -- AI CAMP / プロダクト AI CAMP

comment on column aicamp_consultations.contract_amount is '売上計上額（円）。成約時に契約満額を計上';
comment on column aicamp_consultations.contract_date   is '成約日（売上計上ベースの集計キー）';
comment on column aicamp_consultations.payment_amount  is '着金額（円）。分割払いは初回着金日に満額計上';
comment on column aicamp_consultations.payment_date    is '着金日（着金ベースの集計キー）';

-- backfill: 既存の成約レコードを売上計上軸へ引き継ぐ（再実行安全・冪等）
--   売上計上額 = 着金額（成約＝満額計上の前提）
--   成約日     = 着金日があれば着金日、無ければ相談日
update aicamp_consultations
set contract_amount = coalesce(contract_amount, payment_amount),
    contract_date   = coalesce(contract_date, payment_date, consultation_date::date)
where status = '成約'
  and payment_amount is not null
  and contract_amount is null;
