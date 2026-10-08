/**
 * MCPツールの実行ログ（schema_mcp_audit_log.sql の mcp_audit_log）。
 *
 * ツールを1本ずつ直さずに済むよう、McpServer.tool() を包んで登録時にハンドラを差し替える。
 * 読み取りも含めた全ツールについて、次を1行ずつ残す。
 * - 誰が（actor）・どのAIから（client = User-Agent）・いつ
 * - 利用者の依頼内容（user_request）
 *     MCPの仕組み上、利用者がAIに送った文章そのものはサーバーに届かない。そこで全ツールに
 *     user_request という引数を自動で足し、AIに依頼内容を書かせる。AIの申告なので原文の保証はない。
 * - 何を実行したか（ツール名・引数）と結果（成功/失敗・結果の先頭部分）
 *
 * メール本文はログに複製しない（文字数だけ残す）。
 * ログの失敗で本処理（メール送信など）を失敗扱いにしてはいけないので、記録のエラーは握りつぶす。
 * Vercelでは応答後に投げっぱなしの処理が止められることがあるため、記録自体はawaitする。
 */
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mcpSupabaseAdmin } from './mcp-supabase-admin'
import { actorFrom } from './mf-write-audit'
import { MORE_MARKER } from './mcp-log-format'

const MAX_STRING = 300
const MAX_RESULT = 4000
/** 結果に配列があるときに残す件数の候補（大きい順に試し、MAX_RESULTに収まる最初のものを使う） */
const RESULT_ITEM_LIMITS = [5, 3, 1]

const REQUEST_KEY = 'user_request'
// 顧客とのメールの中身はログに残さない
const REDACT_KEYS = new Set(['body', 'snippet'])

// 任意項目にするとAIは書かずに済ませる（Claude・ChatGPTとも実測で空だった）ため必須にする
const userRequestField = z
  .string()
  .max(2000)
  .describe(
    '必須。このツールを呼ぶきっかけになった利用者の直近の依頼を、利用者の言葉のまま書く（要約・言い換えしない）。' +
      '実行ログとして管理者が確認するために使う。'
  )

/** サーバー全体への指示（MCPのinitializeでクライアントに渡る） */
export const AUDIT_INSTRUCTIONS =
  'このサーバーのツールを呼ぶときは、必ず引数 user_request に、利用者の直近の依頼を利用者の言葉のまま入れること。' +
  'すべての呼び出しは実行ログとして管理者が確認する。'

function summarize(value: unknown, key?: string, maxItems = 20): unknown {
  if (typeof value === 'string') {
    if (key && REDACT_KEYS.has(key)) return `（${value.length}文字・内容は記録しない）`
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value
  }
  if (Array.isArray(value)) {
    const kept = value.slice(0, maxItems).map((v) => summarize(v, undefined, maxItems))
    return value.length > maxItems ? [...kept, { [MORE_MARKER]: value.length - maxItems }] : kept
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, summarize(v, k, maxItems)]))
  }
  return value
}

type ToolResult = { isError?: boolean; content?: { type: string; text?: string }[] }

function resultText(result: ToolResult): string {
  return result?.content?.find((c) => c.type === 'text')?.text ?? ''
}

/**
 * 結果の要約。JSONなら本文を伏せ、配列は先頭数件だけ残した「正しいJSON」のまま保存する
 * （画面で表として描くため、文字数で途中から切らない）
 */
function summarizeResult(result: ToolResult): string | null {
  const text = resultText(result)
  if (!text) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return text.length > MAX_RESULT ? `${text.slice(0, MAX_RESULT)}…` : text
  }
  for (const limit of RESULT_ITEM_LIMITS) {
    const out = JSON.stringify(summarize(parsed, undefined, limit))
    if (out.length <= MAX_RESULT) return out
  }
  return JSON.stringify({ [MORE_MARKER]: Array.isArray(parsed) ? parsed.length : 1 })
}

type Extra = Parameters<typeof actorFrom>[0] & {
  requestInfo?: { headers?: Record<string, string | string[] | undefined> }
}

function clientOf(extra: Extra): string | null {
  const ua = extra?.requestInfo?.headers?.['user-agent']
  const v = Array.isArray(ua) ? ua[0] : ua
  return v ? v.slice(0, 200) : null
}

async function record(entry: Record<string, unknown>) {
  try {
    const { error } = await mcpSupabaseAdmin.from('mcp_audit_log').insert(entry)
    if (error) console.error('[mcp-audit] insert failed:', error.message)
  } catch (e) {
    console.error('[mcp-audit] failed to log:', e instanceof Error ? e.message : e)
  }
}

function isPlainShape(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && typeof v !== 'function'
}

/** これ以降に server.tool() で登録するツールすべてに、依頼内容の引数と実行ログを付ける */
export function withAuditLog(server: McpServer): McpServer {
  const originalTool = server.tool.bind(server) as (...args: unknown[]) => unknown

  ;(server as unknown as { tool: (...args: unknown[]) => unknown }).tool = (...toolArgs: unknown[]) => {
    const name = String(toolArgs[0])
    const handler = toolArgs[toolArgs.length - 1] as (...cbArgs: unknown[]) => Promise<ToolResult>

    // 引数スキーマ（zodのraw shape）に user_request を足す。スキーマの無いツールには新しく作る
    const shapeIndex = toolArgs.findIndex((a, i) => i > 0 && i < toolArgs.length - 1 && isPlainShape(a))
    if (shapeIndex >= 0) {
      toolArgs[shapeIndex] = { ...(toolArgs[shapeIndex] as object), [REQUEST_KEY]: userRequestField }
    } else {
      toolArgs.splice(toolArgs.length - 1, 0, { [REQUEST_KEY]: userRequestField })
    }

    toolArgs[toolArgs.length - 1] = async (...cbArgs: unknown[]) => {
      const extra = cbArgs[cbArgs.length - 1] as Extra
      const rawInput = (cbArgs.length > 1 ? cbArgs[0] : {}) as Record<string, unknown>
      const { [REQUEST_KEY]: userRequest, ...input } = rawInput ?? {}
      // 元のツールには user_request を渡さない（スキーマが無かったツールは extra だけで呼ぶ）
      const forward = shapeIndex >= 0 ? [input, extra] : [extra]

      const base = {
        actor: actorFrom(extra),
        client: clientOf(extra),
        user_request: typeof userRequest === 'string' ? userRequest.slice(0, 2000) : null,
        tool_name: name,
        args: summarize(input),
      }
      const started = Date.now()
      try {
        const result = await handler(...forward)
        await record({
          ...base,
          success: !result?.isError,
          error_message: result?.isError ? resultText(result).slice(0, 500) : null,
          result_summary: result?.isError ? null : summarizeResult(result),
          duration_ms: Date.now() - started,
        })
        return result
      } catch (e) {
        await record({
          ...base,
          success: false,
          error_message: (e instanceof Error ? e.message : String(e)).slice(0, 500),
          duration_ms: Date.now() - started,
        })
        throw e
      }
    }

    return originalTool(...toolArgs)
  }

  return server
}
