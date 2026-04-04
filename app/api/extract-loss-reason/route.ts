import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { notes, dealContext } = await req.json()

  if (!notes?.trim()) {
    return NextResponse.json({ error: 'notes is required' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `営業案件の議事録・メモを分析し、失注理由を構造化してください。

案件情報: ${dealContext}

議事録・メモ:
${notes}

以下のJSON形式のみで回答してください（説明文不要）:
{
  "category": "失注理由カテゴリ（価格/競合他社/タイミング/ニーズ不一致/予算不足/社内決裁/その他 から1つ選択）",
  "detail": "失注の具体的な理由（1〜2文で簡潔に）",
  "insights": ["次回に向けた改善アクション案1", "改善アクション案2"]
}`
    }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ category: 'その他', detail: text, insights: [] })
  }
}
