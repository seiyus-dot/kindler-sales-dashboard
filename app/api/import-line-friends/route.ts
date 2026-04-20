import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.slice(7)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { records } = await request.json() as { records: Record<string, string | null>[] }

  const { data: existing } = await supabase.from('line_friends').select('line_user_id')
  const existingIds = new Set((existing ?? []).map((r: { line_user_id: string }) => r.line_user_id))
  const newRecords = records.filter(r => r.line_user_id && !existingIds.has(r.line_user_id as string))
  const updateRecords = records.filter(r => r.line_user_id && existingIds.has(r.line_user_id as string))

  if (newRecords.length > 0) {
    const { error } = await supabase.from('line_friends').insert(newRecords)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  for (const r of updateRecords) {
    await supabase.from('line_friends').update({
      line_display_name: r.line_display_name,
      status: r.status,
      registration_source: r.registration_source,
      blocked_at: r.blocked_at,
      registered_at: r.registered_at,
    }).eq('line_user_id', r.line_user_id as string)
  }

  return NextResponse.json({ added: newRecords.length, updated: updateRecords.length })
}
