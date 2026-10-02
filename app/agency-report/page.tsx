'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Pencil, Check, X, Loader2, ShieldCheck } from 'lucide-react'
import PageHeader from '@/components/PageHeader'

// 広告代理店向けレポート。自社分の集計だけを表示する（申込者の氏名などは出さない）。
// データは /api/agency-report が権限を確認したうえで集計して返す。

type Totals = { spend: number; list_count: number; consultations: number; seated: number; won: number; cancelled: number; pending: number }
type Week = {
  week_start: string; week_end: string; spend: number; list_count: number | null
  consultations: number; seated: number; won: number; cancelled: number; spend_id?: string; notes?: string | null
}
type AdSet = { name: string; spend: number; list_count: number; consultations: number; won: number }
type Report = {
  month: string
  agencies: { slug: string; name: string; uses_fb_ads: boolean }[]
  agency: { slug: string; name: string; uses_fb_ads: boolean }
  canSwitch: boolean
  totals: Totals
  weeks: Week[]
  adSets: AdSet[]
}

const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`
const per = (num: number, den: number) => (den > 0 ? num / den : null)
const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const unit = (spend: number, count: number) => (count > 0 ? yen(spend / count) : '—')
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
const thisMonth = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7)

export default function AgencyReportPage() {
  const [month, setMonth] = useState(thisMonth())
  const [agency, setAgency] = useState<string>('')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ spend: '', list_count: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    const q = new URLSearchParams({ month, ...(agency ? { agency } : {}) })
    const res = await fetch(`/api/agency-report?${q}`)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'レポートを読み込めませんでした')
      setReport(null)
    } else {
      setReport(json)
      if (!agency) setAgency(json.agency.slug)
    }
    setLoading(false)
  }, [month, agency])

  useEffect(() => { fetchReport() }, [fetchReport])

  function startEdit(w: Week) {
    setEditing(w.week_start)
    setDraft({ spend: w.spend ? String(w.spend) : '', list_count: w.list_count == null ? '' : String(w.list_count), notes: w.notes ?? '' })
  }

  async function saveWeek(w: Week) {
    if (!report) return
    if (draft.spend === '' || Number(draft.spend) < 0) { alert('広告費を入力してください'); return }
    setSaving(true)
    const res = await fetch('/api/agency-report', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agency: report.agency.slug, week_start: w.week_start, week_end: w.week_end,
        spend: Number(draft.spend), list_count: draft.list_count === '' ? null : Number(draft.list_count), notes: draft.notes,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { alert(`保存できませんでした: ${json.error ?? res.status}`); return }
    setEditing(null)
    fetchReport()
  }

  const t = report?.totals
  const stages = t ? [
    { label: '広告費', value: yen(t.spend), rate: null as string | null },
    { label: 'リスト', value: `${t.list_count.toLocaleString('ja-JP')}件`, rate: null },
    { label: '面談', value: `${t.consultations}件`, rate: pct(per(t.consultations, t.list_count)) },
    { label: '着座', value: `${t.seated}件`, rate: pct(per(t.seated, t.consultations)) },
    { label: '成約', value: `${t.won}件`, rate: pct(per(t.won, t.seated)) },
  ] : []

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <PageHeader
        title="広告レポート"
        sub={report ? `${report.agency.name} · ${Number(month.slice(5))}月` : '代理店別の集客〜成約の集計'}
        right={
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input !w-auto text-sm" aria-label="対象月" />
        }
      />

      {report?.canSwitch && report.agencies.length > 1 && (
        <div className="inline-flex bg-white border border-[#e0e6f0] rounded-xl p-1 mb-5">
          {report.agencies.map(a => (
            <button
              key={a.slug}
              onClick={() => { setEditing(null); setAgency(a.slug) }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                a.slug === report.agency.slug ? 'bg-[#1a3a6e] text-white shadow-sm' : 'text-slate-500 hover:text-[#1a3a6e]'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {loading && !report && (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-20 justify-center"><Loader2 size={16} className="animate-spin" />読み込み中</div>
      )}
      {error && <div className="bg-white border border-red-200 text-red-600 rounded-xl px-5 py-4 text-sm">{error}</div>}

      {report && t && (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {/* 集客〜成約の流れ */}
          <section className="bg-white rounded-2xl border border-[#e0e6f0] overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#1a3a6e] via-[#1a3a6e] to-[#b8902a]" />
            <div className="px-5 lg:px-7 pt-5 pb-6">
              <p className="text-[11px] font-bold tracking-[0.15em] text-[#b8902a] mb-4">FUNNEL</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-y-5">
                {stages.map((s, i) => (
                  <div key={s.label} className="relative flex items-stretch">
                    {i > 0 && (
                      <div className="hidden sm:flex flex-col items-center justify-center w-14 shrink-0 -ml-2 mr-1">
                        <ChevronRight size={18} className="text-slate-300" />
                        {s.rate && <span className="text-[11px] font-semibold text-[#1a3a6e] tabular-nums whitespace-nowrap">{s.rate}</span>}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400 mb-1">{s.label}</p>
                      <p className={`font-bold tabular-nums tracking-tight text-[#1a2540] ${i === 0 ? 'text-xl lg:text-2xl' : 'text-2xl lg:text-3xl'}`}>{s.value}</p>
                      {s.rate && <p className="sm:hidden text-[11px] text-[#1a3a6e] font-semibold mt-0.5">前段から {s.rate}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-dashed border-[#e0e6f0] grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'リスト獲得単価', value: unit(t.spend, t.list_count) },
                  { label: '面談単価', value: unit(t.spend, t.consultations) },
                  { label: '着座単価', value: unit(t.spend, t.seated) },
                  { label: '成約単価', value: unit(t.spend, t.won) },
                ].map(k => (
                  <div key={k.label}>
                    <p className="text-xs text-slate-400">{k.label}</p>
                    <p className="text-lg font-bold tabular-nums text-[#1a2540]">{k.value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400">
                キャンセル・ドタキャン {t.cancelled}件（{pct(per(t.cancelled, t.consultations))}）· 結果待ち（予定・保留）{t.pending}件
              </p>
            </div>
          </section>

          {/* 週別 */}
          <section className="bg-white rounded-2xl border border-[#e0e6f0] overflow-hidden">
            <div className="px-5 lg:px-7 py-4 border-b border-[#eef1f7] flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-[#1a2540]">週別の推移</h2>
              <span className="text-xs text-slate-400">
                {report.agency.uses_fb_ads ? '広告費・リストは広告管理画面から自動連携' : '広告費・リストは各週の「編集」から入力'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 bg-[#f8f9fc]">
                    {['週', '広告費', 'リスト', '面談', '着座', '成約', 'キャンセル', ''].map(h => (
                      <th key={h} className={`px-4 py-2.5 font-semibold whitespace-nowrap ${h === '週' || h === '' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.weeks.map(w => {
                    const isEditing = editing === w.week_start
                    return (
                      <tr key={w.week_start} className={`border-t border-[#eef1f7] ${isEditing ? 'bg-[#f4f6fb]' : 'hover:bg-[#fafbfd]'}`}>
                        <td className="px-4 py-3 whitespace-nowrap text-[#1a2540] font-medium">{md(w.week_start)}〜{md(w.week_end)}</td>
                        {isEditing ? (
                          <>
                            <td className="px-2 py-2 text-right"><input type="number" min={0} value={draft.spend} onChange={e => setDraft(d => ({ ...d, spend: e.target.value }))} className="input !w-28 text-right tabular-nums" placeholder="円" autoFocus /></td>
                            <td className="px-2 py-2 text-right"><input type="number" min={0} value={draft.list_count} onChange={e => setDraft(d => ({ ...d, list_count: e.target.value }))} className="input !w-20 text-right tabular-nums" placeholder="件" /></td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-right tabular-nums">{w.spend ? yen(w.spend) : <span className="text-slate-300">—</span>}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{w.list_count ?? <span className="text-slate-300">—</span>}</td>
                          </>
                        )}
                        <td className="px-4 py-3 text-right tabular-nums">{w.consultations}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{w.seated}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#1a3a6e]">{w.won}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">{w.cancelled}</td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          {!report.agency.uses_fb_ads && (isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <input value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} className="input !w-36 text-xs" placeholder="メモ（任意）" />
                              <button onClick={() => saveWeek(w)} disabled={saving} className="p-1.5 rounded-lg bg-[#1a3a6e] text-white disabled:opacity-50" aria-label="保存"><Check size={14} /></button>
                              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600" aria-label="取消"><X size={14} /></button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(w)} className="inline-flex items-center gap-1 text-xs text-[#1a3a6e] hover:underline"><Pencil size={12} />編集</button>
                          ))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 広告セット別 */}
          {report.adSets.length > 0 && (
            <section className="bg-white rounded-2xl border border-[#e0e6f0] overflow-hidden">
              <div className="px-5 lg:px-7 py-4 border-b border-[#eef1f7]">
                <h2 className="text-sm font-bold text-[#1a2540]">広告セット別</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 bg-[#f8f9fc]">
                      {['広告セット', '広告費', 'リスト', '面談', '面談／リスト', '成約'].map(h => (
                        <th key={h} className={`px-4 py-2.5 font-semibold whitespace-nowrap ${h === '広告セット' ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.adSets.map(a => (
                      <tr key={a.name} className="border-t border-[#eef1f7] hover:bg-[#fafbfd]">
                        <td className="px-4 py-3 text-[#1a2540] max-w-[360px] truncate" title={a.name}>{a.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{yen(a.spend)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{a.list_count}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{a.consultations}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#1a3a6e] font-semibold">{pct(per(a.consultations, a.list_count))}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{a.won}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <p className="flex items-center gap-1.5 text-xs text-slate-400 pb-6">
            <ShieldCheck size={13} />
            このレポートは集計値のみを表示しています。申込者の個人情報は含まれません。面談の数字は面談日の月で集計しています。
          </p>
        </div>
      )}
    </div>
  )
}
