'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { Company, DealToB, Member } from '@/lib/supabase'
import { DEMO_COMPANIES, DEMO_TOB_DEALS, DEMO_MEMBERS } from '@/lib/demoData'
import PageHeader from '@/components/PageHeader'
import DealToBForm from '@/components/DealToBForm'
import { ChevronLeft } from 'lucide-react'

type CompanyDetail = Company & {
  deals_tob: (Pick<DealToB, 'id' | 'service' | 'status' | 'actual_amount' | 'contract_amount' | 'payment_date' | 'company_name' | 'contract_date' | 'contract_start' | 'contract_end'> & { member?: { name: string } | null })[]
}

const STATUS_BADGE: Record<string, string> = {
  '受注': 'bg-green-100 text-green-700',
  '失注': 'bg-red-100 text-red-600',
  '保留': 'bg-amber-100 text-amber-700',
}

function statusBadge(s?: string) {
  return STATUS_BADGE[s ?? ''] ?? 'bg-slate-100 text-slate-500'
}

function totalRevenue(c: CompanyDetail) {
  return c.deals_tob.reduce((s, d) => s + (d.actual_amount ?? 0), 0)
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<DealToB | null>(null)

  useEffect(() => { fetchData() }, [id])

  function fetchData() {
    setLoading(true)
    const co = DEMO_COMPANIES.find(c => c.id === id) ?? null
    if (co) {
      const deals = DEMO_TOB_DEALS
        .filter(d => d.company_id === co.id || d.company_name === co.name)
        .map(d => ({ id: d.id, service: d.service, status: d.status, actual_amount: d.actual_amount, contract_amount: d.contract_amount, payment_date: d.payment_date, company_name: d.company_name, contract_date: d.contract_date, contract_start: d.contract_start, contract_end: d.contract_end, member: d.member ? { name: d.member.name } : null }))
      setCompany({ ...co, deals_tob: deals })
    }
    setMembers(DEMO_MEMBERS)
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">読み込み中...</div>
  if (!company) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">企業が見つかりません</div>

  const total = totalRevenue(company)

  return (
    <div className="space-y-4">
      <PageHeader
        title={company.name}
        sub={company.industry ?? undefined}
        right={
          <Link href="/customers" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <ChevronLeft size={14} />顧客一覧
          </Link>
        }
      />

      {/* 着金合計カード */}
      <div className="bg-white border border-[#e0e6f0] rounded-xl shadow-sm px-5 py-4">
        <p className="text-[10px] font-bold tracking-widest text-[#8a96b0] uppercase mb-1">着金合計</p>
        <p className="text-2xl font-bold text-[#1a2540] font-mono">
          {total > 0 ? `${total.toLocaleString()}万円` : '-'}
        </p>
        {company.notes && <p className="text-xs text-slate-400 mt-2">{company.notes}</p>}
      </div>

      {/* toB案件 */}
      <div className="bg-white border border-[#e0e6f0] rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700">法人案件</h2>
          <button
            onClick={() => { setEditTarget(null); setShowForm(true) }}
            className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded transition"
          >
            + 案件を追加
          </button>
        </div>
        {company.deals_tob.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">案件がありません</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['サービス', '担当', 'ステータス', '受注額', '契約期間'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {company.deals_tob.map(d => (
                <tr
                  key={d.id}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition"
                  onClick={() => { setEditTarget(d as unknown as DealToB); setShowForm(true) }}
                >
                  <td className="px-4 py-3 font-medium text-slate-700">{d.service ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{d.member?.name ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge(d.status)}`}>{d.status ?? '-'}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">
                    {d.actual_amount
                      ? `${d.actual_amount.toLocaleString()}万円`
                      : d.contract_amount
                      ? <span className="text-slate-400">{d.contract_amount.toLocaleString()}万円(見込)</span>
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {d.contract_start || d.contract_end
                      ? `${d.contract_start ?? '?'} 〜 ${d.contract_end ?? '?'}`
                      : d.contract_date
                      ? `締結 ${d.contract_date}`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <DealToBForm
          members={members}
          initial={editTarget}
          prefill={editTarget ? undefined : { company_id: company.id, company_name: company.name }}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
          onSaved={() => { setShowForm(false); setEditTarget(null) }}
        />
      )}
    </div>
  )
}
