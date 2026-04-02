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
    if (!status) return 'bg-gray-100 text-gray-500'
    if (['受注'].includes(status)) return 'bg-green-100 text-green-700'
    if (['失注'].includes(status)) return 'bg-red-100 text-red-600'
    if (['クロージング', '見積提出'].includes(status)) return 'bg-blue-100 text-blue-700'
    if (['保留'].includes(status)) return 'bg-amber-100 text-amber-700'
    return 'bg-gray-100 text-gray-600'
  }

  const priorityColor = (p?: string) => {
    if (p === '高') return 'text-red-500 font-bold'
    if (p === '中') return 'text-amber-500'
    return 'text-gray-400'
  }

  return (
    <div>
      {/* Tab + 新規ボタン */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setTab('tob')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'tob' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            toB 法人案件 ({tobDeals.length})
          </button>
          <button
            onClick={() => setTab('toc')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'toc' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            toC 個人案件 ({tocDeals.length})
          </button>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + 新規追加
        </button>
      </div>

      {/* toB table */}
      {tab === 'tob' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">担当</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">企業名</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">ステータス</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">優先度</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">見込み(万円)</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">確度(%)</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">次回期日</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tobDeals.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">案件がありません</td></tr>
              ) : tobDeals.map(deal => (
                <tr key={deal.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{deal.members?.name}</td>
                  <td className="px-4 py-3 font-medium">{deal.company_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(deal.status)}`}>
                      {deal.status ?? '-'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 ${priorityColor(deal.priority)}`}>{deal.priority ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-mono">{deal.expected_amount?.toLocaleString() ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-mono">{deal.win_probability ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{deal.next_action_date ?? '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditTarget(deal); setShowForm(true) }} className="text-xs text-blue-500 hover:underline">編集</button>
                      <button onClick={() => deleteDeal(deal.id, 'tob')} className="text-xs text-red-400 hover:underline">削除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* toC table */}
      {tab === 'toc' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">担当</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">氏名</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">ステータス</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">優先度</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">流入経路</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">検討サービス</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">確度(%)</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">次回期日</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tocDeals.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">案件がありません</td></tr>
              ) : tocDeals.map(deal => (
                <tr key={deal.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{deal.members?.name}</td>
                  <td className="px-4 py-3 font-medium">{deal.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(deal.status)}`}>
                      {deal.status ?? '-'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 ${priorityColor(deal.priority)}`}>{deal.priority ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{deal.source ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{deal.service ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-mono">{deal.win_probability ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{deal.next_action_date ?? '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditTarget(deal); setShowForm(true) }} className="text-xs text-blue-500 hover:underline">編集</button>
                      <button onClick={() => deleteDeal(deal.id, 'toc')} className="text-xs text-red-400 hover:underline">削除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && tab === 'tob' && (
        <DealToBForm
          members={members}
          initial={editTarget as DealToB | null}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchAll() }}
        />
      )}
      {showForm && tab === 'toc' && (
        <DealToCForm
          members={members}
          initial={editTarget as DealToC | null}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchAll() }}
        />
      )}
    </div>
  )
}
