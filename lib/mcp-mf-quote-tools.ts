/**
 * MCPツール：マネーフォワード クラウド請求書の見積書（下書き作成・更新・削除・請求書化）
 *
 * 送付（郵送/メール）・受注ステータス更新は含めない。あくまで下書き段階の操作に限定する。
 * 検索・確認は常時有効、作成・更新・削除・請求書変換は環境変数 MCP_ALLOW_MF_WRITE=true のときのみ有効。
 */
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { fetchPartnerById } from './mf-partners'
import { exciseForTaxRate, extractPdfUrl } from './mf-invoice'
import {
  fetchQuotes,
  filterQuotes,
  fetchQuoteById,
  fetchRawQuote,
  createQuoteDraft,
  updateQuoteRaw,
  deleteQuoteDraft,
  convertQuoteToBilling,
} from './mf-quotes'
import { actorFrom, logMfWrite } from './mf-write-audit'

const DATE = /^\d{4}-\d{2}-\d{2}$/

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `エラー: ${message}` }], isError: true }
}

function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function shiftMonthsJST(months: number): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

const itemShape = z
  .array(
    z.object({
      name: z.string().min(1).describe('品目名'),
      quantity: z.number().positive().describe('数量'),
      unit_price: z.number().nonnegative().describe('税抜単価（円）'),
      unit: z.string().optional().describe('単位。省略時「式」'),
      tax_rate: z.number().optional().describe('消費税率（%）。10/8/0に対応。省略時10'),
    })
  )
  .min(1)

