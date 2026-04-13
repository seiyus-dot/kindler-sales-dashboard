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
      name: '氏名・お名前',
      line_name: 'LINE名',
      age: '年齢',
      consultation_date: '実施日・商談日・日程',
      status: 'ステータス（成約/失注/保留/ドタキャン/参加予定/キャンセル済み）— 参加状況・成約状況のどちらかをマッピング',
      payment_amount: '着金額（円）',
      payment_method: '支払方法',
      occupation: '職業・ご職業',
      monthly_income: '月収・現在の月収',
      ai_experience: 'AIの知識・経験',
      email: 'メールアドレス・email',
      phone: '電話番号・phone',
      source: '流入経路',
      registration_source: '登録経路',
      reason: '成約/失注/保留/キャンセルの理由・キャンセル理由',
      motivation: '動機・背景・ロードマップ作成会への動機・個別相談会で聞きたいこと',
      minutes_url: '議事録URL・議事録リンク・参加URL・ZoomURL',
      reply_deadline: '返事の期限',
      customer_attribute: '顧客属性・顧客情報・性別',
      question: '聞きたいこと・質問',
      expectation: '期待すること',
      ai_purpose: 'AIスキルの活用目的',
      applied_at: '申し込み日時・フォーム送信日時',
    },
    statusMap: {
      '確定': '成約', '入金待ち': '保留', 'キャンセル': 'キャンセル', 'キャンセル済み': 'キャンセル',
      '成約': '成約', '失注': '失注', 'ドタキャン': 'ドタキャン', 'ドタキャン（無断）': 'ドタキャン',
      '保留': '保留', '参加予定': '相談予約', '未登録': '相談予約',
      '申込済': '予定',
    } as Record<string, string>,
  },
}

// ── 既知フォーマット定義 ─────────────────────────────────────────────────────
// ヘッダーが一致すれば AI を呼ばずに即マッピング
const KNOWN_FORMATS: {
  matchHeaders: string[]          // このヘッダーが全て含まれていれば一致
  targetTable: string
  reason: string
  mappings: Record<string, string | null>
}[] = [
  {
    // 個別相談会申込者CSVエクスポート（AI CAMP / Product AI CAMP フォーム出力、新フォーマット）
    matchHeaders: ['日付', '実施日時', '担当者', '氏名', 'ふりがな', '申込URL', '申込状態', '登録状態'],
    targetTable: 'aicamp_consultations',
    reason: '個別相談会申込者CSV（AI CAMP / Product AI CAMP フォーム出力）（ルールベース判定）',
    mappings: {
      '日付':           'applied_at',
      '実施日時':       'consultation_date',
      '担当者':         'member_id',
      '氏名':           'name',
      'ふりがな':       null,
      'メールアドレス': null,
      '電話番号':       null,
      '性別':           'customer_attribute',
      '年齢':           'age',
      '職業':           'occupation',
      '月収':           'monthly_income',
      'AIの知識・経験': 'ai_experience',
      '叶えたいこと':   'motivation',
      '申込URL':        'minutes_url',
      '申込状態':       'status',
      '登録状態':       null,
      'キャンセル':     null,
    },
  },
  {
    // AI CAMP 個別相談会申込者CSVエクスポート（旧フォーマット）
    matchHeaders: ['申込日時', '日程', '担当者', 'お名前', 'フリガナ', '参加URL', '参加状況', '成約状況', 'キャンセル理由'],
    targetTable: 'aicamp_consultations',
    reason: 'AI CAMP 個別相談会申込者CSVフォーマット（ルールベース判定）',
    mappings: {
      '申込日時':              null,              // 申込タイムスタンプは不要
      '日程':                  'consultation_date',
      '担当者':                'member_id',
      'お名前':                'name',
      'フリガナ':              null,
      'メールアドレス':        'email',
      '電話番号':              'phone',
      '性別':                  'customer_attribute',
      '年齢':                  'age',
      'ご職業':                'occupation',
      '現在の月収':            'monthly_income',
      'AIの知識・経験':        'ai_experience',
      '個別相談会で聞きたいこと': 'motivation',
      '参加URL':               'minutes_url',
      '参加状況':              'status',
      '成約状況':              null,              // 参加状況を優先
      'キャンセル理由':        'reason',
    },
  },
]

