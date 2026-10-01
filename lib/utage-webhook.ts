import type { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

// UTAGE のアクション（Webhook）から呼ばれる /api/webhooks/utage-* 共通処理。
// ログインセッションは無いので getAuthUser ではなく URL の ?token= を UTAGE_WEBHOOK_SECRET と照合する。

export function verifyWebhookToken(req: NextRequest): boolean {
  const secret = process.env.UTAGE_WEBHOOK_SECRET
  const token = req.nextUrl.searchParams.get('token')
  if (!secret || !token) return false
  const a = Buffer.from(token)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

// RLS 有効テーブルへ書くため Service Role 必須（anon へのフォールバックはしない）
export function createWebhookAdminClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  })
}

// 置き換え文字が埋まらなかった場合（LINE未連携の申込者など）に「%line_id%」がそのまま届くことがあるので空扱い
function field(v: string): string {
  const t = v.trim()
  return /^%[a-z0-9_]+%$/i.test(t) ? '' : t
}

// UTAGE は form-urlencoded で送る。JSON で送る設定にも対応しておく
export async function readWebhookBody(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get('content-type') ?? ''
  let entries: [string, string][] = []
  if (contentType.includes('application/json')) {
    const json = await req.json().catch(() => ({}))
    entries = Object.entries(json ?? {}).map(([k, v]) => [k, v == null ? '' : String(v)])
  } else {
    const form = await req.formData().catch(() => null)
    if (form) entries = Array.from(form.entries()).map(([k, v]) => [k, typeof v === 'string' ? v : ''])
  }
  return Object.fromEntries(entries.map(([k, v]) => [k, field(v)]))
}
