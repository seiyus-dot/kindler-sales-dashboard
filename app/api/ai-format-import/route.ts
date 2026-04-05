import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SCHEMAS = {
  deals_toc: {
    label: '個人案件',
    fields: {
      name: '氏名・顧客名',
      contact: 'メール・電話・LINE',
      service: '商品名・サービス名',
      status: 'ステータス（受注/失注/保留/商談中など）',
      source: '流入経路',
      expected_amount: '見込み金額（万円）',
      actual_amount: '着金額（万円）',
      payment_date: '着金日',
      first_contact_date: '初回接触日・申込日',
      next_action: '次回アクション',
      next_action_date: '次回期日',
      notes: 'メモ・備考・その他',
    },
    statusMap: { '確定': '受注', '入金待ち': '保留', 'キャンセル': '失注', '成約': '受注', '失注': '失注', '保留': '保留' } as Record<string, string>,
  },
  deals_tob: {
    label: '法人案件',
    fields: {
      company_name: '企業名・会社名',
      contact_name: '担当者名・先方担当者',
      service: '商品名・サービス名',
      industry: '業種',
      status: 'ステータス',
      source: '流入経路',
      expected_amount: '見込み金額（万円）',
      actual_amount: '着金額（万円）',
      notes: 'メモ・備考',
    },
    statusMap: { '確定': '受注', '成約': '受注', '失注': '失注', '保留': '保留' } as Record<string, string>,
  },
  aicamp_consultations: {
    label: 'AI CAMP 商談（ロードマップ作成会）',
    fields: {
      name: '氏名',
      line_name: 'LINE名',
      age: '年齢',
      consultation_date: '実施日・商談日',
      status: 'ステータス（成約/失注/保留/ドタキャン）',
      payment_amount: '着金額（円）',
      payment_method: '支払方法',
      occupation: '職業',
      monthly_income: '月収',
      ai_experience: 'AIの知識・経験',
      source: '流入経路',
      registration_source: '登録経路',
      reason: '成約/失注/保留の理由',
      motivation: '動機・背景',
      minutes_url: '議事録URL',
      reply_deadline: '返事の期限',
    },
    statusMap: { '確定': '成約', '入金待ち': '保留', 'キャンセル': 'キャンセル', '成約': '成約', '失注': '失注', 'ドタキャン': 'ドタキャン', '保留': '保留' } as Record<string, string>,
  },
}

export async function POST(req: NextRequest) {
  const { headers, sampleRows, allRows, defaultMemberId, members } = await req.json()
  const memberList: { id: string; name: string }[] = members ?? []

  function resolveMemberId(nameVal: string): string | null {
    if (!nameVal) return defaultMemberId || null
    // 部分一致で検索（「白岩 聖悠(AIコンサルタント)」→「白岩」でも一致）
    const match = memberList.find(m =>
      nameVal.includes(m.name) || m.name.includes(nameVal) || nameVal === m.name
    )
    return match?.id ?? defaultMemberId ?? null
  }

  // Claude にスキーマ判定とマッピングを依頼
  const prompt = `
あなたは営業データのインポート専門家です。以下のCSV/Excelデータを分析して、最適なインポート先とカラムマッピングを判断してください。

## 列名
${JSON.stringify(headers)}

## サンプルデータ（最大5行）
${JSON.stringify(sampleRows, null, 2)}

## 担当者マスタ（名前がデータに含まれる場合は member_id にマッピングしてください）
${memberList.map(m => m.name).join('、') || 'なし'}

## インポート候補テーブル
${Object.entries(SCHEMAS).map(([key, s]) => `
### ${key}（${s.label}）
フィールド: ${JSON.stringify(s.fields)}`).join('\n')}

## 回答形式（JSON のみ返してください）
{
  "targetTable": "deals_toc | deals_tob | aicamp_consultations",
  "reason": "判断理由を一言で",
  "mappings": {
    "元の列名": "マッピング先フィールド名 または null（不要な列）"
  },
  "skipPatterns": ["スキップすべき行のパターン（例：テスト、#N/A）"]
}
`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (message.content[0] as { type: string; text: string }).text
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ error: 'AI応答の解析に失敗しました' }, { status: 500 })

  const aiResult = JSON.parse(jsonMatch[0])
  const { targetTable, reason, mappings, skipPatterns = [] } = aiResult
  const schema = SCHEMAS[targetTable as keyof typeof SCHEMAS]
  if (!schema) return NextResponse.json({ error: '対応していないテーブルです' }, { status: 400 })

  // 全行をマッピング
  const mappedRows: Record<string, unknown>[] = []
  const skipped: string[] = []

  for (const row of allRows) {
    // スキップ判定
    const rowStr = Object.values(row).join(' ')
    const shouldSkip = skipPatterns.some((p: string) => rowStr.includes(p))
    if (shouldSkip) { skipped.push(rowStr.slice(0, 50)); continue }

    const mapped: Record<string, unknown> = {}
    if (defaultMemberId) mapped.member_id = defaultMemberId
    let memberResolved = false

    for (const [srcCol, dstField] of Object.entries(mappings)) {
      if (!dstField || dstField === 'null') continue
      const val = row[srcCol]
      if (!val && val !== 0) continue

      const field = dstField as string

      // 担当者名 → UUID変換
      if (field === 'member_id') {
        const resolved = resolveMemberId(String(val))
        if (resolved) { mapped.member_id = resolved; memberResolved = true }
        continue
      }

      // 数値フィールド
      if (['expected_amount', 'actual_amount', 'payment_amount', 'age', 'win_probability'].includes(field)) {
        const num = parseInt(String(val).replace(/[^0-9]/g, ''))
        if (!isNaN(num)) mapped[field] = num
        continue
      }

      // 日付フィールド
      if (['first_contact_date', 'last_contact_date', 'next_action_date', 'payment_date', 'reply_deadline', 'consultation_date'].includes(field)) {
        const d = new Date(String(val))
        if (!isNaN(d.getTime())) mapped[field] = d.toISOString().slice(0, 10)
        continue
      }

      // ステータス正規化
      if (field === 'status') {
        mapped[field] = schema.statusMap[String(val)] ?? val
        continue
      }

      mapped[field] = String(val)
    }

    // 必須フィールドチェック
    if (targetTable === 'deals_toc' && !mapped.name) continue
    if (targetTable === 'deals_tob' && !mapped.company_name) continue

    mappedRows.push(mapped)
  }

  return NextResponse.json({
    targetTable,
    targetLabel: schema.label,
    reason,
    mappings,
    preview: mappedRows.slice(0, 5),
    totalRows: mappedRows.length,
    skippedCount: skipped.length,
    rows: mappedRows,
  })
}

// インポート実行
export async function PUT(req: NextRequest) {
  const { targetTable, rows } = await req.json()
  if (!['deals_toc', 'deals_tob', 'aicamp_consultations'].includes(targetTable)) {
    return NextResponse.json({ error: '無効なテーブル' }, { status: 400 })
  }

  const results = { inserted: 0, errors: [] as string[] }
  for (const row of rows) {
    const { error } = await supabase.from(targetTable).insert(row)
    if (error) results.errors.push(error.message)
    else results.inserted++
  }
  return NextResponse.json(results)
}