function normalizeHeader(h: string) {
  return h.trim().replace(/^["'\u201c\u201d]+|["'\u201c\u201d]+$/g, '').trim()
}

function detectKnownFormat(uploadedHeaders: string[]) {
  const normalizedSet = new Set(uploadedHeaders.map(normalizeHeader))
  return KNOWN_FORMATS.find(fmt =>
    fmt.matchHeaders.every(h => normalizedSet.has(h))
  ) ?? null
}
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { headers, sampleRows, allRows, defaultMemberId, members, forceTable } = await req.json()
  const memberList: { id: string; name: string }[] = members ?? []

  function resolveMemberId(nameVal: string): string | null {
    if (!nameVal) return defaultMemberId || null
    // 部分一致で検索（「白岩 聖悠(AIコンサルタント)」→「白岩」でも一致）
    const match = memberList.find(m =>
      nameVal.includes(m.name) || m.name.includes(nameVal) || nameVal === m.name
    )
    return match?.id ?? defaultMemberId ?? null
  }

  // ── 既知フォーマット判定（AIスキップ）──────────────────────────────────────
  const knownFmt = !forceTable ? detectKnownFormat(headers) : null
  let targetTable: string
  let reason: string
  let mappings: Record<string, string | null>
  let skipPatterns: string[] = []

  if (knownFmt) {
    targetTable = knownFmt.targetTable
    reason = knownFmt.reason
    mappings = knownFmt.mappings
  } else {
    // ── Claude にフォールバック ──────────────────────────────────────────────
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

## 重要なルール
- マッピング先フィールドは、選んだ targetTable のフィールドのみ使うこと
- 他テーブルのフィールド名（例: deals_tocの "contact"）を aicamp_consultations に使わないこと
- メールアドレス系は "email"、電話番号系は "phone" にマッピングすること（aicamp_consultationsの場合）

## 回答形式（JSON のみ返してください）
{
  "targetTable": "deals_toc | deals_tob | aicamp_consultations",
  "reason": "判断理由を一言で",
  "mappings": {
    "元の列名": "マッピング先フィールド名 または null（不要な列）"
  },
  "skipPatterns": ["スキップすべき行のパターン（例：テスト、#N/A）"]
}
${forceTable ? `\n重要: インポート先は必ず "${forceTable}" で固定してください。上記JSONの "targetTable" は必ず "${forceTable}" にしてください。` : ''}
`

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY が設定されていません' }, { status: 500 })
    }

    let text = ''
    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      })
      text = (message.content[0] as { type: string; text: string }).text
    } catch (e) {
      return NextResponse.json({ error: `Claude API エラー: ${String(e)}` }, { status: 500 })
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: `AI応答の解析に失敗しました: ${text.slice(0, 200)}` }, { status: 500 })

    const aiResult = JSON.parse(jsonMatch[0])
    targetTable = (forceTable && SCHEMAS[forceTable as keyof typeof SCHEMAS]) ? forceTable : aiResult.targetTable
    reason = aiResult.reason
    mappings = aiResult.mappings
    skipPatterns = forceTable ? [] : (aiResult.skipPatterns ?? [])
  }

  const schema = SCHEMAS[targetTable as keyof typeof SCHEMAS]
  if (!schema) return NextResponse.json({ error: '対応していないテーブルです' }, { status: 400 })

  // AIが他テーブルのフィールドを誤用した場合のガード
  const validFields = new Set(Object.keys(schema.fields))
  validFields.add('member_id') // 共通フィールド
  const sanitizedMappings: Record<string, string | null> = {}
  for (const [src, dst] of Object.entries(mappings)) {
    if (!dst || dst === 'null') { sanitizedMappings[src] = null; continue }
    sanitizedMappings[src] = validFields.has(dst as string) ? dst : null
  }
  mappings = sanitizedMappings

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

      // #N/A は全フィールドで空値扱い
      if (String(val) === '#N/A' || String(val) === 'N/A') continue

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

      // 日付フィールド（「2026/04/01(水) 19:00-20:00」など日本語混じり形式にも対応）
      if (['first_contact_date', 'last_contact_date', 'next_action_date', 'payment_date', 'reply_deadline', 'consultation_date', 'applied_at'].includes(field)) {
        const str = String(val)
        // YYYY/MM/DD または YYYY-MM-DD の日付部分だけ抽出
        const match = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
        if (match) {
          const y = match[1], m = match[2].padStart(2, '0'), d = match[3].padStart(2, '0')
          mapped[field] = `${y}-${m}-${d}`
        }
        continue
      }

      // ステータス正規化（前方一致も考慮：「ドタキャン（無断）」→「ドタキャン」）
      if (field === 'status') {
        const s = String(val)
        const exact = schema.statusMap[s]
        if (exact) {
          mapped[field] = exact
        } else {
          const partial = Object.keys(schema.statusMap).find(k => s.startsWith(k))
          mapped[field] = partial ? schema.statusMap[partial] : s
        }
        continue
      }

      // #N/A は空値として扱う
      const strVal = String(val)
      if (strVal === '#N/A' || strVal === 'N/A') continue

      mapped[field] = strVal
    }

    // 必須フィールドチェック（空行スキップ）
    if (targetTable === 'deals_toc' && !mapped.name) continue
    if (targetTable === 'deals_tob' && !mapped.company_name) continue
    // aicamp_consultations: 名前・LINE名・日付が全て空の行はスキップ
    if (targetTable === 'aicamp_consultations' && !mapped.name && !mapped.line_name && !mapped.consultation_date) continue
    // aicamp_consultations: 日付が両方未設定なら今日の日付をデフォルトで設定（月フィルターに引っかかるよう）
    if (targetTable === 'aicamp_consultations' && !mapped.consultation_date && !mapped.payment_date) {
      mapped.consultation_date = new Date().toISOString().slice(0, 10)
    }

    mappedRows.push(mapped)
  }

  // 重複検知：既存データと照合
  const dupKey = targetTable === 'deals_tob' ? 'company_name'
    : targetTable === 'deals_toc' ? 'name'
    : 'name' // aicamp_consultations
  const keyValues = mappedRows.map(r => r[dupKey]).filter(Boolean) as string[]

  let duplicateKeys = new Set<string>()
  if (keyValues.length > 0) {
    const { data: existing } = await supabase
      .from(targetTable)
      .select(dupKey === 'name' && targetTable === 'aicamp_consultations'
        ? 'name, consultation_date'
        : dupKey)
      .in(dupKey, keyValues)
    if (existing && existing.length > 0) {
      duplicateKeys = new Set((existing as unknown as Record<string, unknown>[]).map(r => String(r[dupKey] ?? '')))
    }
  }

  const rowsWithDupFlag = mappedRows.map(r => ({
    ...r,
    _isDuplicate: duplicateKeys.has(String(r[dupKey] ?? '')),
  }))

  const duplicateCount = rowsWithDupFlag.filter(r => r._isDuplicate).length

  return NextResponse.json({
    targetTable,
    targetLabel: schema.label,
    reason,
    mappings,
    preview: rowsWithDupFlag.slice(0, 5),
    totalRows: rowsWithDupFlag.length,
    skippedCount: skipped.length,
    duplicateCount,
    rows: rowsWithDupFlag,
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
    // _isDuplicate フラグはDBに送らない
    const { _isDuplicate, ...cleanRow } = row as Record<string, unknown> & { _isDuplicate?: boolean }
    const { error } = await supabase.from(targetTable).insert(cleanRow)
    if (error) results.errors.push(error.message)
    else results.inserted++
  }
  return NextResponse.json(results)
}
