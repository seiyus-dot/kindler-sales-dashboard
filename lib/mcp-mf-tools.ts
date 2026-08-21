/**
 * MCPツール：マネーフォワード クラウド請求書（入金予測）
 *
 * Supabaseテーブル操作系（lib/mcp-tools.ts）とは別系統。こちらはMF APIを直接叩いて
 * 「いつ・いくら入ってくるか」を返す参照専用ツール群。MFへの書き込みは一切行わない。
 */
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  BILLING_RANGE_KEYS,
  buildMonthlyForecast,
  fetchBillings,
  filterBillings,
  overdueDays,
  shiftMonthsJST,
  todayJST,
  type Billing,
} from './mf-billings'

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `エラー: ${message}` }], isError: true }
}

/** 一覧系レスポンスの1行。トークン節約のため必要な列だけに絞る。 */
function row(b: Billing, today: string) {
  const days = b.is_paid ? null : overdueDays(b.due_date, today)
  return {
    id: b.id,
    due_date: b.due_date,
    partner_name: b.partner_name,
    title: b.title,
    total: b.total,
    payment_status: b.payment_status,
    overdue_days: days !== null && days > 0 ? days : undefined,
  }
}

const STATUS_NOTE =
  'なお現状MF側で入金消込が運用されておらず、ほぼ全件のpayment_statusが「未設定」のため、' +
  '「未入金」は実際の滞留ではなくステータス未設定を意味する場合がある。金額を断定的に語らないこと。'

