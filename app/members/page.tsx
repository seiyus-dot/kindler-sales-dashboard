'use client'

import { useEffect, useState } from 'react'
import { supabase, Member, DealToB, MemberMonthlyGoal, AICampConsultation } from '@/lib/supabase'
import Link from 'next/link'
import MemberWhiteboard from '@/components/MemberWhiteboard'
import PageHeader from '@/components/PageHeader'

type MemberStat = {
  member: Member
  tobActive: number
  tobPipeline: number
  paidAmount: number
  wonCount: number
  alertCount: number
}

function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`
}

export default function MembersPage() {
  const today = new Date()
  const [month, setMonth] = useState(toMonthStr(today))
  const [stats, setStats] = useState<MemberStat[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [goals, setGoals] = useState<MemberMonthlyGoal[]>([])
  const [tobDeals, setTobDeals] = useState<DealToB[]>([])
  const [aicampDeals, setAicampDeals] = useState<AICampConsultation[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchAll() {
    setLoading(true)
    const monthStart = `${month}-01`
    const monthEnd = nextMonth(month)

    const [membersRes, tobAllRes, tobMonthlyRes, goalsRes, aicampMonthlyRes] = await Promise.all([
      supabase.from('members').select('*').order('sort_order'),
      // アクティブ案件はトータル（月次フィルタなし）
      supabase.from('deals_tob').select('*').not('status', 'in', '("受注","失注")'),
      // 着金・受注は当月のみ
      supabase.from('deals_tob').select('*').gte('payment_date', monthStart).lt('payment_date', monthEnd),
      supabase.from('member_monthly_goals').select('*').eq('month', month),
      supabase.from('aicamp_consultations').select('*')
        .gte('payment_date', monthStart).lt('payment_date', monthEnd),
    ])

    const mData: Member[] = membersRes.data ?? []
    const tobActiveData: DealToB[] = tobAllRes.data ?? []
    const tobMonthlyData: DealToB[] = tobMonthlyRes.data ?? []
    const gData: MemberMonthlyGoal[] = goalsRes.data ?? []
    const aMonthly: AICampConsultation[] = aicampMonthlyRes.data ?? []

    setMembers(mData)
    // Whiteboardにはアクティブ+月次の合算を渡す（既存ロジック維持）
    const allTob = [...tobActiveData, ...tobMonthlyData.filter(d => ['受注', '失注'].includes(d.status ?? ''))]
    setTobDeals(allTob)
    setGoals(gData)
    setAicampDeals(aMonthly)

    const todayStr = today.toISOString().slice(0, 10)
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

    const result: MemberStat[] = mData.map(m => {
      const tobActive = tobActiveData.filter(d => d.member_id === m.id)
      const tobMonthly = tobMonthlyData.filter(d => d.member_id === m.id)
      const aicampMonthly = aMonthly.filter(d => d.member_id === m.id)

      const tobActiveCnt = tobActive.length

      const tobPipeline = tobActive
        .reduce((s, d) => s + (d.expected_amount ?? 0), 0)

      const paidAmount =
        tobMonthly.reduce((s, d) => s + (d.actual_amount ?? 0), 0) +
        aicampMonthly
          .filter(d => d.status === '成約')
          .reduce((s, d) => s + Math.round((d.payment_amount ?? 0) / 10000), 0)

      const wonCount =
        tobMonthly.filter(d => d.status === '受注').length +
        aicampMonthly.filter(d => d.status === '成約').length

      const alertCount = tobActive.filter(
        d => d.next_action_date && d.next_action_date >= todayStr && d.next_action_date <= in7
      ).length

      return { member: m, tobActive: tobActiveCnt, tobPipeline, paidAmount, wonCount, alertCount }
    })

    setStats(result)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [month])

  const monthLabel = `${month.split('-')[0]}年${parseInt(month.split('-')[1])}月`

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-base">読み込み中...</div>
  )

  return (
    <div className="space-y-5 lg:space-y-8">
      <PageHeader
        title="メンバー"
        sub="担当者ごとの案件状況・KPI"
        right={
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-gray-200 rounded px-2 lg:px-3 py-1.5 text-xs lg:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        }
      />

      {/* ホワイトボード */}
      <MemberWhiteboard
        members={members}
        goals={goals}
        tobDeals={tobDeals}
        aicampDeals={aicampDeals}
        month={month}
        onSaved={fetchAll}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5">
        {stats.map(s => (
          <Link key={s.member.id} href={`/members/${s.member.id}`}>
            <div className="bg-white rounded border border-gray-100 shadow-sm p-4 lg:p-6 hover:shadow-md hover:border-blue-100 transition-all cursor-pointer">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 lg:w-10 lg:h-10 rounded bg-blue-100 flex items-center justify-center text-blue-700 font-black text-sm lg:text-base flex-shrink-0">
                  {s.member.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm lg:text-base font-bold text-gray-900 truncate">{s.member.name}</p>
                  <p className="text-xs text-gray-400">
                    法人 {s.tobActive}件
                  </p>
                </div>
                {s.alertCount > 0 && (
                  <span className="ml-auto flex-shrink-0 bg-amber-100 text-amber-600 text-xs font-black px-2 py-0.5 rounded">
                    期日 {s.alertCount}
                  </span>
                )}
              </div>

              <p className="text-[10px] text-gray-400 font-medium mb-2">{monthLabel} 実績</p>

              <div className="grid grid-cols-2 gap-2 lg:gap-3">
                <div className="bg-gray-50 rounded p-2.5 lg:p-3">
                  <p className="text-[10px] lg:text-xs text-gray-400 font-bold mb-1">パイプライン</p>
                  <p className="text-base lg:text-lg font-black font-mono text-gray-800 leading-none">
                    {s.tobPipeline.toLocaleString()}
                    <span className="text-xs font-bold text-gray-400 ml-0.5">万円</span>
                  </p>
                </div>
                <div className="bg-green-50 rounded p-2.5 lg:p-3">
                  <p className="text-[10px] lg:text-xs text-green-500 font-bold mb-1">着金済み</p>
                  <p className="text-base lg:text-lg font-black font-mono text-green-600 leading-none">
                    {s.paidAmount.toLocaleString()}
                    <span className="text-xs font-bold text-green-400 ml-0.5">万円</span>
                  </p>
                </div>
                <div className="bg-blue-50 rounded p-2.5 lg:p-3 col-span-2">
                  <p className="text-[10px] lg:text-xs text-blue-400 font-bold mb-1">受注数</p>
                  <p className="text-base lg:text-lg font-black font-mono text-blue-600 leading-none">
                    {s.wonCount}
                    <span className="text-xs font-bold text-blue-400 ml-0.5">件</span>
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
