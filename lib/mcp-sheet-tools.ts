/**
 * 営業メンバー本人のGoogle権限で「KINDLER 営業行動管理」を読み書きするMCPツール。
 *
 * 対象スプレッドシートは固定し、列は列番号ではなく見出し名で解決する。
 * 書き込みは入力対象セルだけに限定し、既存の数式や他列を上書きしない。
 */
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { sheets_v4 } from 'googleapis'
import { INTEGRATIONS_URL, sheetsClientFor } from './gmail-auth'
import { isUserActor } from './mcp-oauth'
import { actorFrom } from './mf-write-audit'
import { memberNameFor } from './mcp-member'

type Extra = { authInfo?: { clientId?: string } } | undefined
type CellValue = string | number | boolean | null
type Row = CellValue[]

const SPREADSHEET_ID = '1gq7HSWpFtpbLNF4H-wemnopzl79ZTCDWIhBfXVBvN24'
const DATA_START_ROW = 3
const SETTINGS_TAB = '設定'
const AI_LOG_TAB = 'AI入力ログ'

/** 商談報告を流すSlackチャンネル（#商談報告部屋） */
const SLACK_REPORT_CHANNEL = '#商談報告部屋（チャンネルID: C0C0DQJDHFA）'

/**
 * サーバー全体への指示（MCPのinitializeでクライアントに渡る）。
 * SEAMなど他のMCPが同じ会話につながっていると、AIがSlack投稿をそちらで試して
 * 「Slackと接続されていない」と止まることがあるため、投稿経路をここで明示する。
 */
export const SHEET_INSTRUCTIONS =
  `商談報告のSlack投稿は、AIクライアント自身のSlackコネクタ（ChatGPTのSlackアプリ／ClaudeのSlackコネクタ）で${SLACK_REPORT_CHANNEL}へ行うこと。` +
  'SEAMなど他のMCPでSlackの接続確認や投稿の代行をしない。投稿で得たURLは sheet_add_meeting の slack_url に入れる。'

const DEAL_HEADERS = {
  company_name: '会社名',
  member: '担当',
  industry: '業界',
  stage: 'ステージ',
  expected_amount_yen: '見込金額',
  win_probability: '確度',
  next_action: '次アクション',
  due_date: '期限',
  last_contact_date: '最終接触日',
  source: '流入経路',
  loss_reason: '失注理由',
  notes: 'メモ',
  deal_kind: '案件タイプ',
} as const

const MEETING_HEADERS = {
  meeting_id: '商談ID',
  date: '商談日',
  member: '担当',
  customer: '顧客名 / 会社名',
  product: '商材',
  kind: '商談区分',
  result: '商談結果',
  expected_amount_yen: '見込金額',
  rank: '見込ランク',
  bottleneck: '最大ネック',
  summary: '補足・商談要約',
  next_action: '次アクション',
  due_date: '期限',
  improvement: '今回の改善点',
  slack_url: 'Slack URL',
  registered_at: '登録日時',
} as const

const ACTIVITY_HEADERS = {
  date: '日付',
  member: 'メンバー',
  new_emails: '新規メール',
  calls: '架電',
  effective_contacts: '有効接触',
  follow_ups: 'フォロー',
  meetings_set: '商談設定',
  meetings_held: '商談実施',
  proposals: '提案',
  referral_requests: '紹介依頼',
  partner_contacts: 'パートナー接触',
  orders: '受注',
  order_amount_yen: '受注金額',
  memo: 'メモ',
} as const

const MEMBER_ROMAJI: Record<string, string> = {
  門脇: 'KADOWAKI',
  白岩: 'SHIRAIWA',
  佐々木: 'SASAKI',
  宮瀬: 'MIYASE',
  稲葉: 'INABA',
  髙橋: 'TAKAHASHI',
}

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `エラー: ${message}` }], isError: true }
}

function messageOf(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  if (/invalid_grant/i.test(message)) {
    return `Googleの連携が切れています。ダッシュボードの連携ページ（${INTEGRATIONS_URL}）でGoogleの「許可する」を押してください。`
  }
  if (
    /insufficient(?:_| )?(?:permission|scope)|permission denied|does not have permission|authentication scopes|forbidden|\b403\b/i.test(
      message
    )
  ) {
    return `Googleスプレッドシートを操作できませんでした。シート「KINDLER 営業行動管理」の編集権限があるか確認し、ダッシュボードの連携ページ（${INTEGRATIONS_URL}）でGoogleの「許可する」を押し直してください。`
  }
  return message
}

