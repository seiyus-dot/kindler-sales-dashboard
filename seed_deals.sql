-- サンプル法人案件
insert into deals_tob (member_id, company_name, contact_name, industry, status, priority, first_contact_date, last_contact_date, expected_amount, win_probability, source, next_action, next_action_date, notes)
select m.id, v.company_name, v.contact_name, v.industry, v.status, v.priority, v.first_contact_date::date, v.last_contact_date::date, v.expected_amount, v.win_probability, v.source, v.next_action, v.next_action_date::date, v.notes
from members m
join (values
  ('門脇', '株式会社タナカ建設',    '田中 浩二',   '建設',    'クロージング', '高', '2026-02-10', '2026-04-01', 800,  80, '紹介',       '契約書送付',         '2026-04-05', '役員承認待ち。今週中に返答予定'),
  ('白岩', 'ABCホールディングス',   '鈴木 一郎',   '製造',    '提案中',       '高', '2026-02-20', '2026-03-28', 1200, 60, 'セミナー',   '提案書改訂版送付',   '2026-04-07', '競合2社と比較中。価格が課題'),
  ('佐々木','テックイノベーション', '山田 花子',   'IT',      '見積提出',     '中', '2026-03-01', '2026-03-30', 500,  70, 'Web問い合わせ','見積内容確認MTG', '2026-04-08', 'DX推進部門から直接打診あり'),
  ('宮瀬', 'グローバル商事',        '中村 敬介',   '商社',    'ヒアリング',   '中', '2026-03-10', '2026-03-25', 300,  40, '展示会',     '追加ヒアリング',     '2026-04-10', '担当者変更あり。関係構築中'),
  ('稲葉', '東都不動産',            '小林 雅人',   '不動産',  '提案中',       '高', '2026-02-15', '2026-03-29', 900,  65, '紹介',       '役員プレゼン',       '2026-04-09', '社長との面談設定済み'),
  ('髙橋', 'フューチャーメディア',  '加藤 真奈',   'メディア','初回接触',     '低', '2026-03-20', '2026-03-20', 200,  20, 'SNS',        '資料送付',           '2026-04-15', 'Webサイトから問い合わせ。まず資料展開'),
  ('門脇', '日本ロジスティクス',    '渡辺 健一',   '物流',    '受注',         '高', '2026-01-15', '2026-03-31', 1500, 100,'紹介',       null,                 null,         '3月末受注確定。導入支援フェーズへ'),
  ('白岩', 'サクラ食品工業',        '松本 誠司',   '食品',    'ヒアリング',   '中', '2026-03-15', '2026-03-27', 400,  45, 'セミナー',   '課題整理シート送付', '2026-04-11', '工場のDX化に興味。予算は来期'),
  ('佐々木','スマートエナジー',     '佐藤 由美',   'エネルギー','失注',        '低', '2026-01-20', '2026-03-10', 700,  0,  'Web問い合わせ',null,               null,         '他社に決定。来期再アプローチ検討'),
  ('宮瀬', 'ネクストモビリティ',    '伊藤 大輔',   '自動車',  'クロージング', '高', '2026-02-01', '2026-04-02', 1100, 85, '展示会',     '最終条件確認',       '2026-04-06', '価格交渉ほぼ合意。今週契約予定')
) as v(member_name, company_name, contact_name, industry, status, priority, first_contact_date, last_contact_date, expected_amount, win_probability, source, next_action, next_action_date, notes)
on m.name = v.member_name;

-- サンプル個人案件
insert into deals_toc (member_id, name, contact, source, status, priority, first_contact_date, last_contact_date, service, expected_amount, win_probability, next_action, next_action_date, notes)
select m.id, v.name, v.contact, v.source, v.status, v.priority, v.first_contact_date::date, v.last_contact_date::date, v.service, v.expected_amount, v.win_probability, v.next_action, v.next_action_date::date, v.notes
from members m
join (values
  ('門脇', '山本 和之', '090-1234-5678', '紹介',         'クロージング', '高', '2026-03-01', '2026-04-02', 'AI CAMP',     50, 90, '入会手続き案内',   '2026-04-05', '強い意欲あり。今週末に決断予定'),
  ('白岩', '田中 美里', 'LINE登録済み',  'SNS広告',      'ヒアリング',   '中', '2026-03-10', '2026-03-28', 'AI CAMP',     50, 55, '体験セッション',   '2026-04-08', '副業目的。週末参加希望'),
  ('佐々木','鈴木 拓也', 'メール連絡',   'Web問い合わせ','提案中',       '高', '2026-03-05', '2026-03-30', '個別コンサル', 30, 70, 'プラン詳細説明',  '2026-04-07', '転職支援目的。早期入会意向'),
  ('宮瀬', '伊藤 さくら','LINE登録済み', 'セミナー',     '相談予約',     '中', '2026-03-20', '2026-03-20', 'AI CAMP',     50, 30, '初回相談',         '2026-04-09', 'セミナー後に興味示す。まず話聞きたい'),
  ('稲葉', '加藤 健介', '080-9876-5432', '紹介',         '受注',         '高', '2026-02-20', '2026-03-25', '個別コンサル', 30, 100,'onboarding',      null,         '3月受注。4月より開始'),
  ('髙橋', '渡辺 由美', 'LINE登録済み',  'Instagram広告','ヒアリング',   '中', '2026-03-12', '2026-03-29', 'AI CAMP',     50, 50, '料金プラン案内',   '2026-04-10', '現職との両立を懸念。スケジュール調整中'),
  ('門脇', '小林 翔太', 'メール連絡',    'セミナー',     '失注',         '低', '2026-02-28', '2026-03-20', 'AI CAMP',     50,  0, null,              null,         '他スクール選択。価格が決め手'),
  ('白岩', '中村 あや', 'LINE登録済み',  'Twitter',      '提案中',       '中', '2026-03-18', '2026-04-01', '個別コンサル', 30, 60, 'サービス資料送付', '2026-04-08', 'AI活用で起業検討中。具体性高い'),
  ('佐々木','松本 浩一', '090-5555-4444', 'Web問い合わせ','クロージング', '高', '2026-03-08', '2026-04-02', 'AI CAMP',     50, 85, '最終確認連絡',    '2026-04-05', '申込フォーム記入済み。支払い確認待ち'),
  ('宮瀬', '高橋 めぐみ','LINE登録済み', 'Instagram広告','相談予約',     '低', '2026-03-25', '2026-03-25', 'AI CAMP',     50, 25, '初回相談',         '2026-04-12', '資料請求のみ。温度感低め')
) as v(member_name, name, contact, source, status, priority, first_contact_date, last_contact_date, service, expected_amount, win_probability, next_action, next_action_date, notes)
on m.name = v.member_name;
