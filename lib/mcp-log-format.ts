/**
 * MCP実行ログ（/mcp-logs）を人が読める日本語にするための表示用ヘルパー。
 * ツール名・引数・テーブル名・列名を日本語にし、1回の実行を一文で言い表す。
 * 表示専用（ブラウザで動く）。記録側は lib/mcp-audit.ts。
 */

/** 記録側で配列を切り詰めたときに末尾に置く印（{ __more: 残り件数 }）。表示では「ほかN件」にする */
export const MORE_MARKER = '__more'

export const TABLE_LABELS: Record<string, string> = {
  members: 'メンバー',
  deals_tob: '法人案件',
  deals_toc: '個人案件',
  deal_actions: '商談の活動ログ',
  weekly_logs: '週次ログ',
  clients: '取引先',
  contracts: '契約',
  contract_items: '契約明細',
  contacts: '顧客（個人）',
  companies: '顧客（法人）',
  meeting_notes: '議事録',
  aicamp_consultations: 'AI CAMP相談',
  product_aicamp_sessions: 'Product AI CAMP開催回',
  product_aicamp_customers: 'Product AI CAMP申込者',
  news: 'お知らせ',
}

const TOOL_LABELS: Record<string, string> = {
  list_tables: '使えるデータの一覧を確認',
  query_rows: 'データを検索',
  insert_row: 'データを登録',
  update_row: 'データを更新',
  delete_row: 'データを削除',
  gmail_search_threads: 'メールを検索',
  gmail_get_thread: 'メールのやり取りを読む',
  gmail_create_draft: 'メールの下書きを作成',
  gmail_update_draft: 'メールの下書きを修正',
  gmail_send_draft: 'メールを送信',
  mf_search_partners: 'MF取引先を検索',
  mf_create_partner: 'MF取引先を作成',
  mf_update_partner: 'MF取引先を更新',
  mf_add_partner_department: 'MF取引先に部門を追加',
  mf_search_billings: '請求書を検索',
  mf_get_billing: '請求書の詳細を見る',
  mf_get_sent_history: '請求書の送付履歴を見る',
  mf_check_duplicate_billing: '請求書の二重作成をチェック',
  mf_create_billing_draft: '請求書の下書きを作成',
  mf_update_billing_draft: '請求書の下書きを更新',
  mf_add_billing_item: '請求書に明細を追加',
  mf_remove_billing_item: '請求書から明細を削除',
  mf_delete_billing_draft: '請求書の下書きを削除',
  mf_update_payment_status: '入金状況を更新',
  mf_payment_forecast: '入金予測を見る',
  mf_upcoming_payments: '入金予定を見る',
  mf_overdue_billings: '入金遅れの請求書を見る',
  mf_partner_receivables: '取引先ごとの売掛金を見る',
  mf_search_quotes: '見積書を検索',
  mf_get_quote: '見積書の詳細を見る',
  mf_create_quote_draft: '見積書の下書きを作成',
  mf_update_quote_draft: '見積書の下書きを更新',
  mf_delete_quote_draft: '見積書の下書きを削除',
  mf_convert_quote_to_billing: '見積書を請求書に変換',
  mf_search_items: 'MF品目を検索',
  mf_create_item: 'MF品目を作成',
  mf_update_item: 'MF品目を更新',
  sheet_import: 'スプレッドシートから案件・商談を反映',
}

export function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool
}

/** 引数・結果の列名（よく出るもの）。無いものは英語のまま出す */
const KEY_LABELS: Record<string, string> = {
  table: '対象',
  columns: '取得する項目',
  filters: '条件',
  order_by: '並び順',
  ascending: '昇順',
  limit: '件数',
  data: '内容',
  match: '対象の行',
  query: '検索条件',
  max_results: '件数',
  thread_id: 'スレッド',
  draft_id: '下書き',
  to: '宛先',
  cc: 'CC',
  bcc: 'BCC',
  subject: '件名',
  body: '本文',
  reply_to_thread_id: '返信先スレッド',
  confirmed_by_user: '利用者の承認',
  deal_id: '商談',
  deal_type: '商談の種別',
  keyword: 'キーワード',
  partner_id: '取引先',
  billing_id: '請求書',
  quote_id: '見積書',
  item_id: '品目',
  title: '件名',
  memo: 'メモ',
  billing_date: '請求日',
  due_date: '支払期限',
  sales_date: '売上日',
  quote_date: '見積日',
  expired_date: '有効期限',
  items: '明細',
  quantity: '数量',
  unit: '単位',
  unit_price: '単価',
  price: '金額',
  tax_rate: '税率',
  detail: '詳細',
  department: '部門',
  person_name: '担当者名',
  person_title: '役職',
  zip: '郵便番号',
  tel: '電話',
  months_back: '過去の月数',
  months_ahead: '先の月数',
  min_overdue_days: '遅れの日数（以上）',
  unpaid_only: '未入金のみ',
  include_excluded: '除外分も含む',
  around_date: '基準日',
  window_days: '前後の日数',
  skip_duplicate_check: '重複チェックを省略',
  code: 'コード',
  // よく出る列名
  id: 'ID',
  name: '名前',
  name_kana: 'カナ',
  email: 'メール',
  phone: '電話',
  notes: 'メモ',
  industry: '業種',
  company_name: '会社名',
  contact_name: '担当者',
  status: 'ステータス',
  priority: '優先度',
  expected_amount: '見込金額（万円）',
  win_probability: '確度（%）',
  member_id: '担当者',
  action_type: '活動の種類',
  action_date: '活動日',
  created_at: '作成日時',
  updated_at: '更新日時',
  from: '差出人',
  date: '日時',
  last_date: '最終日時',
  message_count: '通数',
  snippet: '冒頭',
  status_text: '状態',
  count: '件数',
  matched_count: '該当件数',
}