function requireUser(extra: Extra): string {
  const actor = actorFrom(extra)
  if (!isUserActor(actor)) {
    throw new Error(
      'スプレッドシートツールは「Googleアカウントで接続」したときだけ使えます。今の接続は共有の接続キーのため、本人のGoogle権限を特定できません。'
    )
  }
  return actor
}

function clean(value: unknown): string {
  return String(value ?? '').trim()
}

function a1Tab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`
}

function columnName(index: number): string {
  let n = index + 1
  let result = ''
  while (n > 0) {
    const remainder = (n - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

function rowHasValue(row: Row | undefined): boolean {
  return Boolean(row?.some((value) => clean(value) !== ''))
}

function filledCount(row: Row | undefined): number {
  return (row ?? []).filter((value) => clean(value) !== '').length
}

/**
 * 見出し行。通常は2行目（設定タブは1行目）。
 * 「AI入力ログ」「AI入力設定」のように2行目も説明文（結合セル＝値は1つ）で見出しが3行目にあるタブは、
 * 先頭5行から値が3つ以上ある最初の行を見出しとみなす。
 */
function headerRowFor(tab: string, rows: Row[] = []): number {
  const fallback = tab === SETTINGS_TAB ? 1 : 2
  if (!rows.length || filledCount(rows[fallback - 1]) >= 2) return fallback
  for (let row = 1; row <= Math.min(5, rows.length); row += 1) {
    if (filledCount(rows[row - 1]) >= 3) return row
  }
  return fallback
}

function headerMap(headers: Row, tab: string, allowDuplicates = false): Map<string, number> {
  const result = new Map<string, number>()
  const occurrences = new Map<string, number>()
  headers.forEach((header, index) => {
    const name = clean(header)
    if (!name) return
    const occurrence = (occurrences.get(name) ?? 0) + 1
    occurrences.set(name, occurrence)
    if (occurrence > 1 && !allowDuplicates) {
      throw new Error(`「${tab}」タブの見出し「${name}」が重複しています`)
    }
    let resolvedName = occurrence === 1 ? name : `${name}(${occurrence})`
    while (result.has(resolvedName)) {
      const nextOccurrence = (occurrences.get(name) ?? occurrence) + 1
      occurrences.set(name, nextOccurrence)
      resolvedName = `${name}(${nextOccurrence})`
    }
    result.set(resolvedName, index)
  })
  return result
}

function requireColumn(columns: Map<string, number>, header: string, tab: string): number {
  const index = columns.get(header)
  if (index === undefined) throw new Error(`「${tab}」タブに必要な見出し「${header}」がありません`)
  return index
}

async function readTab(sheets: sheets_v4.Sheets, tab: string, render: 'FORMATTED_VALUE' | 'FORMULA' = 'FORMATTED_VALUE') {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: a1Tab(tab),
    valueRenderOption: render,
  })
  return (data.values ?? []) as Row[]
}

function tableFromRows(tab: string, rows: Row[], allowDuplicateHeaders = false) {
  const headerRow = headerRowFor(tab, rows)
  const sourceHeaders = rows[headerRow - 1] ?? []
  const columns = headerMap(sourceHeaders, tab, allowDuplicateHeaders)
  const headers = allowDuplicateHeaders
    ? sourceHeaders.map((_header, index) =>
        Array.from(columns.entries()).find(([, column]) => column === index)?.[0] ?? ''
      )
    : sourceHeaders
  return { headerRow, headers, columns, rows }
}

function firstEmptyKeyRow(rows: Row[], keyColumn: number): number {
  for (let sheetRow = DATA_START_ROW; sheetRow <= rows.length; sheetRow += 1) {
    if (clean(rows[sheetRow - 1]?.[keyColumn]) === '') return sheetRow
  }
  return Math.max(DATA_START_ROW, rows.length + 1)
}

function formatDate(value: string, field: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error(`${field}はYYYY-MM-DD形式で指定してください`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`${field}の日付が正しくありません`)
  }
  return `${match[1]}/${match[2]}/${match[3]}`
}

function todayJST(): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function nowJST(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}/${part('month')}/${part('day')} ${part('hour')}:${part('minute')}`
}

