/**
 * スプレッドシート「KINDLER 営業行動管理」→ 営業ダッシュボード の仮取り込み（GASから呼ぶ）。
 * 最終的にはMCPで直接記録する運用に移るので、それまでのつなぎ。撤去時は
 * app/api/import-sales-sheet/ と このファイル と SHEET_IMPORT_TOKEN を消せばよい。
 *
 * ここはDBに触らない変換だけ（テストしやすくするため）。DB操作は route.ts 側。
 */

/** シートの案件ステージ（12段階）→ ダッシュボードの案件ステータス（app/deals/page.tsx の TOB_STATUSES） */
export const STAGE_TO_STATUS: Record<string, string> = {
  ターゲット: 'リード',
  アプローチ中: 'リード',
  有効接触: 'リード',
  商談設定: 'アポ取得',
  初回商談: '商談中',
  有望案件: '商談中',
  提案準備: '商談中',
  提案済み: '提案済',
  '稟議・最終調整': '交渉中',
  受注: '受注',
  失注: '失注',
  保留: '保留',
}

/**
 * シートの案件タイプ → ダッシュボードのサービス（deals_tob.service）。
 * ダッシュボードは「AI研修」「AI顧問」などの商材名で持っているので、そろえられるものだけそろえる。
 * 開発・複合はダッシュボードに対応する商材が無いので、更新では既存のサービスを上書きしない（新規登録のときだけ入れる）。
 */
const KIND_TO_SERVICE: Record<string, string> = { 研修: 'AI研修', AI顧問: 'AI顧問' }

/** シート「案件管理」の1行（GASが見出しを英語キーに置き換えて送る） */
export type SheetDealRow = {
  row: number // シート上の行番号（結果を書き戻す位置）
  dashboard_id?: string | null // 「ダッシュボードID」列。空なら新規登録
  company_name?: string | null
  member?: string | null // 担当（メンバー名）
  industry?: string | null
  stage?: string | null
  expected_amount_yen?: number | string | null // シートは円。ダッシュボードは万円
  win_probability?: number | string | null // 確度（%）
  next_action?: string | null
  due_date?: string | null // 期限
  last_contact_date?: string | null
  source?: string | null // 流入経路
  loss_reason?: string | null
  notes?: string | null
  deal_kind?: string | null // 案件タイプ（研修/AI顧問/開発/複合）
}

/** シート「商談履歴」の1行 */
export type SheetMeetingRow = {
  row: number
  meeting_id?: string | null // 商談ID（重複登録の判定に使う）
  dashboard_id?: string | null // 紐づく案件のダッシュボードID（GASが案件管理から引いて入れる）
  date?: string | null // 商談日
  member?: string | null
  customer?: string | null
  product?: string | null // 商材
  kind?: string | null // 商談区分
  result?: string | null // 商談結果
  rank?: string | null // 見込ランク
  bottleneck?: string | null // 最大ネック
  summary?: string | null
  next_action?: string | null
  due_date?: string | null
  slack_url?: string | null
}

const clean = (v: unknown): string | null => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** 2026/9/5・2026-09-05・Date の文字列化などを YYYY-MM-DD にする。読めなければ null */
export function toDate(v: unknown): string | null {
  const s = clean(v)
  if (!s) return null
  const m = s.match(/(\d{4})[/\-.年](\d{1,2})[/\-.月](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  // GASのDateはJSTの0時。UTCに直すと前日になるので、JSTで日付を取り出す
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** ¥1,980,000 や 1980000 を数値に。読めなければ null */
export function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = clean(v)
  if (!s) return null
  const n = Number(s.replace(/[¥￥,，円%％\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** 円 → 万円（ダッシュボードの単位）。0や空は「未確定」として null */
export function yenToMan(v: unknown): number | null {
  const yen = toNumber(v)
  if (yen === null || yen <= 0) return null
  return Math.round(yen / 10000)
}

function kindToService(kind: string | null, isNew: boolean): string | null {
  if (!kind) return null
  return KIND_TO_SERVICE[kind] ?? (isNew ? kind : null)
}

export type DealFields = Record<string, string | number | null>

/**
 * 案件1行をダッシュボードの列に変換する。
 * isNew=false（更新）のときは、シートが空欄の項目は送らない（ダッシュボードの値を消さない）。
 * メモは新規登録のときだけ入れる（ダッシュボード側で書いたメモを上書きしないため）。
 */
export function toDealFields(
  r: SheetDealRow,
  memberIdByName: Map<string, string>,
  isNew: boolean
): { fields: DealFields; error?: string } {
  const company = clean(r.company_name)
  if (!company) return { fields: {}, error: '会社名が空です' }

  const memberName = clean(r.member)
  const memberId = memberName ? memberIdByName.get(memberName) : undefined
  if (memberName && !memberId) return { fields: {}, error: `担当「${memberName}」がメンバーマスタにいません` }

  const stage = clean(r.stage)
  const status = stage ? STAGE_TO_STATUS[stage] : undefined
  if (stage && !status) return { fields: {}, error: `ステージ「${stage}」の対応先がありません` }

  const prob = toNumber(r.win_probability)
  const candidates: DealFields = {
    company_name: company,
    member_id: memberId ?? null,
    industry: clean(r.industry),
    status: status ?? null,
    expected_amount: yenToMan(r.expected_amount_yen),
    win_probability: prob && prob > 0 && prob <= 100 ? prob : null,
    next_action: clean(r.next_action),
    next_action_date: toDate(r.due_date),
    last_contact_date: toDate(r.last_contact_date),
    source: clean(r.source),
    loss_reason: clean(r.loss_reason),
    service: kindToService(clean(r.deal_kind), isNew),
  }

  const fields: DealFields = {}
  for (const [k, v] of Object.entries(candidates)) {
    if (v !== null) fields[k] = v
  }
  if (isNew) {
    const memo = clean(r.notes)
    fields.notes = [stage ? `【シートのステージ：${stage}】` : null, memo].filter(Boolean).join('\n')
  }
  return { fields }
}

/** 商談履歴の行に付ける目印。同じ商談IDを二度登録しないよう、メモの先頭に入れて検索に使う */
export const meetingMarker = (meetingId: string) => `[${meetingId}]`

/** 商談1行を、商談の活動ログ（deal_actions, 種類「商談」）のメモに整形する */
export function toMeetingNotes(r: SheetMeetingRow): string {
  const line = (label: string, v: unknown) => (clean(v) ? `${label}：${clean(v)}` : null)
  return [
    meetingMarker(String(clean(r.meeting_id))),
    [line('結果', r.result), line('区分', r.kind), line('商材', r.product), line('見込ランク', r.rank)]
      .filter(Boolean)
      .join(' ／ '),
    line('顧客', r.customer),
    line('最大ネック', r.bottleneck),
    clean(r.summary),
    clean(r.next_action) ? `次アクション：${clean(r.next_action)}${toDate(r.due_date) ? `（期限 ${toDate(r.due_date)}）` : ''}` : null,
    line('Slack', r.slack_url),
  ]
    .filter(Boolean)
    .join('\n')
}

export { clean }
