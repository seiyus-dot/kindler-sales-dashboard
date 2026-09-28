/**
 * MCPツール：マネーフォワード クラウド請求書（下書き作成・更新まわり）
 *
 * lib/mcp-mf-tools.ts（入金予測・参照専用）とは別系統。こちらはMFに実際に
 * 請求書を作成・更新する書き込み系ツール群。ただし送付（郵送/メール）は一切行わず、
 * 常に下書き状態で作成・更新する（/invoice_template_billings.json 及び
 * PUT /billings/{id}.json の挙動に依存）。
 *
 * mf_create_billing_draft / mf_update_billing_draft は環境変数
 * MCP_ALLOW_MF_WRITE=true のときのみ有効。
 * 参照系（mf_search_partners / mf_check_duplicate_billing / mf_get_billing）は常時有効。
 */
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { fetchAllPartners, filterPartners, fetchPartnerById } from './mf-partners'
import {
  createFreeBilling,
  extractPdfUrl,
  exciseForTaxRate,
  updateBillingRaw,
  addBillingItem,
  removeBillingItem,
  deleteBillingDraft,
  updateBillingPaymentStatus,
  PAYMENT_STATUS_CODES,
  type FreeBillingItem,
  type PaymentStatusLabel,
} from './mf-invoice'
import {
  fetchBillingById,
  fetchRawBilling,
  fetchSentHistories,
  findPossibleDuplicateBillings,
  todayJST,
} from './mf-billings'
import { actorFrom, logMfWrite } from './mf-write-audit'

const DATE = /^\d{4}-\d{2}-\d{2}$/

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `エラー: ${message}` }], isError: true }
}