async function resolvedMember(actor: string, supplied?: string): Promise<string> {
  const member = clean(supplied) || (await memberNameFor(actor))
  if (!member) {
    throw new Error(
      '担当を指定してください（接続中のアカウントの名前から、メンバーマスタの担当者を特定できませんでした。管理者に招待管理の名前の確認を依頼してください）'
    )
  }
  return member
}

async function settingChoices(sheets: sheets_v4.Sheets) {
  const rows = await readTab(sheets, SETTINGS_TAB)
  const { columns } = tableFromRows(SETTINGS_TAB, rows)
  const readColumn = (header: string) => {
    const column = requireColumn(columns, header, SETTINGS_TAB)
    return Array.from(new Set(rows.slice(1).map((row) => clean(row[column])).filter(Boolean)))
  }
  return {
    member: readColumn('メンバー'),
    stage: readColumn('案件ステージ'),
    source: readColumn('流入経路'),
    deal_kind: readColumn('案件タイプ'),
  }
}

function validateChoice(label: string, value: string | undefined, choices: string[]): void {
  if (value === undefined) return
  if (!choices.includes(value)) {
    throw new Error(`${label}「${value}」は設定タブの候補にありません。候補: ${choices.join('、') || '（候補なし）'}`)
  }
}

type CellWrite = { column: number; value: CellValue; header: string }

async function writeCells(
  sheets: sheets_v4.Sheets,
  tab: string,
  sheetRow: number,
  writes: CellWrite[]
): Promise<void> {
  if (!writes.length) return
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: writes.map(({ column, value }) => ({
        range: `${a1Tab(tab)}!${columnName(column)}${sheetRow}`,
        values: [[value]],
      })),
    },
  })
}

async function sheetIdFor(sheets: sheets_v4.Sheets, tab: string): Promise<number> {
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties(sheetId,title)',
  })
  const id = data.sheets?.find((sheet) => sheet.properties?.title === tab)?.properties?.sheetId
  if (id === undefined || id === null) throw new Error(`「${tab}」タブが見つかりません`)
  return id
}

