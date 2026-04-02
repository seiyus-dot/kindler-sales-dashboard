'use client'

import { useEffect, useState } from 'react'
import { supabase, DealToB, DealToC, Member } from '@/lib/supabase'
import DealToBForm from '@/components/DealToBForm'
import DealToCForm from '@/components/DealToCForm'

type Tab = 'tob' | 'toc'

export default function DealsPage() {
  const [tab, setTab] = useState<Tab>('tob')
  const [tobDeals, setTobDeals] = useState<DealToB[]>([])
  const [tocDeals, setTocDeals] = useState<DealToC[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<DealToB | DealToC | null>(null)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const [tobRes, tocRes, membersRes] = await Promise.all([
      supabase.from('deals_tob').select('*, members(name)').order('created_at', { ascending: false }),
      supabase.from('deals_toc').select('*, members(name)').order('created_at', { ascending: false }),
      supabase.from('members').select('*').order('sort_order'),
    ])
    if (tobRes.data) setTobDeals(tobRes.data)
    if (tocRes.data) setTocDeals(tocRes.data)
    if (membersRes.data) setMembers(membersRes.data)
  }

  async function deleteDeal(id: string, type: Tab) {
    if (!confirm('削除しますか？')) return
    const table = type === 'tob' ? 'deals_tob' : 'deals_toc'
    await supabase.from(table).delete().eq('id', id)
    fetchAll()
  }

  const statusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-400 border-gray-200'
    if (['受注'].includes(status)) return 'bg-[#ecfdf5] text-[#059669] border-[#d1fae5]'
    if (['失注'].includes(status)) return 'bg-[#fef2f2] text-[#dc2626] border-[#fee2e2]'
    if (['クロージング', '見積提出'].includes(status)) return 'bg-[#eff6ff] text-[#2563eb] border-[#dbeafe]'
    if (['保留'].includes(status)) return 'bg-[#fffbeb] text-[#d97706] border-[#fef3c7]'
    return 'bg-gray-50 text-gray-500 border-gray-100'
  }

  const priorityColor = (p?: string) => {
    if (p === '高') return 'text-[#dc2626]'
    if (p === '中') return 'text-[#d97706]'
    return 'text-gray-300'
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">Deal Management</h1>
        <p className="text-[#8c8c8c] text-sm font-medium">Track and manage your B2B and B2C sales opportunities.</p>
      </div>

      {/* Tab + 新規ボタン */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => setTab('tob')}
            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${tab === 'tob' ? 'bg-white text-[#1a1a1a] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            toB Corporate ({tobDeals.length})
          </button>
          <button
            onClick={() => setTab('toc')}
            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${tab === 'toc' ? 'bg-white text-[#1a1a1a] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            toC Personal ({tocDeals.length})
          </button>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="bg-[#0055ff] text-white px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-blue-600 transition shadow-lg shadow-blue-500/10 active:scale-95"
        >
          Add New Deal
        </button>
      </div>

      {/* toB table */}
      {tab === 'tob' && (
        <div className="premium-card overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Member</th>
                  <th className="text-left px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Company</th>
                  <th className="text-left px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Status</th>
                  <th className="text-left px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Priority</th>
                  <th className="text-right px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Value (万)</th>
                  <th className="text-right px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Win %</th>
                  <th className="text-left px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Next Date</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tobDeals.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-20 text-gray-300 uppercase tracking-widest text-[10px] font-bold italic">No deals found</td></tr>
                ) : tobDeals.map(deal => (
                  <tr key={deal.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 text-xs font-bold text-gray-600">{deal.members?.name}</td>
                    <td className="px-6 py-4 font-bold text-[#1a1a1a]">{deal.company_name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColor(deal.status)}`}>
                        {deal.status ?? 'Pending'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-xs font-bold ${priorityColor(deal.priority)}`}>
                      {deal.priority ? `● ${deal.priority}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">{deal.expected_amount?.toLocaleString() ?? '-'}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-400">{deal.win_probability ? `${deal.win_probability}%` : '-'}</td>
                    <td className="px-6 py-4 text-[11px] text-gray-400 font-bold italic">{deal.next_action_date ?? '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-4 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditTarget(deal); setShowForm(true) }} className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Edit</button>
                        <button onClick={() => deleteDeal(deal.id, 'tob')} className="text-[10px] font-bold uppercase tracking-widest text-red-400">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* toC table */}
      {tab === 'toc' && (
        <div className="premium-card overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Member</th>
                  <th className="text-left px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Name</th>
                  <th className="text-left px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Status</th>
                  <th className="text-left px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Priority</th>
                  <th className="text-left px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Source</th>
                  <th className="text-left px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Service</th>
                  <th className="text-right px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Win %</th>
                  <th className="text-left px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Next Date</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tocDeals.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-20 text-gray-300 uppercase tracking-widest text-[10px] font-bold italic">No deals found</td></tr>
                ) : tocDeals.map(deal => (
                  <tr key={deal.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 text-xs font-bold text-gray-600">{deal.members?.name}</td>
                    <td className="px-6 py-4 font-bold text-[#1a1a1a]">{deal.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColor(deal.status)}`}>
                        {deal.status ?? 'Pending'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-xs font-bold ${priorityColor(deal.priority)}`}>
                      {deal.priority ? `● ${deal.priority}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-[11px] text-gray-400 font-bold">{deal.source ?? '-'}</td>
                    <td className="px-6 py-4 text-[11px] text-gray-400 font-bold">{deal.service ?? '-'}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-400">{deal.win_probability ? `${deal.win_probability}%` : '-'}</td>
                    <td className="px-6 py-4 text-[11px] text-gray-400 font-bold italic">{deal.next_action_date ?? '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-4 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditTarget(deal); setShowForm(true) }} className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Edit</button>
                        <button onClick={() => deleteDeal(deal.id, 'toc')} className="text-[10px] font-bold uppercase tracking-widest text-red-400">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && tab === 'tob' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1a1a1a]/40 backdrop-blur-sm animate-in">
          <div className="w-full max-w-2xl">
            <DealToBForm
              members={members}
              initial={editTarget as DealToB | null}
              onClose={() => setShowForm(false)}
              onSaved={() => { setShowForm(false); fetchAll() }}
            />
          </div>
        </div>
      )}
      {showForm && tab === 'toc' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1a1a1a]/40 backdrop-blur-sm animate-in">
          <div className="w-full max-w-2xl">
            <DealToCForm
              members={members}
              initial={editTarget as DealToC | null}
              onClose={() => setShowForm(false)}
              onSaved={() => { setShowForm(false); fetchAll() }}
            />
          </div>
        </div>
      )}
    </div>
  )

}
