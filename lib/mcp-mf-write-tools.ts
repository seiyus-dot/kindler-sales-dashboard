/**
 * MCPツール：マネーフォワード クラウド請求書（下書き作成まわり）
 *
 * lib/mcp-mf-tools.ts（入金予測・参照専用）とは別系統。こちらはMFに実際に
 * 請求書を作成する書き込み系ツール群。ただし送付（郵送/メール）は一切行わず、
 * 常に下書き状態で作成する（/invoice_template_billings.json の挙動に依存）。
 *
 * mf_create_billing_draft は環境変数 MCP_ALLOW_MF_WRITE=true のときのみ有効。
 * 参照系（mf_search_partners / mf_check_duplicate_billing / mf_get_billing）は常時有効。
 */
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { fetchAllPartners, filterPartners, fetchPartnerById } from './mf-partners'
import { createFreeBilling, extractPdfUrl, type FreeBillingItem } from './mf-invoice'
import { fetchBillingById, findPossibleDuplicateBillings, todayJST } from './mf-billings'

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
            note: 'MF側の郵送/メール送付状況の生値。両方とも未設定なら概ね未送付（下書き）とみなせるが、断定はしないこと。',
          },
          url: detail.pdf_url,
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
    async ({ partner_id, title, billing_date, due_date, sales_date, memo, items, skip_duplicate_check }) => {
      if (!opts.allowWrite) {
        return errorResult(
          '請求書の作成はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）'
        )
      }
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
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )
}