/** 追加行の直前行にある数式を、入力列を除いて相対参照のままコピーする。 */
async function copyPreviousFormulas(
  sheets: sheets_v4.Sheets,
  tab: string,
  sheetRow: number,
  inputColumns: Set<number>
): Promise<void> {
  if (sheetRow <= DATA_START_ROW) return
  const previousRow = sheetRow - 1
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${a1Tab(tab)}!${previousRow}:${previousRow}`,
    valueRenderOption: 'FORMULA',
  })
  const formulaColumns: number[] = []
  ;((data.values?.[0] ?? []) as CellValue[]).forEach((value, column) => {
    if (!inputColumns.has(column) && typeof value === 'string' && value.startsWith('=')) formulaColumns.push(column)
  })
  if (!formulaColumns.length) return
  const sheetId = await sheetIdFor(sheets, tab)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: formulaColumns.map((column) => ({
        copyPaste: {
          source: {
            sheetId,
            startRowIndex: previousRow - 1,
            endRowIndex: previousRow,
            startColumnIndex: column,
            endColumnIndex: column + 1,
          },
          destination: {
            sheetId,
            startRowIndex: sheetRow - 1,
            endRowIndex: sheetRow,
            startColumnIndex: column,
            endColumnIndex: column + 1,
          },
          pasteType: 'PASTE_FORMULA',
          pasteOrientation: 'NORMAL',
        },
      })),
    },
  })
}

async function insertRow(
  sheets: sheets_v4.Sheets,
  tab: string,
  sheetRow: number,
  writes: CellWrite[],
  inputColumns: Set<number>
): Promise<void> {
  await copyPreviousFormulas(sheets, tab, sheetRow, inputColumns)
  await writeCells(sheets, tab, sheetRow, writes)
}

type AiLogEntry = {
  mode: '日次営業入力' | '商談報告' | '案件更新'
  operation: '新規登録' | '更新'
  tab: string
  recordId: string
  writes: CellWrite[]
  before?: Row
  tool: string
}

/**
 * 「AI入力ログ」タブへ、書き込み1回につき1行を追記する（ChatGPT側の手入力ログと同じ列に合わせる）。
 * ログの失敗で本処理を失敗扱いにしないよう、エラーは文字列で返して呼び出し側で結果に添える。
 */
async function appendAiLog(sheets: sheets_v4.Sheets, actor: string, entry: AiLogEntry): Promise<string | null> {
  try {
    const rows = await readTab(sheets, AI_LOG_TAB)
    const { headerRow, columns } = tableFromRows(AI_LOG_TAB, rows)
    const timeColumn = requireColumn(columns, '日時', AI_LOG_TAB)
    let sheetRow = headerRow + 1
    while (clean(rows[sheetRow - 1]?.[timeColumn]) !== '') sheetRow += 1

    const now = nowJST()
    const items = entry.writes.map((w) => w.header)
    const before = entry.before
      ? entry.writes.map((w) => `${w.header}: ${clean(entry.before?.[w.column]) || '（空）'}`).join(' / ')
      : ''
    const after = entry.writes.map((w) => `${w.header}: ${clean(w.value)}`).join(' / ')
    const values: Record<string, CellValue> = {
      日時: now,
      操作者: (await memberNameFor(actor)) ?? actor,
      入力モード: entry.mode,
      操作種別: entry.operation,
      対象タブ: entry.tab,
      レコードID: entry.recordId,
      対象項目: items.join('・'),
      変更前: before,
      変更後: after,
      実行ID: `MCP-${now.replace(/\D/g, '')}-${entry.tool}`,
      備考: `kindler-sales MCP（${entry.tool}）経由で自動記録`,
    }
    const writes = Object.entries(values)
      .filter(([header]) => columns.has(header))
      .map(([header, value]) => ({ column: columns.get(header)!, value, header }))
    await writeCells(sheets, AI_LOG_TAB, sheetRow, writes)
    return null
  } catch (e) {
    return `「${AI_LOG_TAB}」タブへの記録に失敗しました: ${messageOf(e)}`
  }
}

function knownColumns<T extends Record<string, string>>(columns: Map<string, number>, headers: T): Set<number> {
  return new Set(
    Object.values(headers)
      .map((header) => columns.get(header))
      .filter((column): column is number => column !== undefined)
  )
}

function buildWrites<T extends Record<string, string>>(
  tab: string,
  columns: Map<string, number>,
  headers: T,
  values: Partial<Record<keyof T, CellValue | undefined>>
): CellWrite[] {
  const writes: CellWrite[] = []
  for (const key of Object.keys(headers) as Array<keyof T>) {
    const value = values[key]
    if (value === undefined) continue
    const header = headers[key]
    writes.push({ column: requireColumn(columns, header, tab), value, header })
  }
  return writes
}

function numberFromCell(value: unknown, row: number, header: string): number {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value
    throw new Error(`${row}行目の${header}が数値として読めません`)
  }
  const normalized = clean(value).replace(/[¥￥円,，\s]/g, '')
  if (normalized === '') return 0
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${row}行目の${header}が数値として読めません`)
  }
  return parsed
}

const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
const optionalCount = z.number().int().min(0).optional()

