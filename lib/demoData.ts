import type {
  Member, DealToB, AICampConsultation, WeeklyLog,
  MasterOption, ColumnConfig, AICampMonthlyGoal, AICampAdWeekly, DealAction,
  LineFriend, MemberMonthlyGoal, ProductAICampSession, ProductAICampCustomer,
  OrderRequest, Contact, Company, SourceMaster,
} from './supabase'
import type { AiCoachClient } from './supabase'

// ============================================================
// メンバー
// ============================================================
export const DEMO_MEMBERS: Member[] = [
  { id: 'm1', name: '田村', sort_order: 1 },
  { id: 'm2', name: '中村', sort_order: 2 },
  { id: 'm3', name: '加藤', sort_order: 3 },
  { id: 'm4', name: '吉田', sort_order: 4 },
  { id: 'm5', name: '山本', sort_order: 5 },
  { id: 'm6', name: '伊藤', sort_order: 6 },
]

// ============================================================
// 法人案件
// ============================================================
export const DEMO_TOB_DEALS: DealToB[] = [
  // 受注済み（着金あり）
  {
    id: 'tob-001', member_id: 'm1', company_name: '株式会社アルファシステム', status: '受注',
    expected_amount: 280, actual_amount: 280, contract_amount: 280, win_probability: 100,
    service: 'AI研修', contact_name: '田中 部長', industry: 'IT', source: '紹介', priority: '高',
    payment_date: '2025-11-10', contract_date: '2025-10-20', contract_start: '2025-11-01', contract_end: '2026-03-31',
    deal_type: 'spot', created_at: '2025-10-01T00:00:00Z', updated_at: '2025-11-10T00:00:00Z',
    member: { id: 'm1', name: '田村', sort_order: 1 },
  },
  {
    id: 'tob-002', member_id: 'm2', company_name: 'ベータ商事株式会社', status: '受注',
    expected_amount: 180, actual_amount: 180, contract_amount: 180, win_probability: 100,
    service: 'コンサルティング', contact_name: '鈴木 課長', industry: '商社', source: 'テレアポ', priority: '中',
    payment_date: '2025-11-20', contract_date: '2025-11-01', contract_start: '2025-11-15',
    deal_type: 'spot', created_at: '2025-10-10T00:00:00Z', updated_at: '2025-11-20T00:00:00Z',
    member: { id: 'm2', name: '中村', sort_order: 2 },
  },
  {
    id: 'tob-003', member_id: 'm3', company_name: '株式会社ガンマ製造', status: '受注',
    expected_amount: 350, actual_amount: 350, contract_amount: 350, win_probability: 100,
    service: 'AI研修', contact_name: '佐藤 人事部長', industry: '製造', source: '展示会', priority: '高',
    payment_date: '2025-12-05', contract_date: '2025-11-15', contract_start: '2025-12-01', contract_end: '2026-05-31',
    deal_type: 'spot', created_at: '2025-11-01T00:00:00Z', updated_at: '2025-12-05T00:00:00Z',
    member: { id: 'm3', name: '加藤', sort_order: 3 },
  },
  {
    id: 'tob-004', member_id: 'm4', company_name: 'デルタ株式会社', status: '受注',
    expected_amount: 240, actual_amount: 240, contract_amount: 240, win_probability: 100,
    service: 'システム開発支援', contact_name: '高橋 CTO', industry: 'IT', source: 'Web', priority: '高',
    payment_date: '2025-12-18', contract_date: '2025-12-01',
    deal_type: 'subscription', monthly_amount: 40, created_at: '2025-11-05T00:00:00Z', updated_at: '2025-12-18T00:00:00Z',
    member: { id: 'm4', name: '吉田', sort_order: 4 },
  },
  {
    id: 'tob-005', member_id: 'm5', company_name: '株式会社イプシロン産業', status: '受注',
    expected_amount: 320, actual_amount: 320, contract_amount: 320, win_probability: 100,
    service: 'AI研修', contact_name: '伊藤 経営企画室長', industry: '製造', source: '紹介', priority: '高',
    payment_date: '2026-01-15', contract_date: '2026-01-05', contract_start: '2026-01-15',
    deal_type: 'spot', created_at: '2025-12-01T00:00:00Z', updated_at: '2026-01-15T00:00:00Z',
    member: { id: 'm5', name: '山本', sort_order: 5 },
  },
  {
    id: 'tob-006', member_id: 'm1', company_name: 'ゼータ商会株式会社', status: '受注',
    expected_amount: 200, actual_amount: 200, contract_amount: 200, win_probability: 100,
    service: 'コンサルティング', contact_name: '渡辺 社長', industry: '小売', source: 'SNS', priority: '中',
    payment_date: '2026-01-25', contract_date: '2026-01-10',
    deal_type: 'spot', created_at: '2025-12-10T00:00:00Z', updated_at: '2026-01-25T00:00:00Z',
    member: { id: 'm1', name: '田村', sort_order: 1 },
  },
  {
    id: 'tob-007', member_id: 'm2', company_name: '株式会社エータ技術', status: '受注',
    expected_amount: 480, actual_amount: 480, contract_amount: 480, win_probability: 100,
    service: 'AI研修', contact_name: '山本 DX推進部長', industry: 'IT', source: '既存顧客', priority: '高',
    payment_date: '2026-02-08', contract_date: '2026-01-20', contract_start: '2026-02-01',
    deal_type: 'spot', created_at: '2026-01-05T00:00:00Z', updated_at: '2026-02-08T00:00:00Z',
    member: { id: 'm2', name: '中村', sort_order: 2 },
  },
  {
    id: 'tob-008', member_id: 'm3', company_name: 'シータ株式会社', status: '受注',
    expected_amount: 280, actual_amount: 280, contract_amount: 280, win_probability: 100,
    service: 'システム開発支援', contact_name: '中村 情報システム部長', industry: '金融', source: '紹介', priority: '中',
    payment_date: '2026-02-22', contract_date: '2026-02-05',
    deal_type: 'spot', created_at: '2026-01-10T00:00:00Z', updated_at: '2026-02-22T00:00:00Z',
    member: { id: 'm3', name: '加藤', sort_order: 3 },
  },
  {
    id: 'tob-009', member_id: 'm4', company_name: '株式会社イオタHD', status: '受注',
    expected_amount: 550, actual_amount: 550, contract_amount: 550, win_probability: 100,
    service: 'AI研修', contact_name: '小林 取締役', industry: '不動産', source: '展示会', priority: '高',
    payment_date: '2026-03-12', contract_date: '2026-02-25', contract_start: '2026-03-01',
    deal_type: 'spot', created_at: '2026-02-01T00:00:00Z', updated_at: '2026-03-12T00:00:00Z',
    member: { id: 'm4', name: '吉田', sort_order: 4 },
  },
  {
    id: 'tob-010', member_id: 'm5', company_name: 'カッパ商事株式会社', status: '受注',
    expected_amount: 320, actual_amount: 320, contract_amount: 320, win_probability: 100,
    service: 'コンサルティング', contact_name: '加藤 部長', industry: '商社', source: 'テレアポ', priority: '中',
    payment_date: '2026-03-25', contract_date: '2026-03-10',
    deal_type: 'spot', created_at: '2026-02-10T00:00:00Z', updated_at: '2026-03-25T00:00:00Z',
    member: { id: 'm5', name: '山本', sort_order: 5 },
  },
  {
    id: 'tob-011', member_id: 'm6', company_name: '株式会社ラムダ総合', status: '受注',
    expected_amount: 420, actual_amount: 420, contract_amount: 420, win_probability: 100,
    service: 'AI研修', contact_name: '斉藤 人事部', industry: 'サービス', source: '紹介', priority: '高',
    payment_date: '2026-04-10', contract_date: '2026-03-20', contract_start: '2026-04-01',
    deal_type: 'spot', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-04-10T00:00:00Z',
    member: { id: 'm6', name: '伊藤', sort_order: 6 },
  },
  // 進行中
  {
    id: 'tob-012', member_id: 'm1', company_name: 'ミュー工業株式会社', status: 'クロージング',
    expected_amount: 380, win_probability: 80,
    service: 'AI研修', contact_name: '木村 部長', industry: '製造', source: '展示会', priority: '高',
    next_action: '最終提案書提出', next_action_date: '2026-04-25',
    deal_type: 'spot', created_at: '2026-03-15T00:00:00Z', updated_at: '2026-04-18T00:00:00Z',
    member: { id: 'm1', name: '田村', sort_order: 1 },
  },
  {
    id: 'tob-013', member_id: 'm2', company_name: 'ニュー物産株式会社', status: '提案済',
    expected_amount: 260, win_probability: 60,
    service: 'コンサルティング', contact_name: '松田 課長', industry: '商社', source: 'Web', priority: '中',
    next_action: '追加資料送付', next_action_date: '2026-04-23',
    deal_type: 'spot', created_at: '2026-03-20T00:00:00Z', updated_at: '2026-04-15T00:00:00Z',
    member: { id: 'm2', name: '中村', sort_order: 2 },
  },
  {
    id: 'tob-014', member_id: 'm3', company_name: '株式会社クサイホールディングス', status: '商談中',
    expected_amount: 500, win_probability: 50,
    service: 'AI研修', contact_name: '藤田 役員', industry: 'IT', source: '紹介', priority: '高',
    next_action: '役員向けプレゼン', next_action_date: '2026-04-28',
    deal_type: 'spot', created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-20T00:00:00Z',
    member: { id: 'm3', name: '加藤', sort_order: 3 },
  },
  {
    id: 'tob-015', member_id: 'm4', company_name: 'オミクロン不動産', status: 'アポ取得',
    expected_amount: 200, win_probability: 30,
    service: 'コンサルティング', contact_name: '西田 マネージャー', industry: '不動産', source: 'テレアポ', priority: '低',
    next_action: '初回商談', next_action_date: '2026-04-24',
    deal_type: 'spot', created_at: '2026-04-05T00:00:00Z', updated_at: '2026-04-19T00:00:00Z',
    member: { id: 'm4', name: '吉田', sort_order: 4 },
  },
  {
    id: 'tob-016', member_id: 'm5', company_name: '株式会社パイ建設', status: '見積提出',
    expected_amount: 450, win_probability: 70,
    service: 'AI研修', contact_name: '橋本 部長', industry: '建設', source: '既存顧客', priority: '高',
    next_action: '見積内容確認', next_action_date: '2026-04-22',
    deal_type: 'spot', created_at: '2026-03-25T00:00:00Z', updated_at: '2026-04-17T00:00:00Z',
    member: { id: 'm5', name: '山本', sort_order: 5 },
  },
  {
    id: 'tob-017', member_id: 'm6', company_name: 'ロー薬品工業', status: '交渉中',
    expected_amount: 320, win_probability: 65,
    service: 'AI研修', contact_name: '村上 人事課長', industry: '医療', source: 'Web', priority: '中',
    next_action: '条件再提示', next_action_date: '2026-04-26',
    deal_type: 'spot', created_at: '2026-03-28T00:00:00Z', updated_at: '2026-04-16T00:00:00Z',
    member: { id: 'm6', name: '伊藤', sort_order: 6 },
  },
  // 失注
  {
    id: 'tob-018', member_id: 'm1', company_name: 'シグマ電機株式会社', status: '失注',
    expected_amount: 300, win_probability: 0,
    service: 'AI研修', contact_name: '大野 部長', industry: '製造', source: '展示会', priority: '中',
    loss_reason: '価格', loss_detail: '予算が合わなかった',
    deal_type: 'spot', created_at: '2026-02-15T00:00:00Z', updated_at: '2026-03-30T00:00:00Z',
    member: { id: 'm1', name: '田村', sort_order: 1 },
  },
]

