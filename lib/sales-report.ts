// Slack「#101_2c_営業成果報告部屋」の商談報告（■項目：値）を読み取る。
//   ■商談日：2026/10/02
//   ■担当者：佐々木
//   ■お客様名：山田 太郎 様
//   ■商談結果：成約｜保留｜失注｜キャンセル｜ドタキャン
//   ■金額：550,000円           （成約のみ）
//   ■決済方法：Stripe一括｜Stripe分割｜銀行振込｜その他
//   ■分割回数：12               （分割のみ）
//   ■次回日程：2026/10/05 19:00 （保留・再商談のみ）
//   ■理由：自由記述（複数行可）

export type SalesReport = {
  date: string | null          // YYYY-MM-DD
  member: string | null
  customer: string | null
  status: string | null        // CONSULTATION_STATUSES のどれか
  amount: number | null        // 円
  paymentMethod: string | null // PAYMENT_METHODS のどれか
  paymentCount: number | null
  nextDate: string | null      // YYYY-MM-DD
  reason: string | null
  problems: string[]           // 読み取れなかった項目（スレッド返信で知らせる）
}

const toHalf = (s: string) =>
  s.replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/，/g, ',')

// Slack のメッセージ本文を「項目名 → 値」にする。■ の無い行は直前の項目の続き（理由の改行など）
function fields(text: string): Map<string, string> {
  const map = new Map<string, string>()
  let current: string | null = null
  for (const raw of text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').split('\n')) {
    const m = raw.match(/^\s*[■【]\s*([^：:】]+?)\s*[：:】]\s*(.*)$/)
    if (m) {
      current = m[1].replace(/\s/g, '')
      map.set(current, m[2].trim())
    } else if (current) {
      map.set(current, `${map.get(current)}\n${raw.trim()}`.trim())
    }
  }
  return map
}

function parseDate(v: string | undefined, base?: string | null): string | null {
  if (!v) return null
  const s = toHalf(v)
  const full = s.match(/(\d{4})\s*[/\-年.]\s*(\d{1,2})\s*[/\-月.]\s*(\d{1,2})/)
  const md = full ? null : s.match(/(\d{1,2})\s*[/月]\s*(\d{1,2})/)
  if (!full && !md) return null
  const pad = (n: string) => n.padStart(2, '0')
  if (full) return `${full[1]}-${pad(full[2])}-${pad(full[3])}`
  // 年が無い（「10/5 19:00」）ときは商談日の年。商談日より前の月日なら翌年
  const year = Number((base ?? new Date().toISOString()).slice(0, 4))
  let d = `${year}-${pad(md![1])}-${pad(md![2])}`
  if (base && d < base) d = `${year + 1}-${pad(md![1])}-${pad(md![2])}`
  return d
}

// 先頭の語で判定（「保留（24日クロージング）」→ 保留）。補足は理由に回す
function parseStatus(v: string | undefined): string | null {
  if (!v) return null
  const s = v.trim()
  // 誤字（「集注」など）は成約／失注どちらか分からないので読まずに聞き返す
  if (/^(成約|受注)/.test(s)) return '成約'
  if (/^保留|^再商談/.test(s)) return '保留'
  if (/^失注/.test(s)) return '失注'
  if (/^ドタキャン|^無断/.test(s)) return 'ドタキャン'
  if (/^キャンセル/.test(s)) return 'キャンセル'
  if (/^クーリングオフ/.test(s)) return 'クーリングオフ'
  return null
}

function parsePayment(v: string | undefined): string | null {
  if (!v || /^(未定|なし|-|ー)/.test(v.trim())) return null
  const s = toHalf(v).toLowerCase()
  if (/分割/.test(s)) return 'stripe(分割)'
  if (/振込|振り込み/.test(s)) return '銀行振込'
  if (/stripe|ストライプ|クレカ|カード|一括/.test(s)) return 'stripe(一括)'
  if (/^その他/.test(s)) return 'その他'
  return null
}

// 「550,000円」「55万円」「55.5万」→ 円
function parseAmount(v: string | undefined): number | null {
  if (!v) return null
  const s = toHalf(v).replace(/,/g, '')
  const man = s.match(/(\d+(?:\.\d+)?)\s*万/)
  if (man) return Math.round(Number(man[1]) * 10000)
  const yen = s.match(/\d+/)
  return yen ? Number(yen[0]) : null
}

export function isSalesReport(text: string): boolean {
  return /[■【]\s*商談日/.test(text) && /[■【]\s*商談結果/.test(text)
}

export function parseSalesReport(text: string): SalesReport {
  const f = fields(text)
  const problems: string[] = []
  const date = parseDate(f.get('商談日'))
  const statusRaw = f.get('商談結果')
  const status = parseStatus(statusRaw)
  const paymentRaw = f.get('決済方法')
  const paymentMethod = parsePayment(paymentRaw)
  const customer = (f.get('お客様名') ?? '').replace(/様$/, '').trim() || null

  if (!date) problems.push('商談日（2026/10/02 の形で）')
  if (!customer) problems.push('お客様名')
  if (!status) problems.push(`商談結果「${statusRaw ?? ''}」（成約／保留／失注／キャンセル／ドタキャン のどれか）`)
  if (paymentRaw && !/^(未定|なし|-|ー)/.test(paymentRaw.trim()) && !paymentMethod) problems.push(`決済方法「${paymentRaw}」（Stripe一括／Stripe分割／銀行振込／その他 のどれか）`)

  // 商談結果に付いた補足（「保留（24日クロージング）」の括弧内）は理由の先頭に残す
  const statusNote = statusRaw?.replace(/^[^（(]*/, '').replace(/^[（(]|[）)]$/g, '').trim()
  const reason = [statusNote, f.get('理由') ?? f.get('商談結果に至った理由')].filter(Boolean).join('\n') || null

  return {
    date,
    member: f.get('担当者')?.trim() || null,
    customer,
    status,
    amount: parseAmount(f.get('金額')),
    paymentMethod,
    paymentCount: parseAmount(f.get('分割回数')),
    nextDate: parseDate(f.get('次回日程'), date),
    reason,
    problems,
  }
}
