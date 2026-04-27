import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth-check'
import type { AICampConsultation } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function normalize(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .trim()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
}

export async function POST(req: NextRequest) {
  if (!await getAuthUser(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { records }: { records: AICampConsultation[] } = await req.json()
  if (!records || records.length === 0) return NextResponse.json({ pairs: [] })

  const pairSet = new Set<string>()
  type RawPair = { idA: string; idB: string; reason: string; confidence: 'high' | 'medium' }
  const rawPairs: RawPair[] = []

  // ── ローカル正規化による明らかな重複検出 ────────────────────────────
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i]
      const b = records[j]

      const aNorm = normalize(a.name) || normalize(a.line_name)
      const bNorm = normalize(b.name) || normalize(b.line_name)
      if (!aNorm || !bNorm || aNorm !== bNorm) continue

      const key = [a.id, b.id].sort().join('::')
      if (pairSet.has(key)) continue
      pairSet.add(key)
      rawPairs.push({
        idA: a.id,
        idB: b.id,
        reason: `氏名の正規化後が完全一致（${a.name ?? a.line_name} / ${b.name ?? b.line_name}）`,
        confidence: 'high',
      })
    }
  }

  // ── Claude によるファジーマッチング ──────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    // APIキーがない場合はローカル結果だけ返す
    return buildResponse(rawPairs, records)
  }

  const slimRecords = records.map(r => ({
    id: r.id,
    name: r.name ?? null,
    line_name: r.line_name ?? null,
    consultation_date: r.consultation_date ?? null,
    age: r.age ?? null,
    occupation: r.occupation ?? null,
  }))

  const BATCH_SIZE = 50
  for (let i = 0; i < slimRecords.length; i += BATCH_SIZE) {
    const batch = slimRecords.slice(i, i + BATCH_SIZE)
    const prompt = `
以下は営業管理システムの顧客・商談レコード一覧です。
名前のスペース差異、ひらがな/カタカナ/漢字の表記ゆれなどを考慮して、
「同一人物と思われる重複レコードのペア」を特定してください。

## 判定基準
- high: 名前が実質的に同一（スペース差異・送り仮名のみの差異・ひらがな↔カタカナなど）
- medium: 名前が類似しており同一人物の可能性が高い（漢字とよみがなの組み合わせなど）
- 同一日付・同一年齢・同一職業の組み合わせも補助情報として使用すること
- 明らかに別人のペアは含めないこと

## レコード一覧
${JSON.stringify(batch, null, 2)}

## 回答形式（JSONのみ、説明文不要）
{
  "pairs": [
    { "idA": "uuid", "idB": "uuid", "reason": "理由（日本語）", "confidence": "high" }
  ]
}
`
    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = (message.content[0] as { type: string; text: string }).text
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) continue
      const result = JSON.parse(jsonMatch[0])
      if (!Array.isArray(result.pairs)) continue
      for (const p of result.pairs) {
        const key = [p.idA, p.idB].sort().join('::')
        if (pairSet.has(key)) continue
        pairSet.add(key)
        rawPairs.push(p)
      }
    } catch {
      // バッチエラーは無視して続行
    }
  }

  return buildResponse(rawPairs, records)
}

function buildResponse(rawPairs: { idA: string; idB: string; reason: string; confidence: 'high' | 'medium' }[], records: AICampConsultation[]) {
  const recordMap = new Map(records.map(r => [r.id, r]))
  const pairs = rawPairs
    .map(p => {
      const recordA = recordMap.get(p.idA)
      const recordB = recordMap.get(p.idB)
      if (!recordA || !recordB) return null
      return { recordA, recordB, reason: p.reason, confidence: p.confidence }
    })
    .filter(Boolean)
  return NextResponse.json({ pairs })
}

// ── マージ実行 ────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  if (!await getAuthUser(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { keepId, deleteId }: { keepId: string; deleteId: string } = await req.json()
  if (!keepId || !deleteId || keepId === deleteId) {
    return NextResponse.json({ error: '無効なリクエスト' }, { status: 400 })
  }

  const [{ data: keepRecord, error: keepErr }, { data: deleteRecord, error: deleteErr }] =
    await Promise.all([
      supabase.from('aicamp_consultations').select('*').eq('id', keepId).single(),
      supabase.from('aicamp_consultations').select('*').eq('id', deleteId).single(),
    ])

  if (keepErr || !keepRecord) {
    return NextResponse.json({ error: `残存レコードが見つかりません: ${keepErr?.message}` }, { status: 404 })
  }
  if (deleteErr || !deleteRecord) {
    return NextResponse.json({ error: `削除対象レコードが見つかりません: ${deleteErr?.message}` }, { status: 404 })
  }

  const SKIP_FIELDS = new Set(['id', 'created_at', 'updated_at', 'member'])
  const updatePayload: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(deleteRecord as Record<string, unknown>)) {
    if (SKIP_FIELDS.has(key)) continue
    if (val === null || val === undefined || val === '') continue
    const keepVal = (keepRecord as Record<string, unknown>)[key]
    if (keepVal === null || keepVal === undefined || keepVal === '') {
      updatePayload[key] = val
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error: updateErr } = await supabase
      .from('aicamp_consultations')
      .update(updatePayload)
      .eq('id', keepId)
    if (updateErr) {
      return NextResponse.json({ error: `更新エラー: ${updateErr.message}` }, { status: 500 })
    }
  }

  const { error: delErr } = await supabase
    .from('aicamp_consultations')
    .delete()
    .eq('id', deleteId)
  if (delErr) {
    return NextResponse.json({ error: `削除エラー: ${delErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