// ============================================================
// AI CAMP 相談
// ============================================================
export const DEMO_AICAMP: AICampConsultation[] = [
  // 成約
  { id: 'ac-001', name: '佐々木 健', line_name: 'ken_s', age: 28, member_id: 'm1', status: '成約', service_type: 'AI CAMP', source: 'Meta広告', registration_source: 'Instagram', payment_amount: 198000, payment_date: '2026-04-05', payment_method: 'stripe(一括)', consultation_date: '2026-04-03T10:00:00', customer_attribute: '会社員', occupation: 'エンジニア', created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-05T00:00:00Z', member: { id: 'm1', name: '田村', sort_order: 1 } },
  { id: 'ac-002', name: '鈴木 美咲', line_name: 'misaki_s', age: 32, member_id: 'm2', status: '成約', service_type: 'AI CAMP', source: 'Meta広告', registration_source: 'Facebook', payment_amount: 198000, payment_date: '2026-04-08', payment_method: 'stripe(一括)', consultation_date: '2026-04-06T14:00:00', customer_attribute: '会社員', occupation: '営業', created_at: '2026-04-03T00:00:00Z', updated_at: '2026-04-08T00:00:00Z', member: { id: 'm2', name: '中村', sort_order: 2 } },
  { id: 'ac-003', name: '田中 隆', line_name: 'takashi_t', age: 35, member_id: 'm3', status: '成約', service_type: 'AI CAMP', source: '紹介', registration_source: '友人紹介', payment_amount: 198000, payment_date: '2026-04-10', payment_method: '銀行振込', consultation_date: '2026-04-08T11:00:00', customer_attribute: '経営者', occupation: '自営業', created_at: '2026-04-05T00:00:00Z', updated_at: '2026-04-10T00:00:00Z', member: { id: 'm3', name: '加藤', sort_order: 3 } },
  { id: 'ac-004', name: '山田 花子', line_name: 'hanako_y', age: 26, member_id: 'm4', status: '成約', service_type: 'AI CAMP', source: 'Meta広告', registration_source: 'Instagram', payment_amount: 198000, payment_date: '2026-04-12', payment_method: 'stripe(分割)', payment_count: 3, unit_amount: 66000, consultation_date: '2026-04-10T15:00:00', customer_attribute: '学生', occupation: '大学生', created_at: '2026-04-07T00:00:00Z', updated_at: '2026-04-12T00:00:00Z', member: { id: 'm4', name: '吉田', sort_order: 4 } },
  { id: 'ac-005', name: '伊藤 真一', line_name: 'shin_i', age: 42, member_id: 'm5', status: '成約', service_type: 'AI CAMP', source: 'YouTube', registration_source: 'YouTube', payment_amount: 198000, payment_date: '2026-04-15', payment_method: 'stripe(一括)', consultation_date: '2026-04-13T10:00:00', customer_attribute: '会社員', occupation: 'マーケター', created_at: '2026-04-10T00:00:00Z', updated_at: '2026-04-15T00:00:00Z', member: { id: 'm5', name: '山本', sort_order: 5 } },
  { id: 'ac-006', name: '渡辺 奈々', line_name: 'nana_w', age: 30, member_id: 'm6', status: '成約', service_type: 'AI CAMP', source: 'Meta広告', registration_source: 'Instagram', payment_amount: 198000, payment_date: '2026-04-18', payment_method: 'stripe(一括)', consultation_date: '2026-04-16T14:00:00', customer_attribute: '会社員', occupation: 'デザイナー', created_at: '2026-04-13T00:00:00Z', updated_at: '2026-04-18T00:00:00Z', member: { id: 'm6', name: '伊藤', sort_order: 6 } },
  { id: 'ac-007', name: '小林 俊介', line_name: 'shun_k', age: 38, member_id: 'm1', status: '成約', service_type: 'AI CAMP', source: 'Meta広告', registration_source: 'Facebook', payment_amount: 198000, payment_date: '2026-03-28', payment_method: 'stripe(一括)', consultation_date: '2026-03-25T11:00:00', customer_attribute: '会社員', occupation: '経理', created_at: '2026-03-20T00:00:00Z', updated_at: '2026-03-28T00:00:00Z', member: { id: 'm1', name: '田村', sort_order: 1 } },
  { id: 'ac-008', name: '中川 葵', line_name: 'aoi_n', age: 24, member_id: 'm2', status: '成約', service_type: 'AI CAMP', source: '紹介', registration_source: '友人紹介', payment_amount: 198000, payment_date: '2026-03-20', payment_method: 'stripe(分割)', payment_count: 3, unit_amount: 66000, consultation_date: '2026-03-18T15:00:00', customer_attribute: '学生', occupation: '専門学生', created_at: '2026-03-15T00:00:00Z', updated_at: '2026-03-20T00:00:00Z', member: { id: 'm2', name: '中村', sort_order: 2 } },
  { id: 'ac-009', name: '松本 裕樹', line_name: 'hiroki_m', age: 33, member_id: 'm3', status: '成約', service_type: 'AI CAMP', source: 'Meta広告', registration_source: 'Instagram', payment_amount: 198000, payment_date: '2026-03-15', payment_method: 'stripe(一括)', consultation_date: '2026-03-12T10:00:00', customer_attribute: '会社員', occupation: 'ITエンジニア', created_at: '2026-03-10T00:00:00Z', updated_at: '2026-03-15T00:00:00Z', member: { id: 'm3', name: '加藤', sort_order: 3 } },
  { id: 'ac-010', name: '井上 恵子', line_name: 'keiko_i', age: 45, member_id: 'm4', status: '成約', service_type: 'AI CAMP', source: 'YouTube', registration_source: 'YouTube', payment_amount: 198000, payment_date: '2026-03-10', payment_method: '銀行振込', consultation_date: '2026-03-07T14:00:00', customer_attribute: '経営者', occupation: 'フリーランス', created_at: '2026-03-05T00:00:00Z', updated_at: '2026-03-10T00:00:00Z', member: { id: 'm4', name: '吉田', sort_order: 4 } },
  // 予定
  { id: 'ac-011', name: '高橋 陽子', line_name: 'yoko_t', age: 29, member_id: 'm1', status: '予定', service_type: 'AI CAMP', source: 'Meta広告', registration_source: 'Instagram', consultation_date: '2026-04-22T10:00:00', customer_attribute: '会社員', occupation: '人事', reply_deadline: '2026-04-24', created_at: '2026-04-18T00:00:00Z', updated_at: '2026-04-18T00:00:00Z', member: { id: 'm1', name: '田村', sort_order: 1 } },
  { id: 'ac-012', name: '森田 智也', line_name: 'tomoya_m', age: 31, member_id: 'm2', status: '予定', service_type: 'AI CAMP', source: 'Meta広告', registration_source: 'Facebook', consultation_date: '2026-04-23T14:00:00', customer_attribute: '会社員', occupation: '営業', reply_deadline: '2026-04-25', created_at: '2026-04-19T00:00:00Z', updated_at: '2026-04-19T00:00:00Z', member: { id: 'm2', name: '中村', sort_order: 2 } },
  { id: 'ac-013', name: '野田 さくら', line_name: 'sakura_n', age: 22, member_id: 'm3', status: '予定', service_type: 'AI CAMP', source: '紹介', registration_source: '友人紹介', consultation_date: '2026-04-24T11:00:00', customer_attribute: '学生', occupation: '大学生', reply_deadline: '2026-04-26', created_at: '2026-04-20T00:00:00Z', updated_at: '2026-04-20T00:00:00Z', member: { id: 'm3', name: '加藤', sort_order: 3 } },
  // 失注
  { id: 'ac-014', name: '岡田 健二', line_name: 'kenji_o', age: 50, member_id: 'm4', status: '失注', service_type: 'AI CAMP', source: 'Meta広告', registration_source: 'Instagram', consultation_date: '2026-04-10T10:00:00', customer_attribute: '会社員', reason: '価格が合わない', created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-12T00:00:00Z', member: { id: 'm4', name: '吉田', sort_order: 4 } },
  { id: 'ac-015', name: '石田 美香', line_name: 'mika_i', age: 27, member_id: 'm5', status: '失注', service_type: 'AI CAMP', source: 'Meta広告', registration_source: 'Instagram', consultation_date: '2026-04-08T15:00:00', customer_attribute: '会社員', reason: 'タイミング', created_at: '2026-04-06T00:00:00Z', updated_at: '2026-04-09T00:00:00Z', member: { id: 'm5', name: '山本', sort_order: 5 } },
  // 保留
  { id: 'ac-016', name: '吉田 拓也', line_name: 'takuya_y', age: 36, member_id: 'm6', status: '保留', service_type: 'AI CAMP', source: 'YouTube', registration_source: 'YouTube', consultation_date: '2026-04-14T11:00:00', customer_attribute: '会社員', reply_deadline: '2026-04-30', created_at: '2026-04-12T00:00:00Z', updated_at: '2026-04-14T00:00:00Z', member: { id: 'm6', name: '伊藤', sort_order: 6 } },
]

// ============================================================
// LINE友達
// ============================================================
export const DEMO_LINE_FRIENDS: LineFriend[] = [
  { id: 'lf-001', line_user_id: 'U001', line_display_name: '田中さん', status: 'active', registration_source: 'Instagram', registered_at: '2026-04-01T00:00:00Z', created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z' },
  { id: 'lf-002', line_user_id: 'U002', line_display_name: '鈴木さん', status: 'active', registration_source: 'Facebook', registered_at: '2026-04-02T00:00:00Z', created_at: '2026-04-02T00:00:00Z', updated_at: '2026-04-02T00:00:00Z' },
  { id: 'lf-003', line_user_id: 'U003', line_display_name: '山田さん', status: 'active', registration_source: 'Instagram', registered_at: '2026-04-03T00:00:00Z', created_at: '2026-04-03T00:00:00Z', updated_at: '2026-04-03T00:00:00Z' },
  { id: 'lf-004', line_user_id: 'U004', line_display_name: '伊藤さん', status: 'active', registration_source: 'YouTube', registered_at: '2026-04-05T00:00:00Z', created_at: '2026-04-05T00:00:00Z', updated_at: '2026-04-05T00:00:00Z' },
  { id: 'lf-005', line_user_id: 'U005', line_display_name: '渡辺さん', status: 'blocked', registration_source: 'Instagram', blocked_at: '2026-04-10T00:00:00Z', registered_at: '2026-03-20T00:00:00Z', created_at: '2026-03-20T00:00:00Z', updated_at: '2026-04-10T00:00:00Z' },
  { id: 'lf-006', line_user_id: 'U006', line_display_name: '小林さん', status: 'active', registration_source: 'Facebook', registered_at: '2026-04-07T00:00:00Z', created_at: '2026-04-07T00:00:00Z', updated_at: '2026-04-07T00:00:00Z' },
  { id: 'lf-007', line_user_id: 'U007', line_display_name: '加藤さん', status: 'active', registration_source: 'Instagram', registered_at: '2026-04-08T00:00:00Z', created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z' },
  { id: 'lf-008', line_user_id: 'U008', line_display_name: '松本さん', status: 'active', registration_source: 'Instagram', registered_at: '2026-04-09T00:00:00Z', created_at: '2026-04-09T00:00:00Z', updated_at: '2026-04-09T00:00:00Z' },
  { id: 'lf-009', line_user_id: 'U009', line_display_name: '中川さん', status: 'active', registration_source: 'YouTube', registered_at: '2026-04-10T00:00:00Z', created_at: '2026-04-10T00:00:00Z', updated_at: '2026-04-10T00:00:00Z' },
  { id: 'lf-010', line_user_id: 'U010', line_display_name: '岡田さん', status: 'blocked', registration_source: 'Facebook', blocked_at: '2026-04-15T00:00:00Z', registered_at: '2026-04-05T00:00:00Z', created_at: '2026-04-05T00:00:00Z', updated_at: '2026-04-15T00:00:00Z' },
  ...Array.from({ length: 42 }, (_, i) => ({
    id: `lf-${100 + i}`, line_user_id: `U${100 + i}`, line_display_name: `ユーザー${100 + i}`,
    status: i % 7 === 0 ? 'blocked' : 'active',
    registration_source: ['Instagram', 'Facebook', 'YouTube', '友人紹介'][i % 4],
    registered_at: `2026-0${Math.floor(i / 15) + 3}-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    created_at: `2026-0${Math.floor(i / 15) + 3}-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    updated_at: `2026-0${Math.floor(i / 15) + 3}-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    ...(i % 7 === 0 ? { blocked_at: `2026-04-${String((i % 20) + 1).padStart(2, '0')}T00:00:00Z` } : {}),
  })),
]

// ============================================================
// 週次ログ
// ============================================================
export const DEMO_WEEKLY_LOGS: WeeklyLog[] = [
  { id: 'wl-01', log_date: '2025-11-10', tob_count: 2, toc_count: 0, tob_amount: 460, toc_amount: 0, weighted_total: 460, cumulative_orders: 2, memo: '初月スタート' },
  { id: 'wl-02', log_date: '2025-12-15', tob_count: 2, toc_count: 0, tob_amount: 590, toc_amount: 0, weighted_total: 590, cumulative_orders: 4 },
  { id: 'wl-03', log_date: '2026-01-20', tob_count: 2, toc_count: 0, tob_amount: 520, toc_amount: 0, weighted_total: 520, cumulative_orders: 6 },
  { id: 'wl-04', log_date: '2026-02-17', tob_count: 2, toc_count: 0, tob_amount: 760, toc_amount: 0, weighted_total: 760, cumulative_orders: 8 },
  { id: 'wl-05', log_date: '2026-03-24', tob_count: 2, toc_count: 0, tob_amount: 870, toc_amount: 0, weighted_total: 870, cumulative_orders: 10 },
  { id: 'wl-06', log_date: '2026-04-14', tob_count: 1, toc_count: 0, tob_amount: 420, toc_amount: 0, weighted_total: 420, cumulative_orders: 11, memo: '今月1件目受注' },
]

// ============================================================
// マスタ設定
// ============================================================
export const DEMO_MASTER_OPTIONS: MasterOption[] = [
  { id: 'mo-01', type: 'service', value: 'AI研修', sort_order: 1 },
  { id: 'mo-02', type: 'service', value: 'コンサルティング', sort_order: 2 },
  { id: 'mo-03', type: 'service', value: 'システム開発支援', sort_order: 3 },
  { id: 'mo-04', type: 'service', value: 'AI顧問', sort_order: 4 },
  { id: 'mo-05', type: 'source', value: '紹介', sort_order: 1 },
  { id: 'mo-06', type: 'source', value: 'テレアポ', sort_order: 2 },
  { id: 'mo-07', type: 'source', value: '展示会', sort_order: 3 },
  { id: 'mo-08', type: 'source', value: 'Web', sort_order: 4 },
  { id: 'mo-09', type: 'source', value: 'SNS', sort_order: 5 },
  { id: 'mo-10', type: 'source', value: '既存顧客', sort_order: 6 },
  { id: 'mo-11', type: 'industry', value: 'IT', sort_order: 1 },
  { id: 'mo-12', type: 'industry', value: '製造', sort_order: 2 },
  { id: 'mo-13', type: 'industry', value: '商社', sort_order: 3 },
  { id: 'mo-14', type: 'industry', value: '金融', sort_order: 4 },
  { id: 'mo-15', type: 'industry', value: '不動産', sort_order: 5 },
  { id: 'mo-16', type: 'industry', value: '医療', sort_order: 6 },
  { id: 'mo-17', type: 'industry', value: '小売', sort_order: 7 },
  { id: 'mo-18', type: 'industry', value: 'サービス', sort_order: 8 },
  { id: 'mo-19', type: 'industry', value: '建設', sort_order: 9 },
]

// ============================================================
// カラム設定
// ============================================================
export const DEMO_COLUMN_CONFIG: ColumnConfig[] = [
  { id: 'cc-01', table_type: 'tob', column_key: 'company_name', label: '企業名', visible: true, sort_order: 1 },
  { id: 'cc-02', table_type: 'tob', column_key: 'member', label: '担当者', visible: true, sort_order: 2 },
  { id: 'cc-03', table_type: 'tob', column_key: 'status', label: 'ステータス', visible: true, sort_order: 3 },
  { id: 'cc-04', table_type: 'tob', column_key: 'service', label: 'サービス', visible: true, sort_order: 4 },
  { id: 'cc-05', table_type: 'tob', column_key: 'expected_amount', label: '受注見込（万円）', visible: true, sort_order: 5 },
  { id: 'cc-06', table_type: 'tob', column_key: 'win_probability', label: '確度', visible: true, sort_order: 6 },
  { id: 'cc-07', table_type: 'tob', column_key: 'next_action_date', label: '次回期日', visible: true, sort_order: 7 },
  { id: 'cc-08', table_type: 'tob', column_key: 'contract_date', label: '契約締結日', visible: true, sort_order: 8 },
  { id: 'cc-09', table_type: 'tob', column_key: 'payment_date', label: '着金日', visible: true, sort_order: 9 },
  { id: 'cc-10', table_type: 'tob', column_key: 'source', label: '流入元', visible: false, sort_order: 10 },
  { id: 'cc-11', table_type: 'tob', column_key: 'industry', label: '業種', visible: false, sort_order: 11 },
]

// ============================================================
// AI CAMP 月次目標
// ============================================================
export const DEMO_AICAMP_GOALS: AICampMonthlyGoal[] = [
  { id: 'ag-01', month: '2026-02', contract_goal: 8, product_contract_goal: 3, created_at: '2026-01-31T00:00:00Z' },
  { id: 'ag-02', month: '2026-03', contract_goal: 10, product_contract_goal: 4, created_at: '2026-02-28T00:00:00Z' },
  { id: 'ag-03', month: '2026-04', contract_goal: 12, product_contract_goal: 5, created_at: '2026-03-31T00:00:00Z' },
]

// ============================================================
// 広告週次データ
// ============================================================
export const DEMO_AD_WEEKLY: AICampAdWeekly[] = [
  { id: 'aw-01', month: '2026-04', week_label: '4/1〜4/7', ad_spend: 280000, list_count: 42, consultation_count: 18, seated_count: 16, sort_order: 1, service_type: 'AI CAMP', created_at: '2026-04-07T00:00:00Z' },
  { id: 'aw-02', month: '2026-04', week_label: '4/8〜4/14', ad_spend: 310000, list_count: 48, consultation_count: 22, seated_count: 19, sort_order: 2, service_type: 'AI CAMP', created_at: '2026-04-14T00:00:00Z' },
  { id: 'aw-03', month: '2026-04', week_label: '4/15〜4/21', ad_spend: 295000, list_count: 45, consultation_count: 20, seated_count: 18, sort_order: 3, service_type: 'AI CAMP', created_at: '2026-04-21T00:00:00Z' },
  { id: 'aw-04', month: '2026-03', week_label: '3/1〜3/7', ad_spend: 260000, list_count: 38, consultation_count: 15, seated_count: 13, sort_order: 1, service_type: 'AI CAMP', created_at: '2026-03-07T00:00:00Z' },
  { id: 'aw-05', month: '2026-03', week_label: '3/8〜3/14', ad_spend: 280000, list_count: 42, consultation_count: 19, seated_count: 17, sort_order: 2, service_type: 'AI CAMP', created_at: '2026-03-14T00:00:00Z' },
  { id: 'aw-06', month: '2026-03', week_label: '3/15〜3/21', ad_spend: 270000, list_count: 40, consultation_count: 18, seated_count: 16, sort_order: 3, service_type: 'AI CAMP', created_at: '2026-03-21T00:00:00Z' },
  { id: 'aw-07', month: '2026-03', week_label: '3/22〜3/31', ad_spend: 300000, list_count: 46, consultation_count: 21, seated_count: 18, sort_order: 4, service_type: 'AI CAMP', created_at: '2026-03-31T00:00:00Z' },
]

// ============================================================
// 案件アクション
// ============================================================
export const DEMO_DEAL_ACTIONS: DealAction[] = [
  { id: 'da-01', deal_id: 'tob-012', deal_type: 'tob', member_id: 'm1', action_type: '商談', action_date: '2026-04-18', notes: '課題ヒアリング完了。次回最終提案。', created_at: '2026-04-18T00:00:00Z', member: { id: 'm1', name: '田村', sort_order: 1 } },
  { id: 'da-02', deal_id: 'tob-012', deal_type: 'tob', member_id: 'm1', action_type: '提案', action_date: '2026-04-10', notes: '提案書を送付。反応良好。', created_at: '2026-04-10T00:00:00Z', member: { id: 'm1', name: '田村', sort_order: 1 } },
  { id: 'da-03', deal_id: 'tob-013', deal_type: 'tob', member_id: 'm2', action_type: '商談', action_date: '2026-04-15', notes: '詳細ヒアリング。追加資料要請あり。', created_at: '2026-04-15T00:00:00Z', member: { id: 'm2', name: '中村', sort_order: 2 } },
  { id: 'da-04', deal_id: 'tob-014', deal_type: 'tob', member_id: 'm3', action_type: '初回接触', action_date: '2026-04-05', notes: '紹介経由。社長と面談。関心高い。', created_at: '2026-04-05T00:00:00Z', member: { id: 'm3', name: '加藤', sort_order: 3 } },
]

// ============================================================
// メンバー月次目標
// ============================================================
export const DEMO_MEMBER_GOALS: MemberMonthlyGoal[] = [
  { id: 'mg-01', member_id: 'm1', month: '2026-04', target_amount: 500, created_at: '2026-03-31T00:00:00Z' },
  { id: 'mg-02', member_id: 'm2', month: '2026-04', target_amount: 450, created_at: '2026-03-31T00:00:00Z' },
  { id: 'mg-03', member_id: 'm3', month: '2026-04', target_amount: 600, created_at: '2026-03-31T00:00:00Z' },
  { id: 'mg-04', member_id: 'm4', month: '2026-04', target_amount: 500, created_at: '2026-03-31T00:00:00Z' },
  { id: 'mg-05', member_id: 'm5', month: '2026-04', target_amount: 550, created_at: '2026-03-31T00:00:00Z' },
  { id: 'mg-06', member_id: 'm6', month: '2026-04', target_amount: 400, created_at: '2026-03-31T00:00:00Z' },
]

// ============================================================
// Product AI CAMP セッション
// ============================================================
export const DEMO_PRODUCT_SESSIONS: ProductAICampSession[] = [
  { id: 'ps-01', title: 'Product AI CAMP 第1期', session_date: '2026-04-26', end_date: '2026-04-27', max_capacity: 20, notes: '東京・渋谷会場', created_at: '2026-03-01T00:00:00Z' },
  { id: 'ps-02', title: 'Product AI CAMP 第2期', session_date: '2026-05-24', end_date: '2026-05-25', max_capacity: 20, notes: '東京・渋谷会場', created_at: '2026-03-15T00:00:00Z' },
  { id: 'ps-03', title: 'Product AI CAMP 第3期', session_date: '2026-06-21', end_date: '2026-06-22', max_capacity: 20, notes: '東京・渋谷会場', created_at: '2026-04-01T00:00:00Z' },
]

// ============================================================
// Product AI CAMP 受講者
// ============================================================
export const DEMO_PRODUCT_CUSTOMERS: ProductAICampCustomer[] = [
  { id: 'pc-01', name: '田中 一郎', phone: '090-1111-0001', email: 'tanaka1@example.com', session_id: 'ps-01', status: '参加確定', notes: '', created_at: '2026-04-05T00:00:00Z', session: DEMO_PRODUCT_SESSIONS[0] },
  { id: 'pc-02', name: '鈴木 二郎', phone: '090-1111-0002', email: 'suzuki2@example.com', session_id: 'ps-01', status: '参加確定', notes: '', created_at: '2026-04-06T00:00:00Z', session: DEMO_PRODUCT_SESSIONS[0] },
  { id: 'pc-03', name: '佐藤 三郎', phone: '090-1111-0003', email: 'sato3@example.com', session_id: 'ps-01', status: '参加確定', notes: '', created_at: '2026-04-07T00:00:00Z', session: DEMO_PRODUCT_SESSIONS[0] },
  { id: 'pc-04', name: '高橋 四子', phone: '090-1111-0004', email: 'takahashi4@example.com', session_id: 'ps-01', status: '参加確定', notes: '', created_at: '2026-04-08T00:00:00Z', session: DEMO_PRODUCT_SESSIONS[0] },
  { id: 'pc-05', name: '伊藤 五郎', phone: '090-1111-0005', email: 'ito5@example.com', session_id: 'ps-01', status: '仮申込', notes: '入金待ち', created_at: '2026-04-10T00:00:00Z', session: DEMO_PRODUCT_SESSIONS[0] },
  { id: 'pc-06', name: '渡辺 六子', phone: '090-1111-0006', email: 'watanabe6@example.com', session_id: 'ps-02', status: '参加確定', notes: '', created_at: '2026-04-12T00:00:00Z', session: DEMO_PRODUCT_SESSIONS[1] },
  { id: 'pc-07', name: '山本 七郎', phone: '090-1111-0007', email: 'yamamoto7@example.com', session_id: 'ps-02', status: '参加確定', notes: '', created_at: '2026-04-13T00:00:00Z', session: DEMO_PRODUCT_SESSIONS[1] },
  { id: 'pc-08', name: '中村 八重', phone: '090-1111-0008', email: 'nakamura8@example.com', session_id: 'ps-02', status: '仮申込', notes: '', created_at: '2026-04-15T00:00:00Z', session: DEMO_PRODUCT_SESSIONS[1] },
]

// ============================================================
// AI顧問クライアント
// ============================================================
export const DEMO_ADVISOR_CLIENTS: AiCoachClient[] = [
  {
    id: 'adv-01', name: '株式会社テックイノベーション', plan: '6ヶ月', startDate: '2026-01-01', phase: '実装フェーズ',
    goals: 'AI活用による業務効率化、ChatGPT APIの社内システム組み込み',
    items: [
      { id: 'adv-01-i1', label: 'AI顧問契約期間', start: '2026-01-01', end: '2026-06-30', colorIdx: 0 },
      { id: 'adv-01-i2', label: '要件定義・現状分析', start: '2026-01-01', end: '2026-01-31', colorIdx: 1 },
      { id: 'adv-01-i3', label: 'プロトタイプ開発', start: '2026-02-01', end: '2026-03-31', colorIdx: 2 },
      { id: 'adv-01-i4', label: '本番実装・テスト', start: '2026-04-01', end: '2026-06-30', colorIdx: 3 },
    ],
  },
  {
    id: 'adv-02', name: '株式会社マーケティングブースト', plan: '3ヶ月', startDate: '2026-02-01', phase: '戦略立案フェーズ',
    goals: 'AIを活用したマーケティング自動化、SNS運用の最適化',
    items: [
      { id: 'adv-02-i1', label: 'AI顧問契約期間', start: '2026-02-01', end: '2026-04-30', colorIdx: 0 },
      { id: 'adv-02-i2', label: '現状分析・戦略立案', start: '2026-02-01', end: '2026-02-28', colorIdx: 1 },
      { id: 'adv-02-i3', label: 'ツール導入・運用開始', start: '2026-03-01', end: '2026-04-30', colorIdx: 2 },
    ],
  },
  {
    id: 'adv-03', name: '株式会社グローバルロジスティクス', plan: '12ヶ月', startDate: '2025-10-01', phase: '運用最適化フェーズ',
    goals: '物流管理システムへのAI組み込み、需要予測モデルの構築',
    items: [
      { id: 'adv-03-i1', label: 'AI顧問契約期間', start: '2025-10-01', end: '2026-09-30', colorIdx: 0 },
      { id: 'adv-03-i2', label: 'データ分析・要件定義', start: '2025-10-01', end: '2025-11-30', colorIdx: 1 },
      { id: 'adv-03-i3', label: '予測モデル開発', start: '2025-12-01', end: '2026-03-31', colorIdx: 2 },
      { id: 'adv-03-i4', label: 'システム統合・本番移行', start: '2026-04-01', end: '2026-09-30', colorIdx: 3 },
    ],
  },
]

// ============================================================
// 発注リスト
// ============================================================
export const DEMO_ORDER_REQUESTS: OrderRequest[] = [
  {
    id: 'or-01', created_at: '2026-04-10T10:00:00Z',
    company_name: '株式会社テックイノベーション', rep_name_kanji: '山田 太郎', rep_name_kana: 'ヤマダ タロウ',
    company_phone: '03-1234-5678', contact_name_kanji: '佐藤 花子', contact_name_kana: 'サトウ ハナコ',
    department: 'DX推進部', position: 'マネージャー', contact_email: 'sato@techinno.jp', contact_phone: '090-1234-5678',
    billing_zip: '150-0001', billing_address: '東京都渋谷区神南1-1-1', billing_name_kanji: '山田 太郎', billing_name_kana: 'ヤマダ タロウ',
    billing_position: '代表取締役', billing_department: null, billing_email: 'billing@techinno.jp',
    services: ['AI研修（法人）'], order_detail: '全社員向けAI活用研修 50名', status: '対応中',
  },
  {
    id: 'or-02', created_at: '2026-04-08T14:00:00Z',
    company_name: 'ベータ商事株式会社', rep_name_kanji: '鈴木 一郎', rep_name_kana: 'スズキ イチロウ',
    company_phone: '06-2345-6789', contact_name_kanji: '田中 次郎', contact_name_kana: 'タナカ ジロウ',
    department: '人事部', position: '課長', contact_email: 'tanaka@beta.co.jp', contact_phone: null,
    billing_zip: '530-0001', billing_address: '大阪府大阪市北区梅田2-2-2', billing_name_kanji: '鈴木 一郎', billing_name_kana: 'スズキ イチロウ',
    billing_position: null, billing_department: null, billing_email: null,
    services: ['コンサルティング'], order_detail: 'DX戦略コンサルティング 3ヶ月', status: '未対応',
  },
  {
    id: 'or-03', created_at: '2026-04-05T09:00:00Z',
    company_name: '株式会社ガンマ製造', rep_name_kanji: '高橋 三郎', rep_name_kana: 'タカハシ サブロウ',
    company_phone: '052-3456-7890', contact_name_kanji: '渡辺 四子', contact_name_kana: 'ワタナベ ヨツコ',
    department: '製造部', position: '部長', contact_email: 'watanabe@gamma.co.jp', contact_phone: '090-3456-7890',
    billing_zip: '460-0001', billing_address: '愛知県名古屋市中区栄3-3-3', billing_name_kanji: '高橋 三郎', billing_name_kana: 'タカハシ サブロウ',
    billing_position: '代表取締役', billing_department: null, billing_email: 'billing@gamma.co.jp',
    services: ['AI研修（法人）'], order_detail: '製造ライン向けAI導入研修', status: '完了',
  },
]

// ============================================================
// 顧客（個人）
// ============================================================
export const DEMO_CONTACTS: Contact[] = [
  { id: 'ct-01', name: '佐々木 健', phone: '090-1111-2001', email: 'ken@example.com', notes: 'AI CAMP 2026年4月成約', created_at: '2026-04-05T00:00:00Z', updated_at: '2026-04-05T00:00:00Z' },
  { id: 'ct-02', name: '鈴木 美咲', phone: '090-1111-2002', email: 'misaki@example.com', notes: 'AI CAMP 2026年4月成約', created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z' },
  { id: 'ct-03', name: '田中 隆', phone: '090-1111-2003', email: 'takashi@example.com', notes: 'AI CAMP 成約・紹介経由', created_at: '2026-04-10T00:00:00Z', updated_at: '2026-04-10T00:00:00Z' },
  { id: 'ct-04', name: '山田 花子', phone: '090-1111-2004', email: 'hanako@example.com', notes: '分割払い対応', created_at: '2026-04-12T00:00:00Z', updated_at: '2026-04-12T00:00:00Z' },
  { id: 'ct-05', name: '伊藤 真一', phone: '090-1111-2005', email: 'shinichi@example.com', notes: 'YouTube経由', created_at: '2026-04-15T00:00:00Z', updated_at: '2026-04-15T00:00:00Z' },
  { id: 'ct-06', name: '渡辺 奈々', phone: '090-1111-2006', email: 'nana@example.com', notes: '', created_at: '2026-04-18T00:00:00Z', updated_at: '2026-04-18T00:00:00Z' },
  { id: 'ct-07', name: '小林 俊介', phone: '090-1111-2007', email: 'shun@example.com', notes: '3月成約', created_at: '2026-03-28T00:00:00Z', updated_at: '2026-03-28T00:00:00Z' },
  { id: 'ct-08', name: '中川 葵', phone: '090-1111-2008', email: 'aoi@example.com', notes: '分割払い', created_at: '2026-03-20T00:00:00Z', updated_at: '2026-03-20T00:00:00Z' },
]

// ============================================================
// 顧客（法人）
// ============================================================
export const DEMO_SOURCE_MASTERS: SourceMaster[] = [
  { id: 'sm-01', registration_source: 'LP経由（AI CAMP公式）', source: 'Web広告', created_at: '2025-01-01T00:00:00Z' },
  { id: 'sm-02', registration_source: 'Meta広告LP', source: 'Web広告', created_at: '2025-01-01T00:00:00Z' },
  { id: 'sm-03', registration_source: 'Google広告LP', source: 'Web広告', created_at: '2025-01-01T00:00:00Z' },
  { id: 'sm-04', registration_source: 'Instagram公式アカウント', source: 'SNS', created_at: '2025-01-01T00:00:00Z' },
  { id: 'sm-05', registration_source: 'Twitter/X', source: 'SNS', created_at: '2025-01-01T00:00:00Z' },
  { id: 'sm-06', registration_source: 'YouTube', source: 'SNS', created_at: '2025-01-01T00:00:00Z' },
  { id: 'sm-07', registration_source: '友人・知人紹介', source: '紹介', created_at: '2025-01-01T00:00:00Z' },
  { id: 'sm-08', registration_source: '卒業生紹介', source: '紹介', created_at: '2025-01-01T00:00:00Z' },
  { id: 'sm-09', registration_source: 'LINE公式アカウント', source: 'LINE', created_at: '2025-01-01T00:00:00Z' },
  { id: 'sm-10', registration_source: 'LINEロードマップ体験会', source: 'LINE', created_at: '2025-01-01T00:00:00Z' },
]

export const DEMO_COMPANIES: Company[] = [
  { id: 'co-01', name: '株式会社アルファシステム', industry: 'IT', notes: 'AI研修 受注済み', created_at: '2025-10-01T00:00:00Z', updated_at: '2025-11-10T00:00:00Z' },
  { id: 'co-02', name: 'ベータ商事株式会社', industry: '商社', notes: 'コンサル 受注済み', created_at: '2025-10-10T00:00:00Z', updated_at: '2025-11-20T00:00:00Z' },
  { id: 'co-03', name: '株式会社ガンマ製造', industry: '製造', notes: 'AI研修 受注済み', created_at: '2025-11-01T00:00:00Z', updated_at: '2025-12-05T00:00:00Z' },
  { id: 'co-04', name: 'デルタ株式会社', industry: 'IT', notes: 'サブスク契約', created_at: '2025-11-05T00:00:00Z', updated_at: '2025-12-18T00:00:00Z' },
  { id: 'co-05', name: '株式会社イプシロン産業', industry: '製造', notes: '', created_at: '2025-12-01T00:00:00Z', updated_at: '2026-01-15T00:00:00Z' },
  { id: 'co-06', name: '株式会社テックイノベーション', industry: 'IT', notes: 'AI顧問契約中', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'co-07', name: '株式会社マーケティングブースト', industry: 'サービス', notes: 'AI顧問契約中', created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' },
]
