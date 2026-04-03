'use client'

import { useEffect, useState } from 'react'
import { supabase, Member, DealToB, DealToC } from '@/lib/supabase'
import Link from 'next/link'

type MemberStat = {
  member: Member
  tobActive: number
  tocActive: number
  tobPipeline: number
  tocPipeline: number
  paidAmount: number
  wonCount: number
  alertCount: number
}

export default function MembersPage() {
  const [stats, setStats] = useState<MemberStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const [membersRes, tobRes, tocRes] = await Promise.all([
        supabase.from('members').select('*').order('sort_order'),
        supabase.from('deals_tob').select('*'),
        supabase.from('deals_toc').select('*'),
      ])
      const members: Member[] = membersRes.data ?? []
      const tobDeals: DealToB[] = tobRes.data ?? []
      const tocDeals: DealToC[] = tocRes.data ?? []

      const today = new Date().toISOString().slice(0, 10)
      const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

      const result: MemberStat[] = members.map(m => {
        const tob = tobDeals.filter(d => d.member_id === m.id)
        const toc = tocDeals.filter(d => d.member_id === m.id)

        const tobActive = tob.filter(d => !['受注', '失注'].includes(d.status ?? '')).length
        const tocActive = toc.filter(d => !['受注', '失注'].includes(d.status ?? '')).length

        const tobPipeline = tob
          .filter(d => !['受注', '失注'].includes(d.status ?? ''))
          .reduce((s, d) => s + (d.expected_amount ?? 0), 0)
        const tocPipeline = toc
          .filter(d => !['受注', '失注'].includes(d.status ?? ''))
          .reduce((s, d) => s + (d.expected_amount ?? 0), 0)

        const paidAmount = [...tob, ...toc]
          .filter(d => d.payment_date)
          .reduce((s, d) => s + (d.actual_amount ?? d.expected_amount ?? 0), 0)

        const wonCount = tob.filter(d => d.status === '受注').length + toc.filter(d => d.status === '受注').length

        const alertCount = [
          ...tob.filter(d => d.next_action_date && d.next_action_date >= today && d.next_action_date <= in7),
          ...toc.filter(d => d.next_action_date && d.next_action_date >= today && d.next_action_date <= in7),
        ].length

        return { member: m, tobActive, tocActive, tobPipeline, tocPipeline, paidAmount, wonCount, alertCount }
      })

      setStats(result)
      setLoading(false)
    }
    fetchAll()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-base">読み込み中...</div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">メンバー</h1>
        <p className="text-sm text-gray-400 mt-0.5">担当者ごとの案件状況・KPI</p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {stats.map(s => (
          <Link key={s.member.id} href={`/members/${s.member.id}`}>
            <div className="bg-white rounded border border-gray-100 shadow-sm p-6 hover:shadow-md hover:border-blue-100 transition-all cursor-pointer">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center text-blue-700 font-black text-base">
                  {s.member.name.slice(0, 1)}
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900">{s.member.name}</p>
                  <p className="text-xs text-gray-400">
                    法人 {s.tobActive}件 / 個人 {s.tocActive}件
                  </p>
                </div>
                {s.alertCount > 0 && (
                  <span className="ml-auto bg-amber-100 text-amber-600 text-xs font-black px-2 py-0.5 rounded">
                    期日 {s.alertCount}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-400 font-bold mb-1">期待売上</p>
                  <p className="text-lg font-black font-mono text-gray-800">
                    {(s.tobPipeline + s.tocPipeline).toLocaleString()}
                    <span className="text-sm font-bold text-gray-400 ml-0.5">万円</span>
                  </p>
                </div>
                <div className="bg-green-50 rounded p-3">
                  <p className="text-xs text-green-500 font-bold mb-1">着金済み</p>
                  <p className="text-lg font-black font-mono text-green-600">
                    {s.paidAmount.toLocaleString()}
                    <span className="text-sm font-bold text-green-400 ml-0.5">万円</span>
                  </p>
                </div>
                <div className="bg-blue-50 rounded p-3 col-span-2">
                  <p className="text-xs text-blue-400 font-bold mb-1">受注数</p>
                  <p className="text-lg font-black font-mono text-blue-600">
                    {s.wonCount}
                    <span className="text-sm font-bold text-blue-400 ml-0.5">件</span>
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
