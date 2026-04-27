'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Contact, DealToC, AICampConsultation, ProductAICampCustomer, Member } from '@/lib/supabase'
import PageHeader from '@/components/PageHeader'
import AICampConsultationForm from '@/components/AICampConsultationForm'
import { ChevronLeft } from 'lucide-react'

type ContactDetail = Contact & {
  deals_toc: Pick<DealToC, 'id' | 'service' | 'status' | 'actual_amount' | 'payment_date'>[]
  aicamp_consultations: (Pick<AICampConsultation, 'id' | 'service_type' | 'status' | 'payment_amount' | 'payment_date' | 'payment_method' | 'unit_amount' | 'payment_count' | 'consultation_date'> & { member?: { name: string } | null })[]
  product_aicamp_customers: (Pick<ProductAICampCustomer, 'id' | 'status'> & { session?: { title: string; session_date: string } | null })[]
}

const STATUS_BADGE: Record<string, string> = {
  '受注': 'bg-green-100 text-green-700',
  '成約': 'bg-green-100 text-green-700',
  '修了': 'bg-green-100 text-green-700',
  '申込済': 'bg-blue-100 text-blue-700',
  '失注': 'bg-red-100 text-red-600',
  'キャンセル': 'bg-red-100 text-red-600',
  '保留': 'bg-amber-100 text-amber-700',
  '予定': 'bg-blue-50 text-blue-500',
}

function statusBadge(s?: string) {
  return STATUS_BADGE[s ?? ''] ?? 'bg-slate-100 text-slate-500'
}

function paymentLabel(d: ContactDetail['aicamp_consultations'][number]) {
  if (!d.payment_amount) return null
  if (d.payment_method === 'stripe(分割)' && d.unit_amount && d.payment_count) {
    return `¥${d.unit_amount.toLocaleString()} × ${d.payment_count}回`
  }
  return `¥${d.payment_amount.toLocaleString()}`
}

function totalRevenue(c: ContactDetail) {
  const toc = c.deals_toc.reduce((s, d) => s + (d.actual_amount ?? 0), 0)
  const ai = c.aicamp_consultations.reduce((s, d) => s + Math.round((d.payment_amount ?? 0) / 10000), 0)
  return toc + ai
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [contact, setContact] = useState<ContactDetail | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<AICampConsultation | null>(null)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true)
    const [cRes, mRes] = await Promise.all([
      supabase.from('contacts').select(`
        *,
        deals_toc(id, service, status, actual_amount, payment_date),
        aicamp_consultations(id, service_type, status, payment_amount, payment_date, payment_method, unit_amount, payment_count, consultation_date, member:members(name)),
        product_aicamp_customers(id, status, session:product_aicamp_sessions(title, session_date))
      `).eq('id', id).single(),
      supabase.from('members').select('*').order('sort_order'),
    ])
    if (cRes.data) setContact(cRes.data as ContactDetail)
    if (mRes.data) setMembers(mRes.data)
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">読み込み中...</div>
  if (!contact) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">顧客が見つかりません</div>

  const total = totalRevenue(contact)

  return (
    <div className="space-y-4">
      <PageHeader
        title={contact.name}
        sub={[contact.phone, contact.email].filter(Boolean).join('　')}
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
        {contact.notes && <p className="text-xs text-slate-400 mt-2">{contact.notes}</p>}
      </div>

      {/* AI CAMP商談 */}
      <div className="bg-white border border-[#e0e6f0] rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700">AI CAMP 商談</h2>
          <button
            onClick={() => { setEditTarget(null); setShowForm(true) }}
            className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded transition"
          >
            + 商談を追加
          </button>
        </div>
        {contact.aicamp_consultations.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">商談がありません</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['実施日', 'サービス', '担当', 'ステータス', '着金額'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contact.aicamp_consultations.map(d => (
                <tr
                  key={d.id}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition"
                  onClick={() => { setEditTarget(d as unknown as AICampConsultation); setShowForm(true) }}
                >
                  <td className="px-4 py-3 text-slate-500">{d.consultation_date ? d.consultation_date.slice(0, 10) : '-'}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{d.service_type ?? 'AI CAMP'}</td>
                  <td className="px-4 py-3 text-slate-500">{d.member?.name ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge(d.status)}`}>{d.status ?? '-'}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{paymentLabel(d) ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* toC案件 */}
      {contact.deals_toc.length > 0 && (
        <div className="bg-white border border-[#e0e6f0] rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-700">個人案件</h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['サービス', 'ステータス', '着金日', '着金額'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contact.deals_toc.map(d => (
                <tr key={d.id} className="border-b border-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{d.service ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge(d.status)}`}>{d.status ?? '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{d.payment_date ?? '-'}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{d.actual_amount ? `${d.actual_amount.toLocaleString()}万円` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Product AI CAMP */}
      {contact.product_aicamp_customers.length > 0 && (
        <div className="bg-white border border-[#e0e6f0] rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-700">Product AI CAMP</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {contact.product_aicamp_customers.map(d => (
              <div key={d.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-xs font-medium text-slate-700">{d.session?.title ?? '(期未設定)'}</span>
                <div className="flex items-center gap-3">
                  {d.session?.session_date && <span className="text-[10px] text-slate-400">{d.session.session_date}</span>}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge(d.status)}`}>{d.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <AICampConsultationForm
          members={members}
          initial={editTarget}
          prefill={editTarget ? undefined : { contact_id: contact.id, name: contact.name }}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
          onSaved={() => { setShowForm(false); setEditTarget(null); fetchData() }}
        />
      )}
    </div>
  )
}
