/**
 * MCPツール：マネーフォワード クラウド請求書の取引先マスタ書き込み
 *
 * lib/mcp-mf-write-tools.ts の mf_search_partners（検索・読み取り専用）とは別系統。
 * MFに存在しない新規取引先の登録・既存取引先情報の更新に使う。
 * 環境変数 MCP_ALLOW_MF_WRITE=true のときのみ有効。
 */
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { fetchPartnerById } from './mf-partners'
import {
  createPartnerFreeform,
  updatePartnerName,
  updatePartnerDepartmentFreeform,
  addPartnerDepartment,
} from './mf-partner-write'
import { actorFrom, logMfWrite } from './mf-write-audit'

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `エラー: ${message}` }], isError: true }
}

const departmentShape = {
  zip: z.string().optional().describe('郵便番号'),
  address1: z.string().optional().describe('住所'),
  address2: z.string().optional().describe('住所2行目（建物名等）'),
  tel: z.string().optional().describe('電話番号'),
  email: z.string().optional().describe('メールアドレス'),
  person_name: z.string().optional().describe('担当者名'),
  person_title: z.string().optional().describe('担当者役職'),
}

export function registerMfPartnerWriteTools(server: McpServer, opts: { allowWrite: boolean }) {
  server.tool(
    'mf_create_partner',
    'mf_search_partnersで見つからなかった新規取引先をマネーフォワードに登録する。作成後のpartner_idは' +
      'mf_create_billing_draftにそのまま使える。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      name: z.string().min(1).describe('取引先名（会社名）'),
      name_kana: z.string().optional().describe('取引先名のカナ'),
      department: z
        .object(departmentShape)
        .optional()
        .describe('請求先の住所・担当者情報。省略可（後からmf_update_partner系で追加も可）'),
    },
    async ({ name, name_kana, department }, extra) => {
      if (!opts.allowWrite) {
        return errorResult('取引先の登録はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）')
      }
      const actor = actorFrom(extra)
      try {
        const created = await createPartnerFreeform({ name, nameKana: name_kana, department })
        void logMfWrite({
          tool: 'mf_create_partner',
          action: 'create',
          actor,
          targetType: 'partner',
          targetId: created.id,
          success: true,
          summary: { name },
        })
        return textResult({
          created: true,
          partner_id: created.id,
          department_id: created.departmentId,
          partner_name: name,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_create_partner',
          action: 'create',
          actor,
          targetType: 'partner',
          success: false,
          error: message,
          summary: { name },
        })
        return errorResult(message)
      }
    }
  )

  server.tool(
    'mf_update_partner',
    '既存取引先の名称・カナ・既定部署（住所/担当者）情報を更新する。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      partner_id: z.string().describe('mf_search_partnersで取得したpartner_id'),
      name: z.string().optional().describe('取引先名。省略時は現状維持'),
      name_kana: z.string().optional().describe('取引先名のカナ。省略時は現状維持'),
      department: z.object(departmentShape).optional().describe('既定部署の住所・担当者情報。渡した項目だけ更新'),
    },
    async ({ partner_id, name, name_kana, department }, extra) => {
      if (!opts.allowWrite) {
        return errorResult('取引先の更新はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）')
      }
      const actor = actorFrom(extra)
      try {
        const partner = await fetchPartnerById(partner_id)
        if (!partner) return errorResult(`取引先 ${partner_id} が見つかりません`)

        if (name || name_kana) {
          await updatePartnerName(partner_id, { name, nameKana: name_kana })
        }
        if (department) {
          await updatePartnerDepartmentFreeform(partner_id, partner.department_id, department)
        }
        const refreshed = await fetchPartnerById(partner_id)
        void logMfWrite({
          tool: 'mf_update_partner',
          action: 'update',
          actor,
          targetType: 'partner',
          targetId: partner_id,
          success: true,
          summary: { name: name ?? undefined },
        })
        return textResult({ updated: true, partner_id, partner: refreshed })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_update_partner',
          action: 'update',
          actor,
          targetType: 'partner',
          targetId: partner_id,
          success: false,
          error: message,
        })
        return errorResult(message)
      }
    }
  )

  server.tool(
    'mf_add_partner_department',
    '同じ取引先に、請求先が異なる部署・支店を追加登録する（本社以外に請求する場合など）。' +
      (opts.allowWrite ? '' : '（現在このMCPサーバーではMCP_ALLOW_MF_WRITE未設定のため無効化されています）'),
    {
      partner_id: z.string().describe('mf_search_partnersで取得したpartner_id'),
      name: z.string().optional().describe('部署名'),
      ...departmentShape,
    },
    async ({ partner_id, name, zip, address1, address2, tel, email, person_name, person_title }, extra) => {
      if (!opts.allowWrite) {
        return errorResult('取引先の更新はこのMCPサーバーで無効化されています（環境変数 MCP_ALLOW_MF_WRITE=true が必要）')
      }
      const actor = actorFrom(extra)
      try {
        const partner = await fetchPartnerById(partner_id)
        if (!partner) return errorResult(`取引先 ${partner_id} が見つかりません`)
        const dept = await addPartnerDepartment(partner_id, {
          name,
          zip,
          address1,
          address2,
          tel,
          email,
          person_name,
          person_title,
        })
        void logMfWrite({
          tool: 'mf_add_partner_department',
          action: 'add_department',
          actor,
          targetType: 'partner',
          targetId: partner_id,
          success: true,
          summary: { department_id: dept.id, name },
        })
        return textResult({ added: true, partner_id, department_id: dept.id })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        void logMfWrite({
          tool: 'mf_add_partner_department',
          action: 'add_department',
          actor,
          targetType: 'partner',
          targetId: partner_id,
          success: false,
          error: message,
        })
        return errorResult(message)
      }
    }
  )
}
