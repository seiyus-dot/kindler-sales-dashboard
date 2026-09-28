/**
 * MCPツール：マネーフォワード クラウド請求書の品目マスタ
 *
 * 請求書・見積書の明細でよく使う品目（例：「AI顧問月額」）をテンプレート化する。
 * 検索は常時有効、登録・更新は環境変数 MCP_ALLOW_MF_WRITE=true のときのみ有効。
 */
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { fetchAllItems, filterItems, createItem, updateItem } from './mf-items'
import { actorFrom, logMfWrite } from './mf-write-audit'

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `エラー: ${message}` }], isError: true }
}

export function registerMfItemTools(server: McpServer, opts: { allowWrite: boolean }) {
  server.tool(
    'mf_search_items',
    '品目マスタ（よく使う請求品目のテンプレート）を名前・コードの部分一致で検索する。' +
      'keywordを省略すると先頭から一覧を返す。',
    {
      keyword: z.string().optional().describe('品目名・コードの部分一致キーワード。省略可'),
      limit: z.number().int().min(1).max(50).optional().describe('返す最大件数。既定20'),
    },
    async ({ keyword, limit }) => {
      try {
        const items = await fetchAllItems()
        const matched = filterItems(items, keyword)
        const cap = limit ?? 20
        return textResult({
          keyword: keyword ?? null,
          matched_count: matched.length,
          truncated: matched.length > cap,
          items: matched.slice(0, cap),
        })
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )

  server.tool(
    'mf_create_item',
    '品目マスタに新しいテンプレートを登録する。以後mf_create_billing_draft等の明細でこの品目を' +
      '毎回同じ名前・単価で呼び出せるようにする。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      name: z.string().min(1).describe('品目名'),
      code: z.string().min(1).describe('品目コード（一意な識別子。無ければ品目名から適当に決めてよい）'),
      detail: z.string().optional().describe('詳細説明'),
      unit: z.string().optional().describe('単位。省略時「式」'),
      price: z.number().nonnegative().optional().describe('税抜単価（円）'),
      tax_rate: z.number().optional().describe('消費税率（%）。10/8/0に対応。省略時10'),
    },
    async ({ name, code, detail, unit, price, tax_rate }, extra) => {
      if (!opts.allowWrite) {
        return errorResult('品目の登録はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）')
      }
      const actor = actorFrom(extra)
      try {
        const item = await createItem({ name, code, detail, unit: unit || '式', price, taxRate: tax_rate })
        void logMfWrite({
          tool: 'mf_create_item',
          action: 'create',
          actor,
          targetType: 'item',
          targetId: item.id,
          success: true,
          summary: { name, code },
        })
        return textResult({ created: true, item })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_create_item',
          action: 'create',
          actor,
          targetType: 'item',
          success: false,
          error: message,
          summary: { name, code },
        })
        return errorResult(message)
      }
    }
  )

  server.tool(
    'mf_update_item',
    '既存の品目マスタの名前・コード・単価などを更新する。渡した項目だけ更新される。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      item_id: z.string().describe('更新対象の品目ID（mf_search_itemsのid）'),
      name: z.string().optional(),
      code: z.string().optional(),
      detail: z.string().optional(),
      unit: z.string().optional(),
      price: z.number().nonnegative().optional().describe('税抜単価（円）'),
      tax_rate: z.number().optional().describe('消費税率（%）。10/8/0に対応'),
    },
    async ({ item_id, name, code, detail, unit, price, tax_rate }, extra) => {
      if (!opts.allowWrite) {
        return errorResult('品目の更新はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）')
      }
      const actor = actorFrom(extra)
      try {
        const item = await updateItem(item_id, { name, code, detail, unit, price, taxRate: tax_rate })
        void logMfWrite({
          tool: 'mf_update_item',
          action: 'update',
          actor,
          targetType: 'item',
          targetId: item_id,
          success: true,
          summary: { name: name ?? undefined, code: code ?? undefined },
        })
        return textResult({ updated: true, item })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_update_item',
          action: 'update',
          actor,
          targetType: 'item',
          targetId: item_id,
          success: false,
          error: message,
        })
        return errorResult(message)
      }
    }
  )
}