export function registerMfQuoteTools(server: McpServer, opts: { allowWrite: boolean }) {
  server.tool(
    'mf_search_quotes',
    '見積書を条件で検索して明細を返す。取引先名や件名でのフリーワード検索、期間軸の切り替えができる。',
    {
      from: z.string().regex(DATE).optional().describe('期間の開始日 YYYY-MM-DD。省略時は12ヶ月前'),
      to: z.string().regex(DATE).optional().describe('期間の終了日 YYYY-MM-DD。省略時は今日'),
      range_key: z
        .enum(['quote_date', 'expired_date', 'created_at', 'updated_at'])
        .optional()
        .describe('期間をどの日付で絞るか。既定quote_date'),
      keyword: z.string().optional().describe('取引先名または件名の部分一致'),
      limit: z.number().int().min(1).max(200).optional().describe('返す最大件数。既定50'),
    },
    async ({ from, to, range_key, keyword, limit }) => {
      try {
        const quotes = await fetchQuotes({
          from: from ?? shiftMonthsJST(-12),
          to: to ?? todayJST(),
          rangeKey: range_key,
        })
        const rows = filterQuotes(quotes, keyword)
        return textResult({
          range: { from: from ?? shiftMonthsJST(-12), to: to ?? todayJST(), range_key: range_key ?? 'quote_date' },
          count: rows.length,
          quotes: rows.slice(0, limit ?? 50),
        })
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )

  server.tool(
    'mf_get_quote',
    'IDを指定して見積書1件の明細・金額・受注/送付状況を確認する。',
    { quote_id: z.string().describe('見積書ID') },
    async ({ quote_id }) => {
      try {
        const detail = await fetchQuoteById(quote_id)
        if (!detail) return errorResult(`見積書 ${quote_id} が見つかりません`)
        return textResult(detail)
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )

  server.tool(
    'mf_create_quote_draft',
    'マネーフォワードに自由明細の見積書を「下書き」として新規作成する。送付は一切行わない。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      partner_id: z.string().describe('mf_search_partnersで取得したpartner_id'),
      title: z.string().min(1).describe('見積書の件名'),
      quote_date: z.string().regex(DATE).optional().describe('見積日 YYYY-MM-DD。省略時は今日'),
      expired_date: z.string().regex(DATE).describe('有効期限 YYYY-MM-DD'),
      memo: z.string().optional().describe('備考'),
      items: itemShape.describe('見積明細。1件以上必須'),
    },
    async ({ partner_id, title, quote_date, expired_date, memo, items }, extra) => {
      if (!opts.allowWrite) {
        return errorResult('見積書の作成はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）')
      }
      const actor = actorFrom(extra)
      try {
        const partner = await fetchPartnerById(partner_id)
        if (!partner) return errorResult(`取引先 ${partner_id} が見つかりません。mf_search_partnersで確認してください`)

        const res = await createQuoteDraft({
          partnerDepartmentId: partner.department_id,
          title,
          quoteDate: quote_date ?? todayJST(),
          expiredDate: expired_date,
          memo,
          items: items.map((it) => ({
            name: it.name,
            quantity: it.quantity,
            unit: it.unit?.trim() || '式',
            unitPrice: it.unit_price,
            taxRate: it.tax_rate,
          })),
        })
        const detail = await fetchQuoteById(res.id).catch(() => null)
        void logMfWrite({
          tool: 'mf_create_quote_draft',
          action: 'create',
          actor,
          targetType: 'quote',
          targetId: res.id,
          success: true,
          summary: { partner_id, title },
        })
        return textResult({
          created: true,
          quote_id: res.id,
          partner_id: partner.id,
          partner_name: partner.name,
          pdf_url: extractPdfUrl(res),
          note: '下書きとして作成されました。送付は行っていません。',
          detail,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_create_quote_draft',
          action: 'create',
          actor,
          targetType: 'quote',
          success: false,
          error: message,
          summary: { partner_id, title },
        })
        return errorResult(message)
      }
    }
  )

  server.tool(
    'mf_update_quote_draft',
    '作成済みの見積書（下書き）の件名・有効期限・備考・明細を後から修正する。省略した項目は現在の値を維持する。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      quote_id: z.string().describe('更新対象の見積書ID'),
      title: z.string().min(1).optional(),
      quote_date: z.string().regex(DATE).optional(),
      expired_date: z.string().regex(DATE).optional(),
      memo: z.string().optional(),
      items: itemShape.optional().describe('明細を丸ごと置き換える。省略時は現状の明細を維持'),
    },
    async ({ quote_id, title, quote_date, expired_date, memo, items }, extra) => {
      if (!opts.allowWrite) {
        return errorResult('見積書の更新はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）')
      }
      const actor = actorFrom(extra)
      try {
        const raw = await fetchRawQuote(quote_id)
        if (!raw) return errorResult(`見積書 ${quote_id} が見つかりません`)

        const normDate = (v: unknown): string | undefined =>
          typeof v === 'string' && v.length > 0 ? v.replaceAll('/', '-').slice(0, 10) : undefined

        const body: Record<string, unknown> = {
          title: title ?? raw.title,
          quote_date: quote_date ?? normDate(raw.quote_date),
          expired_date: expired_date ?? normDate(raw.expired_date),
          memo: memo ?? raw.memo,
          items: items
            ? items.map((it) => ({
                name: it.name,
                quantity: it.quantity,
                unit: it.unit?.trim() || '式',
                price: it.unit_price,
                excise: exciseForTaxRate(it.tax_rate),
              }))
            : raw.items,
        }

        const res = await updateQuoteRaw(quote_id, body)
        const detail = await fetchQuoteById(quote_id).catch(() => null)
        void logMfWrite({
          tool: 'mf_update_quote_draft',
          action: 'update',
          actor,
          targetType: 'quote',
          targetId: quote_id,
          success: true,
          summary: { title: title ?? undefined, items_replaced: Boolean(items) },
        })
        return textResult({
          updated: true,
          quote_id,
          pdf_url: extractPdfUrl(res),
          detail,
          note: 'memoなど本ツールが読み取れなかったフィールドは意図せず変わっている可能性があるため、mf_get_quoteで確認してください。',
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_update_quote_draft',
          action: 'update',
          actor,
          targetType: 'quote',
          targetId: quote_id,
          success: false,
          error: message,
        })
        return errorResult(message)
      }
    }
  )

  server.tool(
    'mf_delete_quote_draft',
    '作り間違えた見積書の下書きを削除する。削除は取り消せないため、confirmを付けずに呼ぶとプレビューのみ返す。' +
      'プレビューを利用者に見せて許可を得てから、confirm: trueを付けて同じ内容でもう一度呼ぶこと。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      quote_id: z.string().describe('削除対象の見積書ID'),
      confirm: z.boolean().optional().describe('trueにすると実際に削除する。省略/falseの場合はプレビューのみ'),
    },
    async ({ quote_id, confirm }, extra) => {
      if (!opts.allowWrite) {
        return errorResult('見積書の削除はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）')
      }
      const actor = actorFrom(extra)
      try {
        const detail = await fetchQuoteById(quote_id)
        if (!detail) return errorResult(`見積書 ${quote_id} が見つかりません`)

        if (!confirm) {
          return textResult({
            pending: true,
            quote_id,
            preview: detail,
            hint: 'この内容を利用者に見せて削除の許可を得たうえで、confirm: true を付けて同じ内容でもう一度呼び出してください。',
          })
        }
        await deleteQuoteDraft(quote_id)
        void logMfWrite({
          tool: 'mf_delete_quote_draft',
          action: 'delete',
          actor,
          targetType: 'quote',
          targetId: quote_id,
          success: true,
          summary: { title: detail.title, partner_name: detail.partner_name },
        })
        return textResult({ deleted: true, quote_id })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_delete_quote_draft',
          action: 'delete',
          actor,
          targetType: 'quote',
          targetId: quote_id,
          success: false,
          error: message,
        })
        return errorResult(message)
      }
    }
  )

  server.tool(
    'mf_convert_quote_to_billing',
    '見積書を請求書（下書き）に変換する。承諾済みの見積を請求書として起票する用途。送付は行わない。' +
      'confirmを付けずに呼ぶと、変換対象の見積内容のプレビューのみ返す。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      quote_id: z.string().describe('変換対象の見積書ID'),
      confirm: z.boolean().optional().describe('trueにすると実際に変換を実行する。省略/falseの場合はプレビューのみ'),
    },
    async ({ quote_id, confirm }, extra) => {
      if (!opts.allowWrite) {
        return errorResult('見積書の請求書化はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）')
      }
      const actor = actorFrom(extra)
      try {
        const detail = await fetchQuoteById(quote_id)
        if (!detail) return errorResult(`見積書 ${quote_id} が見つかりません`)

        if (!confirm) {
          return textResult({
            pending: true,
            quote_id,
            quote_order_status: detail.order_status,
            preview: detail,
            hint:
              'order_statusが受注済みであることを確認し、利用者に見せて許可を得たうえで、' +
              'confirm: true を付けて同じ内容でもう一度呼び出してください。',
          })
        }

        const res = await convertQuoteToBilling(quote_id)
        void logMfWrite({
          tool: 'mf_convert_quote_to_billing',
          action: 'convert_to_billing',
          actor,
          targetType: 'quote',
          targetId: quote_id,
          success: true,
          summary: { billing_id: res.id, title: detail.title },
        })
        return textResult({
          converted: true,
          quote_id,
          billing_id: res.id,
          pdf_url: extractPdfUrl(res),
          note: '請求書は下書きとして作成されました。送付は行っていません。mf_get_billingで内容を確認してください。',
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_convert_quote_to_billing',
          action: 'convert_to_billing',
          actor,
          targetType: 'quote',
          targetId: quote_id,
          success: false,
          error: message,
        })
        return errorResult(message)
      }
    }
  )
}
