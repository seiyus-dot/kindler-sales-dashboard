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
      result.push(current)
      current = ''
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

export async function POST(req: NextRequest) {
  const { csv, defaultMemberId, dealType } = await req.json()
  const table = dealType === 'tob' ? 'deals_tob' : 'deals_toc'

  if (!csv) return NextResponse.json({ error: 'CSVが空です' }, { status: 400 })

  const rows = parseCSV(csv)
  const results = { inserted: 0, updated: 0, errors: [] as string[] }

  for (const row of rows) {
    try {
      const stripeSubId = row['id']
      if (!stripeSubId) continue

      const cancelAtPeriodEnd = row['Cancel At Period End'] === 'TRUE'
      const canceledAt = row['Canceled At (UTC)']?.slice(0, 10) || null
      const endedAt = row['Ended At (UTC)']?.slice(0, 10) || null

      // 解約済み（期間終了）はスキップ
      if (endedAt) continue

      const status = '契約中'
      const contractEnd = canceledAt || null
      const monthlyAmount = row['Amount'] ? parseInt(row['Amount']) : null

      let notes = row['Cancellation Feedback'] || ''
      if (cancelAtPeriodEnd) {
        notes = ['解約申請済み（期間終了後に解約）', notes].filter(Boolean).join(' / ')
      }

      const customerName = row['Customer Name'] || '（名前未設定）'
      const basePayload = {
        deal_type: 'subscription',
        stripe_subscription_id: stripeSubId,
        stripe_customer_id: row['Customer ID'] || null,
        service: row['Product'] || null,
        monthly_amount: monthlyAmount,
        contract_start: row['Start Date (UTC)']?.slice(0, 10) || null,
        contract_end: contractEnd,
        status,
        payment_status: '正常',
        member_id: defaultMemberId || null,
        notes: notes || null,
      }

      const payload = dealType === 'tob'
        ? { ...basePayload, company_name: customerName, contact_name: null }
        : { ...basePayload, name: customerName, contact: row['Customer Email'] || null }

      // stripe_subscription_id で既存チェック
      const { data: existing } = await supabase
        .from(table)
        .select('id')
        .eq('stripe_subscription_id', stripeSubId)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase.from(table).update(payload).eq('id', existing.id)
        if (error) results.errors.push(`${customerName}: ${error.message}`)
        else results.updated++
      } else {
        const { error } = await supabase.from(table).insert(payload)
        if (error) results.errors.push(`${customerName}: ${error.message}`)
        else results.inserted++
      }
    } catch (e) {
      results.errors.push(`行の処理に失敗: ${String(e)}`)
    }
  }

  return NextResponse.json(results)
}
