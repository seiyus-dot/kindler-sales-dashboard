import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ error: 'SLACK_WEBHOOK_URL が設定されていません' }, { status: 500 })
  }

  const { message } = await req.json()
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'message は必須です' }, { status: 400 })
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  })

  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json({ error: `Slack への送信に失敗しました: ${body}` }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