export function registerMfInvoiceWriteTools(server: McpServer, opts: { allowWrite: boolean }) {
  server.tool(
    'mf_search_partners',
    'マネーフォワード上の既存取引先を名前（部分一致・カナ可）で検索し、請求書下書き作成に必要な取引先ID(partner_id)を取得する。' +
      '曖昧な一致の場合は複数候補を返すので、該当が複数ある場合は利用者に確認してからmf_create_billing_draftに進むこと。' +
      'keywordを省略すると先頭から一覧を返す。',
    {
      keyword: z.string().optional().describe('取引先名・カナの部分一致キーワード。省略可'),
      limit: z.number().int().min(1).max(50).optional().describe('返す最大件数。既定20'),
    },
    async ({ keyword, limit }) => {
      try {
        const partners = await fetchAllPartners()
        const matched = filterPartners(partners, keyword)
        const cap = limit ?? 20
        return textResult({
          keyword: keyword ?? null,
          matched_count: matched.length,
          truncated: matched.length > cap,
          partners: matched.slice(0, cap).map((p) => ({
            partner_id: p.id,
            partner_name: p.name,
            name_kana: p.name_kana,
            department_id: p.department_id,
            department: p.department,
          })),
        })
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )

  server.tool(
    'mf_check_duplicate_billing',
    '同一取引先・近い件名の請求書が既に存在しないかを調べる（二重作成防止）。' +
      'mf_create_billing_draftを呼ぶ前に必ず一度確認すること。candidatesが1件以上あれば、' +
      '既存請求書と区別がつく件名・金額か再確認してから作成するか判断する。',
    {
      partner_id: z.string().describe('mf_search_partnersで取得したpartner_id'),
      title: z.string().optional().describe('作成予定の件名。指定すると部分一致するものだけに絞る'),
      around_date: z.string().regex(DATE).optional().describe('請求日の予定 YYYY-MM-DD。省略時は今日'),
      window_days: z.number().int().min(1).max(365).optional().describe('around_dateの前後何日を調べるか。既定60'),
    },
    async ({ partner_id, title, around_date, window_days }) => {
      try {
        const candidates = await findPossibleDuplicateBillings({
          partnerId: partner_id,
          title,
          aroundDate: around_date,
          windowDays: window_days,
        })
        return textResult({
          partner_id,
          title: title ?? null,
          checked_range_days: window_days ?? 60,
          around_date: around_date ?? todayJST(),
          likely_duplicate: candidates.length > 0,
          candidate_count: candidates.length,
          candidates,
        })
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )

  server.tool(
    'mf_get_billing',
    'IDを指定して請求書1件の明細・金額・送付状況を確認する。mf_create_billing_draftで作成した直後の確認や、' +
      '既存請求書の内容確認に使う。',
    {
      billing_id: z.string().describe('請求書ID（mf_create_billing_draftの戻り値やmf_search_billingsのidと同じもの）'),
    },
    async ({ billing_id }) => {
      try {
        const detail = await fetchBillingById(billing_id)
        if (!detail) return errorResult(`請求書 ${billing_id} が見つかりません`)
        const sentHistory = await fetchSentHistories(billing_id).catch(() => null)
        return textResult({
          billing_id: detail.id,
          partner_id: detail.partner_id,
          partner_name: detail.partner_name,
          title: detail.title,
          billing_date: detail.billing_date,
          due_date: detail.due_date,
          sales_date: detail.sales_date,
          unit: '円',
          subtotal: detail.subtotal,
          tax: detail.tax,
          total: detail.total,
          items: detail.items,
          payment_status: detail.payment_status,
          send_status: {
            posting_status: detail.posting_status,
            email_status: detail.email_status,
            sent_history: sentHistory,
            note:
              sentHistory === null
                ? 'sent_historiesの取得に失敗したため未確認。posting_status/email_statusのみ参考値。'
                : sentHistory.length > 0
                  ? '送付履歴がありました。この請求書は送付済みです。'
                  : '送付履歴なし。下書きのまま（未送付）と判断してよい。',
          },
          url: detail.pdf_url,
        })
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )

  server.tool(
    'mf_get_sent_history',
    '指定した請求書IDが、実際にいつ・誰宛に送付（メール/郵送）されたかの履歴を返す。空配列なら一度も送付されていない下書きと判断できる。' +
      'mf_update_billing_draftやmf_create_billing_draftの前後で、送付済みの請求書を誤って触っていないか確認するのに使う。',
    {
      billing_id: z.string().describe('請求書ID'),
    },
    async ({ billing_id }) => {
      try {
        const history = await fetchSentHistories(billing_id)
        return textResult({
          billing_id,
          ever_sent: history.length > 0,
          count: history.length,
          history,
        })
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )

  server.tool(
    'mf_create_billing_draft',
    'マネーフォワードに自由明細の請求書を「下書き」として新規作成する。送付（郵送/メール）は一切行わない。' +
      '必ず事前にmf_search_partnersで取引先を確定し、mf_check_duplicate_billingで二重作成でないか確認してから呼ぶこと。' +
      '同一取引先・近い件名の候補が既にある場合、skip_duplicate_checkがtrueでない限り作成せず候補を返す。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      partner_id: z.string().describe('mf_search_partnersで取得したpartner_id'),
      title: z.string().min(1).describe('請求書の件名。例：AI顧問訪問に伴う交通費・宿泊費 御請求書'),
      billing_date: z.string().regex(DATE).optional().describe('請求日 YYYY-MM-DD。省略時は今日'),
      due_date: z.string().regex(DATE).describe('支払期日 YYYY-MM-DD'),
      sales_date: z.string().regex(DATE).optional().describe('売上計上日 YYYY-MM-DD。省略時はbilling_dateと同じ'),
      memo: z.string().optional().describe('備考'),
      items: z
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
        .describe('請求明細。1件以上必須'),
      skip_duplicate_check: z
        .boolean()
        .optional()
        .describe('trueにすると二重作成チェックで候補が見つかっても作成を強行する。既定false'),
    },
    async ({ partner_id, title, billing_date, due_date, sales_date, memo, items, skip_duplicate_check }, extra) => {
      if (!opts.allowWrite) {
        return errorResult(
          '請求書の作成はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）'
        )
      }
      const actor = actorFrom(extra)
      try {
        const partner = await fetchPartnerById(partner_id)
        if (!partner) return errorResult(`取引先 ${partner_id} が見つかりません。mf_search_partnersで確認してください`)

        const resolvedBillingDate = billing_date ?? todayJST()

        if (!skip_duplicate_check) {
          const candidates = await findPossibleDuplicateBillings({
            partnerId: partner_id,
            title,
            aroundDate: resolvedBillingDate,
          })
          if (candidates.length > 0) {
            return textResult({
              created: false,
              blocked_reason: 'duplicate_suspected',
              candidates,
              hint:
                '同一取引先・近い件名の請求書が既に存在します。別件と確認できる場合はskip_duplicate_check: trueを指定して再実行してください。',
            })
          }
        }

        const freeItems: FreeBillingItem[] = items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unit: it.unit?.trim() || '式',
          unitPrice: it.unit_price,
          taxRate: it.tax_rate,
        }))

        const res = await createFreeBilling({
          partnerDepartmentId: partner.department_id,
          title,
          billingDate: resolvedBillingDate,
          dueDate: due_date,
          salesDate: sales_date,
          memo,
          items: freeItems,
        })

        const detail = await fetchBillingById(res.id).catch(() => null)

        void logMfWrite({
          tool: 'mf_create_billing_draft',
          action: 'create',
          actor,
          targetType: 'billing',
          targetId: res.id,
          success: true,
          summary: { partner_id, title, total: detail?.total ?? null },
        })

        return textResult({
          created: true,
          billing_id: res.id,
          partner_id: partner.id,
          partner_name: partner.name,
          title,
          total: detail?.total ?? null,
          pdf_url: extractPdfUrl(res),
          note: '下書きとして作成されました。MFへの送付（郵送/メール）は行っていません。内容を確認のうえ、送付はMoneyForward側で手動で行ってください。',
          detail,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_create_billing_draft',
          action: 'create',
          actor,
          targetType: 'billing',
          success: false,
          error: message,
          summary: { partner_id, title },
        })
        return errorResult(message)
      }
    }
  )

  server.tool(
    'mf_update_billing_draft',
    '作成済みの請求書（下書き）の件名・支払期日・備考・明細を後から修正する。billing_idで対象を指定し、' +
      '変更したい項目だけ渡せばよい（省略した項目は現在の値をそのまま維持する。itemsを渡した場合のみ明細全体を置き換える）。' +
      'MFが送付済みかどうかを断定できる情報源が無いため、既に送付済みの請求書を意図せず書き換えないよう、' +
      '呼ぶ前にmf_get_billingで送付状況（send_status）を確認すること。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      billing_id: z.string().describe('更新対象の請求書ID'),
      title: z.string().min(1).optional().describe('件名。省略時は現状維持'),
      billing_date: z.string().regex(DATE).optional().describe('請求日 YYYY-MM-DD。省略時は現状維持'),
      due_date: z.string().regex(DATE).optional().describe('支払期日 YYYY-MM-DD。省略時は現状維持'),
      sales_date: z.string().regex(DATE).optional().describe('売上計上日 YYYY-MM-DD。省略時は現状維持'),
      memo: z.string().optional().describe('備考。省略時は現状維持'),
      items: z
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
        .optional()
        .describe('明細を丸ごと置き換える。指定すると既存の明細は全て破棄され、この内容に置き換わる。省略時は現状の明細を維持'),
    },
    async ({ billing_id, title, billing_date, due_date, sales_date, memo, items }, extra) => {
      if (!opts.allowWrite) {
        return errorResult(
          '請求書の更新はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）'
        )
      }
      const actor = actorFrom(extra)
      try {
        const raw = await fetchRawBilling(billing_id)
        if (!raw) return errorResult(`請求書 ${billing_id} が見つかりません`)

        const normDate = (v: unknown): string | undefined =>
          typeof v === 'string' && v.length > 0 ? v.replaceAll('/', '-').slice(0, 10) : undefined

        const resolvedBillingDate = billing_date ?? normDate(raw.billing_date)
        const body: Record<string, unknown> = {
          title: title ?? raw.title,
          billing_date: resolvedBillingDate,
          due_date: due_date ?? normDate(raw.due_date),
          sales_date: sales_date ?? normDate(raw.sales_date) ?? resolvedBillingDate,
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
          config: { consumption_tax_display_type: 'internal' },
        }

        const res = await updateBillingRaw(billing_id, body)
        const detail = await fetchBillingById(billing_id).catch(() => null)

        void logMfWrite({
          tool: 'mf_update_billing_draft',
          action: 'update',
          actor,
          targetType: 'billing',
          targetId: billing_id,
          success: true,
          summary: { title: title ?? undefined, items_replaced: Boolean(items) },
        })

        return textResult({
          updated: true,
          billing_id,
          pdf_url: extractPdfUrl(res),
          detail,
          note:
            '更新しました（送付は行っていません）。memoなど本ツールが読み取れなかったフィールドは' +
            '意図せず変わっている可能性があるため、念のためmf_get_billingで内容を確認してください。',
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_update_billing_draft',
          action: 'update',
          actor,
          targetType: 'billing',
          targetId: billing_id,
          success: false,
          error: message,
        })
        return errorResult(message)
      }
    }
  )

  server.tool(
    'mf_add_billing_item',
    '請求書（下書き）に明細を1行追加する。mf_update_billing_draftのitems指定（全置換）と違い、既存の明細に影響を与えず1行だけ足せる。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      billing_id: z.string().describe('対象の請求書ID'),
      name: z.string().min(1).describe('品目名'),
      quantity: z.number().positive().describe('数量'),
      unit_price: z.number().nonnegative().describe('税抜単価（円）'),
      unit: z.string().optional().describe('単位。省略時「式」'),
      tax_rate: z.number().optional().describe('消費税率（%）。10/8/0に対応。省略時10'),
    },
    async ({ billing_id, name, quantity, unit_price, unit, tax_rate }, extra) => {
      if (!opts.allowWrite) {
        return errorResult(
          '請求書の更新はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）'
        )
      }
      const actor = actorFrom(extra)
      try {
        const item = await addBillingItem(billing_id, {
          name,
          quantity,
          unit: unit?.trim() || '式',
          unitPrice: unit_price,
          taxRate: tax_rate,
        })
        const detail = await fetchBillingById(billing_id).catch(() => null)
        void logMfWrite({
          tool: 'mf_add_billing_item',
          action: 'add_item',
          actor,
          targetType: 'billing',
          targetId: billing_id,
          success: true,
          summary: { name, quantity, unit_price },
        })
        return textResult({ added: true, billing_id, item_id: item.id, detail })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_add_billing_item',
          action: 'add_item',
          actor,
          targetType: 'billing',
          targetId: billing_id,
          success: false,
          error: message,
        })
        return errorResult(message)
      }
    }
  )

  server.tool(
    'mf_remove_billing_item',
    '請求書（下書き）から明細を1行削除する。item_idはmf_get_billingで返るitems[].idを使う。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      billing_id: z.string().describe('対象の請求書ID'),
      item_id: z.string().describe('削除する明細のID'),
    },
    async ({ billing_id, item_id }, extra) => {
      if (!opts.allowWrite) {
        return errorResult(
          '請求書の更新はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）'
        )
      }
      const actor = actorFrom(extra)
      try {
        await removeBillingItem(billing_id, item_id)
        const detail = await fetchBillingById(billing_id).catch(() => null)
        void logMfWrite({
          tool: 'mf_remove_billing_item',
          action: 'remove_item',
          actor,
          targetType: 'billing',
          targetId: billing_id,
          success: true,
          summary: { item_id },
        })
        return textResult({ removed: true, billing_id, item_id, detail })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_remove_billing_item',
          action: 'remove_item',
          actor,
          targetType: 'billing',
          targetId: billing_id,
          success: false,
          error: message,
        })
        return errorResult(message)
      }
    }
  )

  server.tool(
    'mf_delete_billing_draft',
    '作り間違えた請求書の下書きを削除する。削除は取り消せないため、confirmを付けずに呼ぶと削除内容の' +
      'プレビューだけを返す（実行しない）。プレビューを利用者に見せて許可を得てから、confirm: trueを付けて' +
      '同じ内容でもう一度呼ぶこと。送付履歴（sent_history）が1件でもある請求書は、誤って送付済み書類を' +
      '消さないよう、confirm: trueでも削除を拒否する。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      billing_id: z.string().describe('削除対象の請求書ID'),
      confirm: z
        .boolean()
        .optional()
        .describe('trueにすると実際に削除する。省略/falseの場合はプレビューのみ返し削除は実行しない'),
    },
    async ({ billing_id, confirm }, extra) => {
      if (!opts.allowWrite) {
        return errorResult('請求書の削除はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）')
      }
      const actor = actorFrom(extra)
      try {
        const detail = await fetchBillingById(billing_id)
        if (!detail) return errorResult(`請求書 ${billing_id} が見つかりません`)

        const history = await fetchSentHistories(billing_id).catch(() => null)
        if (history && history.length > 0) {
          return errorResult(
            `請求書 ${billing_id} には送付履歴が${history.length}件あるため削除できません（誤って送付済み書類を削除しないための安全策）。取消が必要な場合はMoneyForward画面で直接操作してください。`
          )
        }

        if (!confirm) {
          return textResult({
            pending: true,
            billing_id,
            preview: detail,
            hint: 'この内容を利用者に見せて削除の許可を得たうえで、confirm: true を付けて同じ内容でもう一度呼び出してください。',
          })
        }

        await deleteBillingDraft(billing_id)
        void logMfWrite({
          tool: 'mf_delete_billing_draft',
          action: 'delete',
          actor,
          targetType: 'billing',
          targetId: billing_id,
          success: true,
          summary: { title: detail.title, partner_name: detail.partner_name },
        })
        return textResult({ deleted: true, billing_id })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_delete_billing_draft',
          action: 'delete',
          actor,
          targetType: 'billing',
          targetId: billing_id,
          success: false,
          error: message,
        })
        return errorResult(message)
      }
    }
  )

  server.tool(
    'mf_update_payment_status',
    '請求書の入金ステータス（消込フラグ）を更新する。取引先への送付は発生しない、自社内の記録変更。' +
      'confirmを付けずに呼ぶと、現在のステータスと変更予定のステータスのプレビューだけ返す。' +
      '内容を利用者に見せて許可を得てから、confirm: trueを付けて同じ内容でもう一度呼ぶこと。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      billing_id: z.string().describe('対象の請求書ID'),
      status: z
        .enum(Object.keys(PAYMENT_STATUS_CODES) as [PaymentStatusLabel, ...PaymentStatusLabel[]])
        .describe('変更後の入金ステータス'),
      confirm: z
        .boolean()
        .optional()
        .describe('trueにすると実際に更新する。省略/falseの場合はプレビューのみ返し更新は実行しない'),
    },
    async ({ billing_id, status, confirm }, extra) => {
      if (!opts.allowWrite) {
        return errorResult(
          '入金ステータスの更新はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）'
        )
      }
      const actor = actorFrom(extra)
      try {
        const detail = await fetchBillingById(billing_id)
        if (!detail) return errorResult(`請求書 ${billing_id} が見つかりません`)

        if (!confirm) {
          return textResult({
            pending: true,
            billing_id,
            current_status: detail.payment_status,
            new_status: status,
            preview: { title: detail.title, partner_name: detail.partner_name, total: detail.total },
            hint: 'この内容を利用者に見せて許可を得たうえで、confirm: true を付けて同じ内容でもう一度呼び出してください。',
          })
        }

        await updateBillingPaymentStatus(billing_id, status)
        const refreshed = await fetchBillingById(billing_id).catch(() => null)
        void logMfWrite({
          tool: 'mf_update_payment_status',
          action: 'update_payment_status',
          actor,
          targetType: 'billing',
          targetId: billing_id,
          success: true,
          summary: { from: detail.payment_status, to: status },
        })
        return textResult({ updated: true, billing_id, payment_status: refreshed?.payment_status ?? status })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_update_payment_status',
          action: 'update_payment_status',
          actor,
          targetType: 'billing',
          targetId: billing_id,
          success: false,
          error: message,
        })
        return errorResult(message)
      }
    }
  )
}