export function keyLabel(key: string): string {
  return KEY_LABELS[key] ?? key
}

/** 条件1つを「会社名に「山本」を含む」のような文にする */
const OP_SENTENCES: Record<string, (col: string, val: string) => string> = {
  eq: (c, v) => `${c}が「${v}」`,
  neq: (c, v) => `${c}が「${v}」以外`,
  gt: (c, v) => `${c}が${v}より大きい`,
  gte: (c, v) => `${c}が${v}以上`,
  lt: (c, v) => `${c}が${v}より小さい`,
  lte: (c, v) => `${c}が${v}以下`,
  like: (c, v) => `${c}に「${v}」を含む`,
  ilike: (c, v) => `${c}に「${v}」を含む`,
  in: (c, v) => `${c}が「${v}」のいずれか`,
  is: (c, v) => (v === '空' ? `${c}が空` : `${c}が${v}`),
}

function plain(v: unknown): string {
  if (v === null || v === undefined) return '空'
  if (typeof v === 'boolean') return v ? 'はい' : 'いいえ'
  if (Array.isArray(v)) return v.map(plain).join('、')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v).replace(/^%|%$/g, '')
}

type Filter = { column?: string; op?: string; value?: unknown }

export function describeFilters(filters: unknown): string {
  if (!Array.isArray(filters) || filters.length === 0) return ''
  return (filters as Filter[])
    .map((f) => {
      const col = keyLabel(String(f.column ?? ''))
      const sentence = OP_SENTENCES[String(f.op)]
      return sentence ? sentence(col, plain(f.value)) : `${col} ${f.op} ${plain(f.value)}`
    })
    .join('、')
}

function list(v: unknown): string {
  return Array.isArray(v) ? v.join('、') : String(v ?? '')
}

/** 1回の実行を一文で言い表す（ログのタイムラインの見出し） */
export function describeAction(tool: string, args: Record<string, unknown> | null): string {
  const a = args ?? {}
  const table = TABLE_LABELS[String(a.table)] ?? String(a.table ?? '')
  switch (tool) {
    case 'query_rows': {
      // 例:「法人案件を検索：会社名に「山本」を含む、作成日時の新しい順（最大3件）」
      const details: string[] = []
      const cond = describeFilters(a.filters)
      if (cond) details.push(cond)
      if (a.order_by) {
        const col = String(a.order_by)
        const isTime = /(_at|_date|date)$/.test(col)
        const desc = a.ascending === false
        details.push(`${keyLabel(col)}の${isTime ? (desc ? '新しい順' : '古い順') : desc ? '大きい順' : '小さい順'}`)
      }
      return `${table}を検索${details.length ? `：${details.join('、')}` : ''}（最大${a.limit ?? 50}件）`
    }
    case 'insert_row':
      return `${table}に1件登録`
    case 'update_row':
      return `${table}を更新`
    case 'delete_row':
      return `${table}から削除`
    case 'gmail_search_threads':
      return `メールを検索（${a.query ?? ''}）`
    case 'gmail_create_draft':
    case 'gmail_update_draft':
      return `${toolLabel(tool)}：${list(a.to)} 宛て「${a.subject ?? '返信'}」`
    case 'gmail_send_draft':
      return a.deal_id ? 'メールを送信し、商談の活動ログに記録' : 'メールを送信'
    default:
      return toolLabel(tool)
  }
}

/** 値を1行の表示用文字列にする */
export function formatValue(key: string, v: unknown): string {
  if (key === 'table') return TABLE_LABELS[String(v)] ?? String(v)
  if (key === 'filters') return describeFilters(v) || 'なし'
  if (key === 'order_by') return keyLabel(String(v))
  if (key === 'columns') return v === '*' ? 'すべて' : String(v).split(',').map((c) => keyLabel(c.trim())).join('、')
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return plain(v)
}