export function registerSheetTools(server: McpServer) {
  server.tool(
    'sheet_list_tabs',
    '固定のGoogleスプレッドシート「KINDLER 営業行動管理」を、接続中の本人のGoogle権限で確認し、全タブ名・各タブの見出し・データ行数を返す。通常タブは2行目、設定タブだけは1行目を見出しとして扱う（2行目も説明文のタブは、値が3つ以上ある最初の行を見出しとみなす）。どのタブを読むべきか判断するときに最初に使う。',
    {},
    async (_input, extra) => {
      try {
        const sheets = await sheetsClientFor(requireUser(extra))
        const { data } = await sheets.spreadsheets.get({
          spreadsheetId: SPREADSHEET_ID,
          fields: 'sheets.properties(title,index)',
        })
        const tabs = await Promise.all(
          (data.sheets ?? [])
            .slice()
            .sort((a, b) => (a.properties?.index ?? 0) - (b.properties?.index ?? 0))
            .map(async (sheet) => {
              const tab = sheet.properties?.title ?? ''
              const rows = await readTab(sheets, tab)
              const { headerRow, headers } = tableFromRows(tab, rows, true)
              return {
                tab,
                header_row: headerRow,
                headers,
                data_row_count: rows.slice(headerRow).filter(rowHasValue).length,
              }
            })
        )
        return textResult({ spreadsheet: 'KINDLER 営業行動管理', tabs })
      } catch (e) {
        return errorResult(messageOf(e))
      }
    }
  )

  server.tool(
    'sheet_read_tab',
    '固定のGoogleスプレッドシート「KINDLER 営業行動管理」の指定タブを、接続中の本人のGoogle権限で読み取る。通常は2行目（設定タブは1行目、AI入力ログのように2行目も説明文のタブは3行目）の見出しをキーにしたオブジェクトと実際のシート行番号を返す。filterは「列名: 部分一致文字列」をAND条件で適用する。空行は除外する。見出しが空の説明用タブは、表示値の2次元配列として返す。',
    {
      tab: z.string().trim().min(1).describe('読み取るタブ名。sheet_list_tabsで確認できる'),
      offset: z.number().int().min(0).optional().describe('条件に一致した行のうち読み飛ばす件数。既定0'),
      limit: z.number().int().min(1).max(200).optional().describe('返す最大件数。既定50、最大200'),
      filter: z.record(z.string()).optional().describe('列名をキー、部分一致させる文字列を値にしたAND条件'),
    },
    async ({ tab, offset = 0, limit = 50, filter }, extra) => {
      try {
        const sheets = await sheetsClientFor(requireUser(extra))
        const rows = await readTab(sheets, tab)
        const { headerRow, headers, columns } = tableFromRows(tab, rows, true)
        if (!rowHasValue(headers)) {
          const visibleRows = rows.filter(rowHasValue)
          return textResult({
            tab,
            format: 'display_values',
            offset,
            limit,
            total: visibleRows.length,
            values: visibleRows.slice(offset, offset + limit),
          })
        }
        for (const name of Object.keys(filter ?? {})) requireColumn(columns, name, tab)
        const allRows = rows
          .slice(headerRow)
          .map((row, index) => ({ row, sheet_row: headerRow + index + 1 }))
          .filter(({ row }) => rowHasValue(row))
          .filter(({ row }) =>
            Object.entries(filter ?? {}).every(([name, needle]) =>
              clean(row[requireColumn(columns, name, tab)]).includes(needle)
            )
          )
          .map(({ row, sheet_row }) => ({
            sheet_row,
            ...Object.fromEntries(headers.map((header, index) => [clean(header), row[index] ?? '']).filter(([key]) => key)),
          }))
        return textResult({
          tab,
          offset,
          limit,
          total: allRows.length,
          rows: allRows.slice(offset, offset + limit),
        })
      } catch (e) {
        return errorResult(messageOf(e))
      }
    }
  )

  server.tool(
    'sheet_upsert_deal',
    '「案件管理」タブで会社名の完全一致（前後空白は無視）により案件を検索し、作成または更新する。autoは既存なら更新、なければ作成する。updateでは指定された項目だけを書き、メモは既存内容の末尾へ日付付きで追記する。加重金額・アクティブ・停滞日数・ダッシュボードIDには書き込まない。担当・ステージ・流入経路・案件タイプは設定タブの候補だけを受け付ける。',
    {
      company_name: z.string().trim().min(1).describe('会社名。前後空白を除いた完全一致で既存案件を探す'),
      member: z.string().optional().describe('担当。省略時は新規作成に限り接続中の本人名を使う'),
      industry: z.string().optional().describe('業界'),
      stage: z.string().optional().describe('案件ステージ。設定タブの「案件ステージ」列の候補を指定する'),
      expected_amount_yen: z.number().min(0).optional().describe('見込金額（円）'),
      win_probability: z.number().min(0).max(100).optional().describe('受注確度。0〜100の数値'),
      next_action: z.string().optional().describe('次のアクション'),
      due_date: optionalDate.describe('期限。YYYY-MM-DD形式'),
      last_contact_date: optionalDate.describe('最終接触日。YYYY-MM-DD形式'),
      source: z.string().optional().describe('流入経路。設定タブの候補を指定する'),
      loss_reason: z.string().optional().describe('失注理由'),
      notes: z.string().optional().describe('メモ。更新時は既存メモを消さず、日付付きで末尾に追記する'),
      deal_kind: z.string().optional().describe('案件タイプ。設定タブの候補を指定する'),
      mode: z.enum(['auto', 'create', 'update']).optional().describe('auto（既定）・create・update'),
    },
    async (input, extra) => {
      try {
        const actor = requireUser(extra)
        const sheets = await sheetsClientFor(actor)
        const tab = '案件管理'
        const rows = await readTab(sheets, tab)
        const { columns } = tableFromRows(tab, rows)
        const companyColumn = requireColumn(columns, DEAL_HEADERS.company_name, tab)
        const matches = rows
          .slice(DATA_START_ROW - 1)
          .map((row, index) => ({ row, sheetRow: DATA_START_ROW + index }))
          .filter(({ row }) => clean(row[companyColumn]) === clean(input.company_name))
        if (matches.length > 1) {
          throw new Error(`会社名「${clean(input.company_name)}」が複数行にあります（${matches.map((m) => m.sheetRow).join('、')}行目）`)
        }
        const mode = input.mode ?? 'auto'
        const existing = matches[0]
        if (mode === 'create' && existing) throw new Error(`同じ会社名の案件が${existing.sheetRow}行目にあります`)
        if (mode === 'update' && !existing) throw new Error(`会社名「${clean(input.company_name)}」の案件が見つかりません`)
        const creating = !existing
        const member = input.member !== undefined || creating ? await resolvedMember(actor, input.member) : undefined
        const choices = await settingChoices(sheets)
        validateChoice('担当', member, choices.member)
        validateChoice('ステージ', input.stage, choices.stage)
        validateChoice('流入経路', input.source, choices.source)
        validateChoice('案件タイプ', input.deal_kind, choices.deal_kind)

        let notes = input.notes
        if (!creating && notes !== undefined) {
          const notesColumn = requireColumn(columns, DEAL_HEADERS.notes, tab)
          const current = clean(existing.row[notesColumn])
          const addition = `【${todayJST()} 追記】${notes}`
          notes = current ? `${current}\n${addition}` : addition
        }
        const values = {
          company_name: creating ? clean(input.company_name) : undefined,
          member,
          industry: input.industry,
          stage: input.stage,
          expected_amount_yen: input.expected_amount_yen,
          win_probability: input.win_probability,
          next_action: input.next_action,
          due_date: input.due_date ? formatDate(input.due_date, 'due_date') : undefined,
          last_contact_date: input.last_contact_date
            ? formatDate(input.last_contact_date, 'last_contact_date')
            : undefined,
          source: input.source,
          loss_reason: input.loss_reason,
          notes,
          deal_kind: input.deal_kind,
        }
        const writes = buildWrites(tab, columns, DEAL_HEADERS, values)
        const sheetRow = existing?.sheetRow ?? firstEmptyKeyRow(rows, companyColumn)
        if (creating) await insertRow(sheets, tab, sheetRow, writes, knownColumns(columns, DEAL_HEADERS))
        else await writeCells(sheets, tab, sheetRow, writes)
        const logError = await appendAiLog(sheets, actor, {
          mode: '案件更新',
          operation: creating ? '新規登録' : '更新',
          tab,
          recordId: clean(input.company_name),
          writes,
          before: existing?.row,
          tool: 'sheet_upsert_deal',
        })
        return textResult({
          row: sheetRow,
          action: creating ? 'created' : 'updated',
          written_columns: writes.map((write) => write.header),
          ...(logError ? { log_warning: logError } : {}),
        })
      } catch (e) {
        return errorResult(messageOf(e))
      }
    }
  )

  server.tool(
    'sheet_add_meeting',
    '「商談履歴」タブに商談を1件追加する。商談IDは担当者・商談日ごとの既存最大連番から自動採番し、登録日時は現在の日本時間で記録する。担当は設定タブの候補だけを受け付け、省略時は接続中の本人名を使う。customerは案件管理の会社名で始めると、ダッシュボード連携で案件に紐づく（例: 「株式会社サンプル 田中様」）。',
    {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('商談日。YYYY-MM-DD形式'),
      customer: z.string().trim().min(1).describe('顧客名 / 会社名。案件管理の会社名で始めると案件に紐づく'),
      member: z.string().optional().describe('担当。省略時は接続中の本人名'),
      product: z.string().optional().describe('商材'),
      kind: z.string().optional().describe('商談区分'),
      result: z.string().optional().describe('商談結果'),
      expected_amount_yen: z.number().min(0).optional().describe('見込金額（円）'),
      rank: z.string().optional().describe('見込ランク'),
      bottleneck: z.string().optional().describe('最大ネック'),
      summary: z.string().trim().min(1).describe('補足・商談要約'),
      next_action: z.string().optional().describe('次のアクション'),
      due_date: optionalDate.describe('期限。YYYY-MM-DD形式'),
      improvement: z.string().optional().describe('今回の改善点'),
      slack_url: z
        .string()
        .url()
        .optional()
        .describe(`商談報告のSlack投稿URL。AIクライアント自身のSlackコネクタで${SLACK_REPORT_CHANNEL}へ投稿して得たURLを入れる（SEAMなど他のMCP経由で投稿しない）`),
    },
    async (input, extra) => {
      try {
        const actor = requireUser(extra)
        const sheets = await sheetsClientFor(actor)
        const tab = '商談履歴'
        const rows = await readTab(sheets, tab)
        const { columns } = tableFromRows(tab, rows)
        const idColumn = requireColumn(columns, MEETING_HEADERS.meeting_id, tab)
        const member = await resolvedMember(actor, input.member)
        const choices = await settingChoices(sheets)
        validateChoice('担当', member, choices.member)
        const roman = MEMBER_ROMAJI[member]
        if (!roman) {
          throw new Error(`担当「${member}」の商談ID用ローマ字が未登録です。登録済み: ${Object.keys(MEMBER_ROMAJI).join('、')}`)
        }
        const sheetDate = formatDate(input.date, 'date')
        const prefix = `${roman}-${input.date.replace(/-/g, '')}-`
        let maxSequence = 0
        for (const row of rows.slice(DATA_START_ROW - 1)) {
          const id = clean(row[idColumn])
          if (!id.startsWith(prefix)) continue
          const suffix = id.slice(prefix.length)
          if (/^\d{3}$/.test(suffix)) maxSequence = Math.max(maxSequence, Number(suffix))
        }
        const meetingId = `${prefix}${String(maxSequence + 1).padStart(3, '0')}`
        const values = {
          meeting_id: meetingId,
          date: sheetDate,
          member,
          customer: clean(input.customer),
          product: input.product,
          kind: input.kind,
          result: input.result,
          expected_amount_yen: input.expected_amount_yen,
          rank: input.rank,
          bottleneck: input.bottleneck,
          summary: input.summary,
          next_action: input.next_action,
          due_date: input.due_date ? formatDate(input.due_date, 'due_date') : undefined,
          improvement: input.improvement,
          slack_url: input.slack_url,
          registered_at: nowJST(),
        }
        const writes = buildWrites(tab, columns, MEETING_HEADERS, values)
        const sheetRow = firstEmptyKeyRow(rows, idColumn)
        await insertRow(sheets, tab, sheetRow, writes, knownColumns(columns, MEETING_HEADERS))
        const logError = await appendAiLog(sheets, actor, {
          mode: '商談報告',
          operation: '新規登録',
          tab,
          recordId: meetingId,
          writes,
          tool: 'sheet_add_meeting',
        })
        return textResult({ meeting_id: meetingId, row: sheetRow, ...(logError ? { log_warning: logError } : {}) })
      } catch (e) {
        return errorResult(messageOf(e))
      }
    }
  )

  server.tool(
    'sheet_add_activity',
    '「行動実績」タブへ、担当者1人・1日分の営業行動を記録する。同じ日付と担当の通常行があれば、addは指定した数値を既存値へ加算し、replaceは指定項目だけを置き換える。メモは既存メモの末尾へ「／」で追記する。「【自動連携】」で始まるメモの行は更新せず、別の新しい行を追加する。担当は設定タブの候補だけを受け付け、省略時は接続中の本人名を使う。',
    {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('対象日。YYYY-MM-DD形式'),
      member: z.string().optional().describe('担当。省略時は接続中の本人名'),
      new_emails: optionalCount.describe('新規メール件数'),
      calls: optionalCount.describe('架電件数'),
      effective_contacts: optionalCount.describe('有効接触件数'),
      follow_ups: optionalCount.describe('フォロー件数'),
      meetings_set: optionalCount.describe('商談設定件数'),
      meetings_held: optionalCount.describe('商談実施件数'),
      proposals: optionalCount.describe('提案件数'),
      referral_requests: optionalCount.describe('紹介依頼件数'),
      partner_contacts: optionalCount.describe('パートナー接触件数'),
      orders: optionalCount.describe('受注件数'),
      order_amount_yen: z.number().min(0).optional().describe('受注金額（円）'),
      memo: z.string().optional().describe('メモ。既存行の更新時は「／」でつないで追記する'),
      mode: z.enum(['add', 'replace']).optional().describe('add（既定）またはreplace'),
    },
    async (input, extra) => {
      try {
        const actor = requireUser(extra)
        const sheets = await sheetsClientFor(actor)
        const tab = '行動実績'
        const rows = await readTab(sheets, tab)
        const { columns } = tableFromRows(tab, rows)
        const dateColumn = requireColumn(columns, ACTIVITY_HEADERS.date, tab)
        const memberColumn = requireColumn(columns, ACTIVITY_HEADERS.member, tab)
        const memoColumn = requireColumn(columns, ACTIVITY_HEADERS.memo, tab)
        const member = await resolvedMember(actor, input.member)
        const choices = await settingChoices(sheets)
        validateChoice('担当', member, choices.member)
        const sheetDate = formatDate(input.date, 'date')
        const matches = rows
          .slice(DATA_START_ROW - 1)
          .map((row, index) => ({ row, sheetRow: DATA_START_ROW + index }))
          .filter(
            ({ row }) =>
              clean(row[dateColumn]) === sheetDate &&
              clean(row[memberColumn]) === member &&
              !clean(row[memoColumn]).startsWith('【自動連携】')
          )
        if (matches.length > 1) {
          throw new Error(`同じ日付・担当の更新可能な行が複数あります（${matches.map((m) => m.sheetRow).join('、')}行目）`)
        }
        const existing = matches[0]
        const mode = input.mode ?? 'add'
        const numericKeys = [
          'new_emails',
          'calls',
          'effective_contacts',
          'follow_ups',
          'meetings_set',
          'meetings_held',
          'proposals',
          'referral_requests',
          'partner_contacts',
          'orders',
          'order_amount_yen',
        ] as const
        const values: Partial<Record<keyof typeof ACTIVITY_HEADERS, CellValue | undefined>> = {
          date: existing ? undefined : sheetDate,
          member: existing ? undefined : member,
        }
        for (const key of numericKeys) {
          const supplied = input[key]
          if (supplied === undefined) continue
          const column = requireColumn(columns, ACTIVITY_HEADERS[key], tab)
          values[key] = existing && mode === 'add'
            ? numberFromCell(existing.row[column], existing.sheetRow, ACTIVITY_HEADERS[key]) + supplied
            : supplied
        }
        if (input.memo !== undefined) {
          const current = existing ? clean(existing.row[memoColumn]) : ''
          values.memo = current ? `${current}／${input.memo}` : input.memo
        }
        const writes = buildWrites(tab, columns, ACTIVITY_HEADERS, values)
        const sheetRow = existing?.sheetRow ?? firstEmptyKeyRow(rows, dateColumn)
        if (existing) await writeCells(sheets, tab, sheetRow, writes)
        else await insertRow(sheets, tab, sheetRow, writes, knownColumns(columns, ACTIVITY_HEADERS))
        const logError = await appendAiLog(sheets, actor, {
          mode: '日次営業入力',
          operation: existing ? '更新' : '新規登録',
          tab,
          recordId: `${sheetDate}-${member}`,
          writes,
          before: existing?.row,
          tool: 'sheet_add_activity',
        })
        return textResult({
          row: sheetRow,
          action: existing ? 'updated' : 'created',
          mode,
          written_columns: writes.map((write) => write.header),
          ...(logError ? { log_warning: logError } : {}),
        })
      } catch (e) {
        return errorResult(messageOf(e))
      }
    }
  )
}
