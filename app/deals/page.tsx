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
    if (!status) return 'bg-white/5 text-white/40 border-white/5'
    if (['受注'].includes(status)) return 'bg-green-500/10 text-green-400 border-green-500/20'
    if (['失注'].includes(status)) return 'bg-red-500/10 text-red-400 border-red-500/20'
    if (['クロージング', '見積提出'].includes(status)) return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    if (['保留'].includes(status)) return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    return 'bg-white/5 text-white/60 border-white/5'
  }

  const priorityColor = (p?: string) => {
    if (p === '高') return 'text-red-400'
    if (p === '中') return 'text-amber-400'
    return 'text-white/30'
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-white">Deal Management</h1>
        <p className="text-white/40 text-sm">Track and manage your B2B and B2C sales opportunities.</p>
      </div>

      {/* Tab + 新規ボタン */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5 backdrop-blur-md">
          <button
            onClick={() => setTab('tob')}
            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${tab === 'tob' ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-white/40 hover:text-white/60'}`}
          >
            toB Corporate ({tobDeals.length})
          </button>
          <button
            onClick={() => setTab('toc')}
            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${tab === 'toc' ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-white/40 hover:text-white/60'}`}
          >
            toC Personal ({tocDeals.length})
          </button>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition shadow-lg shadow-blue-600/20 active:scale-95 flex items-center gap-2"
        >
          <span className="text-lg">+</span> Add New Deal
        </button>
      </div>

      {/* toB table */}
      {tab === 'tob' && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="text-left px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Member</th>
                  <th className="text-left px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Company</th>
                  <th className="text-left px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Status</th>
                  <th className="text-left px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Priority</th>
                  <th className="text-right px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Value (万)</th>
                  <th className="text-right px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Win %</th>
                  <th className="text-left px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Next Date</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {tobDeals.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-20 text-white/20 uppercase tracking-widest text-[10px] font-bold">No deals found</td></tr>
                ) : tobDeals.map(deal => (
                  <tr key={deal.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] text-blue-400 border border-blue-500/20">{deal.members?.name?.[0]}</div>
                        <span className="font-bold text-white/80">{deal.members?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-black text-white/90">{deal.company_name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColor(deal.status)}`}>
                        {deal.status ?? 'Pending'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-xs font-bold ${priorityColor(deal.priority)}`}>
                      {deal.priority ? `● ${deal.priority}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-white/90 font-bold">{deal.expected_amount?.toLocaleString() ?? '-'}</td>
                    <td className="px-6 py-4 text-right font-mono text-white/50">{deal.win_probability ? `${deal.win_probability}%` : '-'}</td>
                    <td className="px-6 py-4 text-[11px] text-white/40 font-mono italic">{deal.next_action_date ?? '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-4 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditTarget(deal); setShowForm(true) }} className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300">Edit</button>
                        <button onClick={() => deleteDeal(deal.id, 'tob')} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300">Delete</button>
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
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="text-left px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Member</th>
                  <th className="text-left px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Name</th>
                  <th className="text-left px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Status</th>
                  <th className="text-left px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Priority</th>
                  <th className="text-left px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Source</th>
                  <th className="text-left px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Service</th>
                  <th className="text-right px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Win %</th>
                  <th className="text-left px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Next Date</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {tocDeals.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-20 text-white/20 uppercase tracking-widest text-[10px] font-bold">No deals found</td></tr>
                ) : tocDeals.map(deal => (
                  <tr key={deal.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center text-[10px] text-violet-400 border border-violet-500/20">{deal.members?.name?.[0]}</div>
                        <span className="font-bold text-white/80">{deal.members?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-black text-white/90">{deal.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColor(deal.status)}`}>
                        {deal.status ?? 'Pending'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-xs font-bold ${priorityColor(deal.priority)}`}>
                      {deal.priority ? `● ${deal.priority}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-[11px] text-white/40">{deal.source ?? '-'}</td>
                    <td className="px-6 py-4 text-[11px] text-white/40">{deal.service ?? '-'}</td>
                    <td className="px-6 py-4 text-right font-mono text-white/50">{deal.win_probability ? `${deal.win_probability}%` : '-'}</td>
                    <td className="px-6 py-4 text-[11px] text-white/40 font-mono italic">{deal.next_action_date ?? '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-4 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditTarget(deal); setShowForm(true) }} className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300">Edit</button>
                        <button onClick={() => deleteDeal(deal.id, 'toc')} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300">Delete</button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in">
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
