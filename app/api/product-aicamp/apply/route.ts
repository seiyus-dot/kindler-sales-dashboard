import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { name, phone, email, session_id } = await request.json()

    if (!name || !phone || !email || !session_id) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const { error } = await getSupabase().from('product_aicamp_customers').insert({
      name:       name.trim(),
      phone:      phone.trim(),
      email:      email.trim(),
      session_id,
      status:     '申込済',
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '送信に失敗しました' }, { status: 500 })
  }
}
