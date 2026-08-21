import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mcpSupabaseAdmin } from './mcp-supabase-admin'
import { MCP_TABLES, isKnownMcpTable } from './mcp-tables'

const FILTER_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is'] as const

const filterSchema = z.object({
  column: z.string().describe('絞り込む列名'),
  op: z.enum(FILTER_OPS).describe('比較演算子。inはvalueを配列で渡す。isはnull判定用（value: null）'),
  value: z.any().describe('比較する値。opがinの場合は配列。'),
})

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()])

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `エラー: ${message}` }], isError: true }
}

function requireKnownTable(table: string) {
  if (!isKnownMcpTable(table)) {
    const allowed = Object.keys(MCP_TABLES).join(', ')
    throw new Error(`テーブル "${table}" はホワイトリストにありません。利用可能: ${allowed}`)
  }
  return table
}

// PostgRESTのselect構文はカンマ区切り列名の他に "col(other_table(*))" のような
// 外部キー経由のリレーション埋め込みを許すため、ホワイトリスト外テーブルの
// 迂回読み取りを防ぐには埋め込み構文を明示的に拒否する必要がある。
const SAFE_COLUMNS_PATTERN = /^[a-zA-Z0-9_,\s*]*$/

function sanitizeColumns(columns: string | undefined): string {
  if (!columns) return '*'
  if (!SAFE_COLUMNS_PATTERN.test(columns)) {
    throw new Error('columnsには列名・カンマ・空白・"*"のみ指定できます（テーブル間のリレーション取得は許可されていません）')
  }
  return columns
}

function assertNoProtectedColumns(table: ReturnType<typeof requireKnownTable>, data: Record<string, unknown>) {
  const config = MCP_TABLES[table]
  const bad = Object.keys(data).filter((k) => config.protectedColumns.includes(k))
  if (bad.length > 0) {
    throw new Error(`列 ${bad.join(', ')} はシステム管理用のため書き換えできません`)
  }
}

export function registerMcpTools(server: McpServer, opts: { allowDelete: boolean }) {
  server.tool(
    'list_tables',
    'このMCPサーバーからアクセスできるSupabaseテーブルの一覧と、それぞれの説明・可能な操作(select/insert/update/delete)を返す。他のツールを使う前にまずこれで対象テーブルを確認すること。',
    {},
    async () => {
      const summary = Object.fromEntries(
        Object.entries(MCP_TABLES).map(([name, cfg]) => [
          name,
          {
            description: cfg.description,
            operations: {
              select: true,
              insert: cfg.insertable,
              update: cfg.updatable,
              delete: cfg.deletable && opts.allowDelete,
            },
            protected_columns: cfg.protectedColumns,
          },
        ])
      )
      return textResult(summary)
    }
  )

  server.tool(
    'query_rows',
    '売上ダッシュボードのSupabaseテーブルから行を検索する（SELECT相当）。テーブル名はlist_tablesで確認したホワイトリストのものだけ指定できる。',
    {
      table: z.string().describe('テーブル名（list_tablesで確認）'),
      columns: z.string().optional().describe('取得する列。省略時は"*"。例: "id,company_name,status"'),
      filters: z.array(filterSchema).optional().describe('AND条件の絞り込み配列'),
      order_by: z.string().optional().describe('並び替える列名'),
      ascending: z.boolean().optional().describe('order_by指定時の昇順/降順。省略時true'),
      limit: z.number().int().min(1).max(200).optional().describe('最大取得件数。省略時50、最大200'),
    },
    async ({ table, columns, filters, order_by, ascending, limit }) => {
      try {
        const t = requireKnownTable(table)
        let query = mcpSupabaseAdmin.from(t).select(sanitizeColumns(columns))
        for (const f of filters ?? []) {
          switch (f.op) {
            case 'eq': query = query.eq(f.column, f.value); break
            case 'neq': query = query.neq(f.column, f.value); break
            case 'gt': query = query.gt(f.column, f.value); break
            case 'gte': query = query.gte(f.column, f.value); break
            case 'lt': query = query.lt(f.column, f.value); break
            case 'lte': query = query.lte(f.column, f.value); break
            case 'like': query = query.like(f.column, f.value); break
            case 'ilike': query = query.ilike(f.column, f.value); break
            case 'in': query = query.in(f.column, f.value); break
            case 'is': query = query.is(f.column, f.value); break
          }
        }
        if (order_by) query = query.order(order_by, { ascending: ascending ?? true })
        query = query.limit(limit ?? 50)

        const { data, error } = await query
        if (error) throw new Error(error.message)
        return textResult(data)
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )

  server.tool(
    'insert_row',
    'テーブルに1行INSERTする。id/created_at/updated_atなどシステム管理列は指定不可（自動採番される）。',
    {
      table: z.string(),
      data: z.record(scalar).describe('列名 -> 値。文字列/数値/真偽値/nullのみ'),
    },
    async ({ table, data }) => {
      try {
        const t = requireKnownTable(table)
        const config = MCP_TABLES[t]
        if (!config.insertable) throw new Error(`テーブル "${t}" はINSERTが許可されていません`)
        assertNoProtectedColumns(t, data)

        const { data: inserted, error } = await mcpSupabaseAdmin.from(t).insert(data).select().single()
        if (error) throw new Error(error.message)
        return textResult(inserted)
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )

  server.tool(
    'update_row',
    '既存の行をUPDATEする。matchで対象行を一意に絞り込み（通常はid）、dataで更新する列を指定する。',
    {
      table: z.string(),
      match: z.record(scalar).describe('更新対象を絞り込む列名 -> 値（例: {"id": "..."}）'),
      data: z.record(scalar).describe('更新する列名 -> 値'),
    },
    async ({ table, match, data }) => {
      try {
        const t = requireKnownTable(table)
        const config = MCP_TABLES[t]
        if (!config.updatable) throw new Error(`テーブル "${t}" はUPDATEが許可されていません`)
        if (Object.keys(match).length === 0) throw new Error('matchは最低1列指定してください（全件更新を防ぐため）')
        assertNoProtectedColumns(t, data)

        let query = mcpSupabaseAdmin.from(t).update(data)
        for (const [col, val] of Object.entries(match)) {
          query = query.eq(col, val)
        }
        const { data: updated, error } = await query.select()
        if (error) throw new Error(error.message)
        return textResult(updated)
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )

  server.tool(
    'delete_row',
    '既存の行をDELETEする。MCP_ALLOW_DELETE=trueかつテーブルがdeletable指定の場合のみ利用可能。',
    {
      table: z.string(),
      match: z.record(scalar).describe('削除対象を絞り込む列名 -> 値（例: {"id": "..."}）'),
    },
    async ({ table, match }) => {
      try {
        if (!opts.allowDelete) throw new Error('このサーバーではDELETEが無効化されています（MCP_ALLOW_DELETE=trueで有効化）')
        const t = requireKnownTable(table)
        const config = MCP_TABLES[t]
        if (!config.deletable) throw new Error(`テーブル "${t}" はDELETEが許可されていません`)
        if (Object.keys(match).length === 0) throw new Error('matchは最低1列指定してください（全件削除を防ぐため）')

        let query = mcpSupabaseAdmin.from(t).delete()
        for (const [col, val] of Object.entries(match)) {
          query = query.eq(col, val)
        }
        const { data: deleted, error } = await query.select()
        if (error) throw new Error(error.message)
        return textResult(deleted)
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
  )
}
