'use client'

/**
 * 自由明細の請求書発行（/invoices）
 *
 * 契約（contracts）に紐づかない実費・スポット請求のための画面。
 * 交通費や出張対応費のように単価・単位が固定できない請求はこちらで作る。
 * 取引先は clients マスタではなく MF の取引先から直接選ぶ
 * （MFには居るが clients に無い取引先が実在するため）。
 */
import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import { FileText, Plus, Trash2, Search, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react'

type Partner = { id: string; name: string; name_kana: string | null; department_id: string }
type Row = { name: string; quantity: string; unit: string; unitPrice: string }

const BLANK_ROW: Row = { name: '', quantity: '1', unit: '式', unitPrice: '' }

function todayJST(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

/** 当月末（YYYY-MM-DD）。支払期日の既定値に使う */
function endOfThisMonthJST(): string {
  const d = new Date(Date.now() + 9 * 3600_000)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
}

const yen = (n: number) => n.toLocaleString('ja-JP')

export default function InvoicesPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loadingPartners, setLoadingPartners] = useState(true)
  const [partnerQuery, setPartnerQuery] = useState('')
  const [partner, setPartner] = useState<Partner | null>(null)

  const [title, setTitle] = useState('')
  const [billingDate, setBillingDate] = useState(todayJST())
  const [dueDate, setDueDate] = useState(endOfThisMonthJST())
  const [salesDate, setSalesDate] = useState(todayJST())
  const [memo, setMemo] = useState('')
  const [rows, setRows] = useState<Row[]>([{ ...BLANK_ROW }])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ invoiceId: string; pdfUrl: string | null } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/mf/partners')
        const json = await res.json()
        if (!json.ok) throw new Error(json.error ?? '取引先の取得に失敗しました')
        setPartners(json.partners)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoadingPartners(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    const q = partnerQuery.trim().toLowerCase()
    if (!q) return partners.slice(0, 30)
    return partners
      .filter(p => p.name.toLowerCase().includes(q) || (p.name_kana ?? '').toLowerCase().includes(q))
      .slice(0, 30)
  }, [partners, partnerQuery])

  // 税抜合計→消費税→税込。MFは税抜単価×数量で計算するので画面もそれに合わせる。
  const totals = useMemo(() => {
    const excl = rows.reduce((s, r) => {
      const q = parseFloat(r.quantity) || 0
      const p = parseFloat(r.unitPrice) || 0
      return s + Math.round(q * p)
    }, 0)
    const tax = Math.floor(excl * 0.1)
    return { excl, tax, incl: excl + tax }
  }, [rows])

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const canSubmit =
    !!partner &&
    title.trim() !== '' &&
    rows.length > 0 &&
    rows.every(r => r.name.trim() !== '' && (parseFloat(r.quantity) || 0) > 0 && r.unitPrice !== '') &&
    !submitting

  async function submit() {
    if (!partner) return
    const ok = window.confirm(
      `${partner.name} 宛に請求書を作成します。\n\n件名: ${title}\n請求額: ${yen(totals.incl)}円（税込）\n支払期日: ${dueDate}\n\nマネーフォワードに実際の請求書が作られます。よろしいですか？`
    )
    if (!ok) return

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/mf/billings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerDepartmentId: partner.department_id,
          title: title.trim(),
          billingDate,
          dueDate,
          salesDate,
          memo,
          items: rows.map(r => ({
            name: r.name.trim(),
            quantity: parseFloat(r.quantity),
            unit: r.unit.trim() || '式',
            unitPrice: parseFloat(r.unitPrice),
          })),
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? '請求書の作成に失敗しました')
      setResult({ invoiceId: json.invoiceId, pdfUrl: json.pdfUrl })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setResult(null)
    setTitle('')
    setMemo('')
    setRows([{ ...BLANK_ROW }])
  }

  if (result) {
    return (
      <div>
        <PageHeader title="請求書発行" sub="契約に紐づかない実費・スポット請求" />
        <div className="max-w-2xl bg-white rounded-xl border border-[#e0e6f0] p-8">
          <h2 className="text-lg font-bold text-navy mb-2">請求書を作成しました</h2>
          <p className="text-sm text-gray-500 mb-6">マネーフォワードに登録されました。内容を確認してから送付してください。</p>
          <dl className="text-sm space-y-2 mb-6">
            <div className="flex gap-3"><dt className="w-24 text-gray-400">請求書ID</dt><dd className="font-mono text-xs">{result.invoiceId}</dd></div>
            <div className="flex gap-3"><dt className="w-24 text-gray-400">請求額</dt><dd className="font-bold">{yen(totals.incl)}円（税込）</dd></div>
          </dl>
          <div className="flex gap-3">
            {result.pdfUrl && (
              <a href={result.pdfUrl} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-[#16305c]">
                <ExternalLink size={15} /> PDFを開く
              </a>
            )}
            <button onClick={reset} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              続けて作成する
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="請求書発行" sub="契約に紐づかない実費・スポット請求" />

      {error && (
        <div className="max-w-4xl mb-5 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap">{error}</span>
        </div>
      )}

      <div className="max-w-4xl space-y-5">
        {/* 取引先 */}
        <section className="bg-white rounded-xl border border-[#e0e6f0] p-5">
          <h2 className="text-sm font-bold text-navy mb-3">取引先</h2>
          {partner ? (
            <div className="flex items-center justify-between gap-3 bg-navy/5 rounded-lg px-4 py-3">
              <span className="font-semibold text-navy">{partner.name}</span>
              <button onClick={() => setPartner(null)} className="text-xs text-gray-500 hover:text-navy underline">変更</button>
            </div>
          ) : (
            <>
              <div className="relative mb-3">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9" placeholder="取引先名で検索（部分一致）"
                       value={partnerQuery} onChange={e => setPartnerQuery(e.target.value)} />
              </div>
              {loadingPartners ? (
                <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> 取引先を読み込み中…</p>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
                  {filtered.length === 0 && <p className="text-sm text-gray-400 px-4 py-3">該当する取引先がありません</p>}
                  {filtered.map(p => (
                    <button key={p.id} onClick={() => setPartner(p)}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-navy/5 transition-colors">
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* 基本情報 */}
        <section className="bg-white rounded-xl border border-[#e0e6f0] p-5">
          <h2 className="text-sm font-bold text-navy mb-3">基本情報</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">件名</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)}
                     placeholder="例：AI顧問 訪問交通費・出張対応費 御請求書" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">請求日</label>
                <input type="date" className="input" value={billingDate} onChange={e => setBillingDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">支払期日</label>
                <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">売上計上日</label>
                <input type="date" className="input" value={salesDate} onChange={e => setSalesDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">備考（任意）</label>
              <input className="input" value={memo} onChange={e => setMemo(e.target.value)}
                     placeholder="例：5月13日・5月27日・7月29日 訪問分" />
            </div>
          </div>
        </section>

        {/* 明細 */}
        <section className="bg-white rounded-xl border border-[#e0e6f0] p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-navy">明細</h2>
            <p className="text-xs text-gray-400">単価は税抜。消費税10%を別途加算します</p>
          </div>

          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-12 sm:col-span-6">
                  <input className="input" placeholder="品目名" value={row.name}
                         onChange={e => updateRow(i, { name: e.target.value })} />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <input className="input text-right font-mono" placeholder="数量" value={row.quantity}
                         onChange={e => updateRow(i, { quantity: e.target.value })} />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <input className="input text-center" placeholder="単位" value={row.unit}
                         onChange={e => updateRow(i, { unit: e.target.value })} />
                </div>
                <div className="col-span-5 sm:col-span-3">
                  <input className="input text-right font-mono" placeholder="単価（税抜）" value={row.unitPrice}
                         onChange={e => updateRow(i, { unitPrice: e.target.value })} />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button onClick={() => setRows(rs => rs.filter((_, idx) => idx !== i))}
                          disabled={rows.length === 1}
                          className="p-2 text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-300">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setRows(rs => [...rs, { ...BLANK_ROW }])}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
            <Plus size={15} /> 明細を追加
          </button>

          <div className="mt-5 pt-4 border-t border-gray-100 flex justify-end">
            <dl className="text-sm space-y-1.5 w-56">
              <div className="flex justify-between"><dt className="text-gray-500">小計（税抜）</dt><dd className="font-mono">{yen(totals.excl)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">消費税（10%）</dt><dd className="font-mono">{yen(totals.tax)}</dd></div>
              <div className="flex justify-between text-base font-bold text-navy pt-1.5 border-t border-gray-100">
                <dt>請求額</dt><dd className="font-mono">{yen(totals.incl)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3 pb-8">
          <p className="text-xs text-gray-400">マネーフォワードに実際の請求書が作成されます</p>
          <button onClick={submit} disabled={!canSubmit}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-navy text-white text-sm font-bold hover:bg-[#16305c] disabled:opacity-40 disabled:cursor-not-allowed">
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            {submitting ? '作成中…' : '請求書を作成'}
          </button>
        </div>
      </div>
    </div>
  )
}
