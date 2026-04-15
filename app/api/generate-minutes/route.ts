import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-check'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  if (!await getAuthUser(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { raw_text } = await req.json()

  if (!raw_text?.trim()) {
    return NextResponse.json({ error: 'raw_text is required' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `以下の商談メモを、読みやすい議事録形式に整形してください。
以下の構造で出力してください（項目がない場合は省略可）:

## 出席者
## 議題
## 決定事項
## 次回アクション

---
${raw_text}
---

余計な説明は不要です。議事録本文のみ出力してください。`,
    }],
  })

  const minutes = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ minutes })
}
