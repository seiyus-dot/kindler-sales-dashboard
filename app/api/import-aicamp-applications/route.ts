import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim() })
    return row
  })
}

function mapStatus(s: string): string {
  if (s === '確定') return '受注'
  if (s === '入金待ち') return '保留'
  if (s === 'キャンセル') return '失注'
  return '保留'
}

export async function POST(req: NextRequest) {
  const { csv, defaultMemberId } = await req.json()
  if (!csv) return NextResponse.json({ error: 'CSVが空です' }, { status: 400 })

  const rows = parseCSV(csv)
  const results = { inserted: 0, skipped: 0, errors: [] as string[] }

  for (const row of rows) {
    const name = row['氏名'] || row['名前'] || ''
    if (!name || name === 'テスト' || name === 'テスト太郎') {
      results.skipped++
      continue
    }

    const appliedAt = row['申込日時']?.slice(0, 10) || null
    const schedule = row['参加日程'] || ''
    const paymentMethod = row['支払方法'] || null
    const noteParts = [
      schedule ? `参加日程: ${schedule}` : '',
      paymentMethod ? `支払方法: ${paymentMethod}` : '',
      row['PaymentIntent ID'] ? `PaymentIntent: ${row['PaymentIntent ID']}` : '',
      row['契約書URL'] ? `契約書: ${row['契約書URL']}` : '',
    ].filter(Boolean)

    const payload = {
      name,
      contact: row['メール'] || null,
      service: 'Product AI CAMP',
      status: mapStatus(row['ステータス'] ?? ''),
      first_contact_date: appliedAt,
      member_id: defaultMemberId || null,
      notes: noteParts.join(' / ') || null,
      source: '申込フォーム',
    }

    const { error } = await supabase.from('deals_toc').insert(payload)
    if (error) results.errors.push(`${name}: ${error.message}`)
    else results.inserted++
  }

  return NextResponse.json(results)
}