export function registerMfBillingTools(server: McpServer) {
  server.tool(
    'mf_payment_forecast',
    'マネーフォワード クラウド請求書をもとに、月別の入金予測（キャッシュイン）を返す。' +
      '支払期日(due_date)を軸に未入金の請求書を集計する。自社宛(KINDLER)と除外指定分は除いてある。' +
      '「今月の入金予定は？」「来月いくら入る？」「資金繰り」といった質問にはまずこれを使う。' +
      STATUS_NOTE,
    {
      months_back: z
        .number()
        .int()
        .min(0)
        .max(36)
        .optional()
        .describe('何ヶ月前まで遡るか。既定12。期日超過分を見たいときに効く'),
      months_ahead: z
        .number()
        .int()
        .min(0)
        .max(36)
        .optional()
        .describe('何ヶ月先まで見るか。既定12'),
    },
    async ({ months_back, months_ahead }) => {
      try {
        const today = todayJST()
        const billings = await fetchBillings({
          from: shiftMonthsJST(-(months_back ?? 12)),
          to: shiftMonthsJST(months_ahead ?? 12),
          rangeKey: 'due_date',
        })
        const open = billings.filter((b) => !b.is_paid)
        const upcoming = open.filter((b) => b.due_date && b.due_date >= today)
        const overdue = open.filter((b) => b.due_date && b.due_date < today)

        return textResult({
          as_of: today,
          unit: '円（税込）',
          monthly: buildMonthlyForecast(billings, today),
          summary: {
            未入金件数: open.length,
            未入金合計: open.reduce((s, b) => s + b.total, 0),
            今後の入金予定件数: upcoming.length,
            今後の入金予定合計: upcoming.reduce((s, b) => s + b.total, 0),
            期日超過件数: overdue.length,
            期日超過合計: overdue.reduce((s, b) => s + b.total, 0),
          },
          note: STATUS_NOTE,
        })
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )

  server.tool(
    'mf_upcoming_payments',
    '支払期日がこれから到来する請求書（＝今後の入金予定）を明細で返す。' +
      '特定の月の入金予定を聞かれたらmonthを指定する。' +
      STATUS_NOTE,
    {
      month: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .optional()
        .describe('YYYY-MM。指定するとその月に支払期日が来る分だけ返す'),
      months_ahead: z.number().int().min(0).max(36).optional().describe('monthを指定しない場合、何ヶ月先まで見るか。既定3'),
      limit: z.number().int().min(1).max(200).optional().describe('返す最大件数。既定100'),
    },
    async ({ month, months_ahead, limit }) => {
      try {
        const today = todayJST()
        const from = month ? `${month}-01` : today
        const to = month ? `${month}-31` : shiftMonthsJST(months_ahead ?? 3)

        const billings = await fetchBillings({ from, to, rangeKey: 'due_date' })
        const rows = billings
          .filter((b) => !b.is_paid)
          // month指定なしのときは未到来分だけ（期日超過はmf_overdue_billingsの担当）
          .filter((b) => (month ? true : b.due_date && b.due_date >= today))
          .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '') || b.total - a.total)

        return textResult({
          as_of: today,
          range: { from, to },
          unit: '円（税込）',
          count: rows.length,
          total: rows.reduce((s, b) => s + b.total, 0),
          billings: rows.slice(0, limit ?? 100).map((b) => row(b, today)),
          note: STATUS_NOTE,
        })
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )

  server.tool(
    'mf_overdue_billings',
    '支払期日を過ぎているのに入金済みになっていない請求書を、経過日数つきで返す。' +
      STATUS_NOTE,
    {
      min_overdue_days: z.number().int().min(0).optional().describe('この日数以上超過しているものだけ返す。既定0'),
      months_back: z.number().int().min(1).max(36).optional().describe('何ヶ月前まで遡るか。既定12'),
      limit: z.number().int().min(1).max(200).optional().describe('返す最大件数。既定100'),
    },
    async ({ min_overdue_days, months_back, limit }) => {
      try {
        const today = todayJST()
        const billings = await fetchBillings({
          from: shiftMonthsJST(-(months_back ?? 12)),
          to: today,
          rangeKey: 'due_date',
        })
        const threshold = min_overdue_days ?? 0
        const rows = billings
          .filter((b) => !b.is_paid)
          .filter((b) => {
            const d = overdueDays(b.due_date, today)
            return d !== null && d > 0 && d >= threshold
          })
          .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))

        return textResult({
          as_of: today,
          unit: '円（税込）',
          count: rows.length,
          total: rows.reduce((s, b) => s + b.total, 0),
          billings: rows.slice(0, limit ?? 100).map((b) => row(b, today)),
          note: STATUS_NOTE,
        })
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )

  server.tool(
    'mf_partner_receivables',
    '取引先ごとの未入金残高を多い順に返す。「どこからの入金が一番大きい？」「未回収が多い先は？」に使う。' +
      STATUS_NOTE,
    {
      months_back: z.number().int().min(1).max(36).optional().describe('何ヶ月前まで遡るか。既定12'),
      months_ahead: z.number().int().min(0).max(36).optional().describe('何ヶ月先まで見るか。既定12'),
      limit: z.number().int().min(1).max(100).optional().describe('返す最大取引先数。既定20'),
    },
    async ({ months_back, months_ahead, limit }) => {
      try {
        const today = todayJST()
        const billings = await fetchBillings({
          from: shiftMonthsJST(-(months_back ?? 12)),
          to: shiftMonthsJST(months_ahead ?? 12),
          rangeKey: 'due_date',
        })
        const map = new Map<string, { partner_name: string; count: number; total: number; overdue_total: number; oldest_due_date: string | null }>()
        for (const b of billings) {
          if (b.is_paid) continue
          const cur = map.get(b.partner_name) ?? {
            partner_name: b.partner_name,
            count: 0,
            total: 0,
            overdue_total: 0,
            oldest_due_date: null,
          }
          cur.count += 1
          cur.total += b.total
          if (b.due_date && b.due_date < today) {
            cur.overdue_total += b.total
            if (!cur.oldest_due_date || b.due_date < cur.oldest_due_date) cur.oldest_due_date = b.due_date
          }
          map.set(b.partner_name, cur)
        }
        const rows = [...map.values()].sort((a, b) => b.total - a.total)

        return textResult({
          as_of: today,
          unit: '円（税込）',
          partner_count: rows.length,
          total: rows.reduce((s, r) => s + r.total, 0),
          partners: rows.slice(0, limit ?? 20),
          note: STATUS_NOTE,
        })
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )

  server.tool(
    'mf_search_billings',
    '請求書を条件で検索して明細を返す。取引先名や件名でのフリーワード検索、期間軸の切り替えができる。' +
      '入金予測ではなく「あの請求書どうなってる？」を調べたいときに使う。' +
      STATUS_NOTE,
    {
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('期間の開始日 YYYY-MM-DD'),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('期間の終了日 YYYY-MM-DD'),
      range_key: z
        .enum(BILLING_RANGE_KEYS)
        .optional()
        .describe('期間をどの日付で絞るか。既定due_date（支払期日）。売上計上ベースならsales_date'),
      keyword: z
        .string()
        .optional()
        .describe('取引先名または件名の部分一致（大文字小文字は無視）。例: "Dressmore" "AI顧問"'),
      unpaid_only: z.boolean().optional().describe('trueなら未入金のみ。既定false'),
      include_excluded: z.boolean().optional().describe('trueなら自社宛・除外指定分も含める。既定false'),
      limit: z.number().int().min(1).max(200).optional().describe('返す最大件数。既定50'),
    },
    async ({ from, to, range_key, keyword, unpaid_only, include_excluded, limit }) => {
      try {
        const today = todayJST()
        const billings = await fetchBillings({
          from,
          to,
          rangeKey: range_key ?? 'due_date',
          includeExcluded: include_excluded ?? false,
        })
        const rows = filterBillings(billings, keyword)
          .filter((b) => (unpaid_only ? !b.is_paid : true))
          .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))

        return textResult({
          as_of: today,
          range: { from, to, range_key: range_key ?? 'due_date', keyword: keyword ?? null },
          unit: '円（税込）',
          count: rows.length,
          total: rows.reduce((s, b) => s + b.total, 0),
          billings: rows.slice(0, limit ?? 50).map((b) => row(b, today)),
          note: STATUS_NOTE,
        })
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )
}
