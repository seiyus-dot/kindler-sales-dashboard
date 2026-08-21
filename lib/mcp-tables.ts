export type McpTableConfig = {
  description: string
  insertable: boolean
  updatable: boolean
  deletable: boolean
  /** insert/update時にAI側から書き換えさせたくない列（id・created_at等） */
  protectedColumns: string[]
}

/**
 * MCP経由でアクセスできるテーブルのホワイトリスト。
 * ここに無いテーブルはquery/insert/update/deleteいずれも拒否する。
 * mf_tokens など機密テーブルは意図的に含めない。
 */
export const MCP_TABLES: Record<string, McpTableConfig> = {
  members: {
    description: '営業/CSメンバーマスタ（name, sort_order）',
    insertable: true,
    updatable: true,
    deletable: false,
    protectedColumns: ['id'],
  },
  deals_tob: {
    description: '法人向け商談パイプライン。expected_amountは万円単位。status/priority/loss_reason等はページ側マスタ準拠。',
    insertable: true,
    updatable: true,
    deletable: false,
    protectedColumns: ['id', 'created_at', 'updated_at'],
  },
  deals_toc: {
    description: '個人向け商談パイプライン。expected_amountは万円単位。',
    insertable: true,
    updatable: true,
    deletable: false,
    protectedColumns: ['id', 'created_at', 'updated_at'],
  },
  deal_actions: {
    description: '商談ごとの活動ログ（電話・商談・提案など）。deal_type は tob/toc。',
    insertable: true,
    updatable: false,
    deletable: false,
    protectedColumns: ['id', 'created_at'],
  },
  weekly_logs: {
    description: '週次の受注実績サマリ。',
    insertable: true,
    updatable: true,
    deletable: false,
    protectedColumns: ['id'],
  },
  clients: {
    description: '契約自動化の取引先マスタ。mf_partner_idはマネーフォワード連携用なのでAIからは書き換えない想定。',
    insertable: true,
    updatable: true,
    deletable: false,
    protectedColumns: ['id', 'created_at', 'updated_at', 'mf_partner_id'],
  },
  contracts: {
    description: '契約（training/advisor）。total_tax_excl等は円単位。mf_*/cloudsign_*はAPI連携専用のためAIから直接更新しない。',
    insertable: true,
    updatable: true,
    deletable: false,
    protectedColumns: [
      'id', 'created_at', 'submitted_at',
      'mf_quote_id', 'mf_quote_pdf_url', 'mf_invoice_id', 'mf_invoice_pdf_url',
      'cloudsign_doc_id', 'cloudsign_sent_at',
    ],
  },
  contract_items: {
    description: '契約明細行（unit_price等は円単位）。',
    insertable: true,
    updatable: true,
    deletable: true,
    protectedColumns: ['id', 'contract_id'],
  },
  contacts: {
    description: '顧客マスタ（個人）。',
    insertable: true,
    updatable: true,
    deletable: false,
    protectedColumns: ['id', 'created_at', 'updated_at'],
  },
  companies: {
    description: '顧客マスタ（法人）。',
    insertable: true,
    updatable: true,
    deletable: false,
    protectedColumns: ['id', 'created_at', 'updated_at'],
  },
  meeting_notes: {
    description: '商談ごとの議事録。deal_typeはtob/toc。',
    insertable: true,
    updatable: true,
    deletable: true,
    protectedColumns: ['id', 'created_at', 'updated_at'],
  },
  aicamp_consultations: {
    description: 'AI CAMP受講生の相談〜契約管理。',
    insertable: true,
    updatable: true,
    deletable: false,
    protectedColumns: ['id', 'created_at', 'updated_at'],
  },
  product_aicamp_sessions: {
    description: 'Product AI CAMP開催回マスタ。',
    insertable: true,
    updatable: true,
    deletable: false,
    protectedColumns: ['id', 'created_at'],
  },
  product_aicamp_customers: {
    description: 'Product AI CAMP申込者。',
    insertable: true,
    updatable: true,
    deletable: false,
    protectedColumns: ['id', 'created_at'],
  },
  news: {
    description: '社内お知らせ/FAQ。',
    insertable: true,
    updatable: true,
    deletable: true,
    protectedColumns: ['id', 'created_at'],
  },
}

export type McpTableName = keyof typeof MCP_TABLES

export function isKnownMcpTable(table: string): table is McpTableName {
  return Object.prototype.hasOwnProperty.call(MCP_TABLES, table)
}
