'use client'

import { useEffect, useState } from 'react'
import { supabase, AICampConsultation, AICampMonthlyGoal, AICampAdWeekly, Member, CONSULTATION_STATUSES, PAYMENT_METHODS, AI_EXPERIENCES } from '@/lib/supabase'

const MONTHLY_INCOMES = ['〜10万円', '11～20万円', '21～30万円', '31～40万円', '41～50万円', '51～60万円', '61～70万円', '71～80万円', '81～90万円', '91～100万円', '101万円以上']
const SERVICE_TYPES = ['AI CAMP', 'プロダクト AI CAMP']

const AICAMP_COL_MIN_WIDTH: Record<string, string> = {
  consultation_date:    'min-w-[100px]',
  service_type:         'min-w-[120px]',
  member_id:            'min-w-[80px]',
  name:                 'min-w-[120px]',
  line_name:            'min-w-[120px]',
  age:                  'min-w-[60px]',
  source:               'min-w-[180px]',
  registration_source:  'min-w-[180px]',
  status:               'min-w-[100px]',
  payment_amount:       'min-w-[90px]',
  payment_date:         'min-w-[100px]',
  payment_method:       'min-w-[100px]',
  reply_deadline:       'min-w-[110px]',
  occupation:           'min-w-[90px]',
  monthly_income:       'min-w-[110px]',
  ai_experience:        'min-w-[120px]',
  customer_attribute:   'min-w-[200px]',
  motivation:           'min-w-[200px]',
  reason:               'min-w-[200px]',
  minutes_url:          'min-w-[80px]',
}
const AICAMP_COL_NOWRAP = new Set(['customer_attribute', 'motivation', 'reason'])

const AICAMP_COLUMNS = [
  { key: 'consultation_date', label: '実施日時', defaultVisible: true },
  { key: 'service_type',      label: 'サービス', defaultVisible: true },
  { key: 'member_id',         label: '営業担当', defaultVisible: true },
  { key: 'name',              label: '氏名',     defaultVisible: true },
  { key: 'line_name',         label: 'LINE名',   defaultVisible: true },
  { key: 'age',               label: '年齢',     defaultVisible: false },
  { key: 'source',            label: '流入経路', defaultVisible: true },
  { key: 'registration_source', label: '登録経路', defaultVisible: true },
  { key: 'status',            label: 'ステータス', defaultVisible: true },
  { key: 'payment_amount',    label: '着金額',   defaultVisible: true },
  { key: 'payment_date',      label: '着金日',   defaultVisible: false },
  { key: 'payment_method',    label: '支払方法', defaultVisible: false },
  { key: 'reply_deadline',    label: '返事期限', defaultVisible: false },
  { key: 'occupation',        label: '職業',     defaultVisible: false },
  { key: 'monthly_income',    label: '月収',     defaultVisible: false },
  { key: 'ai_experience',     label: 'AI経験',   defaultVisible: false },
  { key: 'customer_attribute',label: '顧客属性', defaultVisible: false },
  { key: 'motivation',        label: '動機',     defaultVisible: false },
  { key: 'reason',            label: '理由',     defaultVisible: false },
  { key: 'minutes_url',       label: '議事録',   defaultVisible: false },
] as const

type ColKey = typeof AICAMP_COLUMNS[number]['key']
import AICampConsultationForm from '@/components/AICampConsultationForm'
import AIImport from '@/components/AIImport'
import SourceMasterModal from '@/components/SourceMasterModal'

const STATUS_COLORS: Record<string, string> = {
  '成約':     'bg-green-100 text-green-700',
  '失注':     'bg-red-100 text-red-600',
  '保留':     'bg-amber-100 text-amber-700',
  'ドタキャン': 'bg-red-50 text-red-400',
  'キャンセル': 'bg-gray-100 text-gray-500',
  '予定':     'bg-blue-100 text-blue-600',
}

function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AICampPage() {
  const today = new Date()
  const [month, setMonth] = useState(toMonthStr(today))
  const [consultations, setConsultations] = useState<AICampConsultation[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [goal, setGoal] = useState<AICampMonthlyGoal | null>(null)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [productGoalInput, setProductGoalInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<AICampConsultation | null>(null)
  const [filterMember, setFilterMember] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showSourceMaster, setShowSourceMaster] = useState(false)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const [inlineDraft, setInlineDraft] = useState<Record<string, string>>({})
  const [inlineSaving, setInlineSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [adWeekly, setAdWeekly] = useState<AICampAdWeekly[]>([])
  const [fbAds, setFbAds] = useState<{
    day: string
    ad_set_name: string
    amount_spent: number
    registrations_completed: number
    impressions: number
    link_clicks: number
    reach: number
    cpm: number
    cpc: number
    ctr: number
  }[]>([])
  const [adEditId, setAdEditId] = useState<string | null>(null)
  const [adDraft, setAdDraft] = useState<Record<string, string>>({})
  const [adSaving, setAdSaving] = useState(false)
  const [showAddWeek, setShowAddWeek] = useState(false)
  const [newWeek, setNewWeek] = useState({ week_label: '', ad_spend: '', list_count: '', consultation_count: '', seated_count: '' })
  const [activeTab, setActiveTab] = useState<'overview' | 'ads' | 'applications' | 'deals'>('overview')
  const [filterServiceType, setFilterServiceType] = useState('')
  const [showColSettings, setShowColSettings] = useState(false)
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aicamp-visible-cols')
      if (saved) {
        try { return new Set(JSON.parse(saved) as ColKey[]) } catch {}
      }
    }
    return new Set(AICAMP_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
  })

  function toggleCol(key: ColKey) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      localStorage.setItem('aicamp-visible-cols', JSON.stringify(Array.from(next)))
      return next
    })
  }

  useEffect(() => { fetchAll() }, [month])

  async function fetchAll() {
    setLoading(true)
    const [consRes, membersRes, goalRes, adRes] = await Promise.all([
      supabase
        .from('aicamp_consultations')
        .select('*, member:members(name)')
        .or(`and(consultation_date.gte.${month}-01,consultation_date.lt.${nextMonth(month)}),and(payment_date.gte.${month}-01,payment_date.lt.${nextMonth(month)})`)
        .order('consultation_date', { ascending: false }),
      supabase.from('members').select('*').order('sort_order'),
      supabase.from('aicamp_monthly_goals').select('*').eq('month', month).maybeSingle(),
      supabase.from('aicamp_ad_weekly').select('*').eq('month', month).order('sort_order').order('created_at'),
    ])
    const fbRes = await supabase
      .from('fb_ads')
      .select('day, ad_set_name, amount_spent, registrations_completed, impressions, link_clicks, reach, cpm, cpc, ctr')
      .gte('day', `${month}-01`)
      .lt('day', nextMonth(month))
      .order('day', { ascending: false })
    if (consRes.data) setConsultations(consRes.data)
    if (membersRes.data) setMembers(membersRes.data)
    setGoal(goalRes.data ?? null)
    setGoalInput(goalRes.data?.contract_goal?.toString() ?? '0')
    setProductGoalInput(goalRes.data?.product_contract_goal?.toString() ?? '0')
    setAdWeekly(adRes.data ?? [])
    setFbAds(fbRes.data ?? [])
    setLoading(false)
  }

  function nextMonth(m: string) {
    const [y, mo] = m.split('-').map(Number)
    return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`
  }

  async function saveGoal() {
    const val = parseInt(goalInput) || 0
    const pval = parseInt(productGoalInput) || 0
    const payload = { contract_goal: val, product_contract_goal: pval }
    const { error } = goal
      ? await supabase.from('aicamp_monthly_goals').update(payload).eq('id', goal.id)
      : await supabase.from('aicamp_monthly_goals').insert({ month, ...payload })
    if (error) { alert(`保存エラー: ${error.message}`); return }
    setEditingGoal(false)
    fetchAll()
  }

  function startAdEdit(row: AICampAdWeekly) {
    setAdEditId(row.id)
    setAdDraft({
      week_label: row.week_label,
      ad_spend: row.ad_spend.toString(),
      list_count: row.list_count.toString(),
      consultation_count: row.consultation_count?.toString() ?? '',
      seated_count: row.seated_count?.toString() ?? '',
    })
  }

  async function saveAdRow() {
    if (!adEditId) return
    setAdSaving(true)
    await supabase.from('aicamp_ad_weekly').update({
      week_label: adDraft.week_label,
      ad_spend: parseInt(adDraft.ad_spend) || 0,
      list_count: parseInt(adDraft.list_count) || 0,
      consultation_count: adDraft.consultation_count ? parseInt(adDraft.consultation_count) : null,
      seated_count: adDraft.seated_count ? parseInt(adDraft.seated_count) : null,
    }).eq('id', adEditId)
    setAdSaving(false)
    setAdEditId(null)
    fetchAll()
  }

  async function addWeekRow() {
    if (!newWeek.week_label.trim()) return
    setAdSaving(true)
    await supabase.from('aicamp_ad_weekly').insert({
      month,
      week_label: newWeek.week_label.trim(),
      ad_spend: parseInt(newWeek.ad_spend) || 0,
      list_count: parseInt(newWeek.list_count) || 0,
      consultation_count: newWeek.consultation_count ? parseInt(newWeek.consultation_count) : null,
      seated_count: newWeek.seated_count ? parseInt(newWeek.seated_count) : null,
      sort_order: adWeekly.length,
    })
    setAdSaving(false)
    setShowAddWeek(false)
    setNewWeek({ week_label: '', ad_spend: '', list_count: '', consultation_count: '', seated_count: '' })
    fetchAll()
  }

  async function deleteAdRow(id: string) {
    if (!confirm('この週のデータを削除しますか？')) return
    await supabase.from('aicamp_ad_weekly').delete().eq('id', id)
    fetchAll()
  }

  function startInlineEdit(c: AICampConsultation) {
    setInlineEditId(c.id)
    setInlineDraft({
      consultation_date: c.consultation_date?.slice(0, 16) ?? '',
      member_id: c.member_id ?? '',
      service_type: c.service_type ?? 'AI CAMP',
      line_name: c.line_name ?? '',
      name: c.name ?? '',
      age: c.age?.toString() ?? '',
      source: c.source ?? '',
      registration_source: c.registration_source ?? '',
      status: c.status ?? '予定',
      payment_amount: c.payment_amount?.toString() ?? '',
      payment_date: c.payment_date ?? '',
      payment_method: c.payment_method ?? '',
      reply_deadline: c.reply_deadline ?? '',
      occupation: c.occupation ?? '',
      monthly_income: c.monthly_income ?? '',
      ai_experience: c.ai_experience ?? '',
      customer_attribute: c.customer_attribute ?? '',
      motivation: c.motivation ?? '',
      reason: c.reason ?? '',
      minutes_url: c.minutes_url ?? '',
    })
  }

  async function saveInlineEdit(id: string) {
    setInlineSaving(true)
    const payload = {
      consultation_date: inlineDraft.consultation_date || null,
      member_id: inlineDraft.member_id || null,
      service_type: inlineDraft.service_type,
      line_name: inlineDraft.line_name || null,
      name: inlineDraft.name || null,
      age: inlineDraft.age ? parseInt(inlineDraft.age) : null,
      source: inlineDraft.source || null,
      registration_source: inlineDraft.registration_source || null,
      status: inlineDraft.status,
      payment_amount: inlineDraft.payment_amount ? parseInt(inlineDraft.payment_amount) : null,
      payment_date: inlineDraft.payment_date || null,
      payment_method: inlineDraft.payment_method || null,
      reply_deadline: inlineDraft.reply_deadline || null,
      occupation: inlineDraft.occupation || null,
      monthly_income: inlineDraft.monthly_income || null,
      ai_experience: inlineDraft.ai_experience || null,
      customer_attribute: inlineDraft.customer_attribute || null,
      motivation: inlineDraft.motivation || null,
      reason: inlineDraft.reason || null,
      minutes_url: inlineDraft.minutes_url || null,
    }
    await supabase.from('aicamp_consultations').update(payload).eq('id', id)
    setInlineSaving(false)
    setInlineEditId(null)
    fetchAll()
  }

  function cancelInlineEdit() {
    setInlineEditId(null)
    setInlineDraft({})
  }

  const setDraft = (k: string, v: string) => setInlineDraft(d => ({ ...d, [k]: v }))

  async function deleteConsultation(id: string) {
    if (!confirm('削除しますか？')) return
    await supabase.from('aicamp_consultations').delete().eq('id', id)
    fetchAll()
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)))
    }
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`選択した ${selectedIds.size} 件を削除しますか？`)) return
    setBulkDeleting(true)
    await supabase.from('aicamp_consultations').delete().in('id', Array.from(selectedIds))
    setSelectedIds(new Set())
    setBulkDeleting(false)
    fetchAll()
  }

  const contractGoal = goal?.contract_goal ?? 0
  const productContractGoal = goal?.product_contract_goal ?? 0
  const filtered = consultations.filter(c => {
    if (filterMember && c.member_id !== filterMember) return false
    if (filterStatus && c.status !== filterStatus) return false
    return true
  })

  // KPI集計（月全体）
  const contracted = consultations.filter(c => c.status === '成約')
  const metaContracted = contracted.filter(c => c.source?.toLowerCase().includes('meta'))
  const aicampContracted = contracted.filter(c => (c.service_type ?? 'AI CAMP') === 'AI CAMP')
  const productContracted = contracted.filter(c => c.service_type === 'プロダクト AI CAMP')
  const held = consultations.filter(c => c.status === '保留')
  const conducted = consultations.filter(c => ['成約', '失注', '保留'].includes(c.status ?? ''))
  const cancelled = consultations.filter(c => ['ドタキャン', 'キャンセル'].includes(c.status ?? ''))
  const totalScheduled = conducted.length + cancelled.length
  const cancelRate = totalScheduled > 0 ? Math.round(cancelled.length / totalScheduled * 100) : 0
  const contractRate = conducted.length > 0 ? Math.round(contracted.length / conducted.length * 100) : 0
  const totalRevenue = contracted.reduce((s, c) => s + (c.payment_amount ?? 0), 0)
  const metaRevenue = metaContracted.reduce((s, c) => s + (c.payment_amount ?? 0), 0)
  const nonMetaRevenue = totalRevenue - metaRevenue
  const progressPct = contractGoal > 0 ? Math.min(Math.round(aicampContracted.length / contractGoal * 100), 100) : 0
  const productProgressPct = productContractGoal > 0 ? Math.min(Math.round(productContracted.length / productContractGoal * 100), 100) : 0

  // 担当者別KPI
  const memberStats = members.map(m => {
    const mc = consultations.filter(c => c.member_id === m.id)
    const mContracted = mc.filter(c => c.status === '成約')
    const mConducted = mc.filter(c => ['成約', '失注', '保留'].includes(c.status ?? ''))
    const mCancelled = mc.filter(c => ['ドタキャン', 'キャンセル'].includes(c.status ?? ''))
    const mTotal = mConducted.length + mCancelled.length
    return {
      member: m,
      contracted: mContracted.length,
      held: mc.filter(c => c.status === '保留').length,
      conducted: mConducted.length,
      cancelled: mCancelled.length,
      cancelRate: mTotal > 0 ? Math.round(mCancelled.length / mTotal * 100) : 0,
      contractRate: mConducted.length > 0 ? Math.round(mContracted.length / mConducted.length * 100) : 0,
      revenue: mContracted.reduce((s, c) => s + (c.payment_amount ?? 0), 0),
    }
  }).filter(s => s.conducted + s.cancelled + s.contracted > 0 || consultations.some(c => c.member_id === s.member.id))

  const monthLabel = `${month.split('-')[0]}年${parseInt(month.split('-')[1])}月`

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">読み込み中...</div>

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-gray-900 tracking-tight">AI CAMP</h1>
          <p className="text-xs lg:text-sm text-gray-400 mt-0.5">ロードマップ作成会 商談管理</p>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-gray-200 rounded px-2 lg:px-3 py-1.5 text-xs lg:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 flex-shrink-0"
          />
          <button
            onClick={() => setShowSourceMaster(true)}
            className="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm text-gray-600 border border-gray-200 rounded-sm hover:bg-gray-50 transition whitespace-nowrap"
          >
            流入経路マスタ
          </button>
          <AIImport members={members} onImported={fetchAll} />
          <button
            onClick={() => { setEditTarget(null); setShowForm(true) }}
            className="bg-blue-600 text-white px-3 lg:px-4 py-1.5 lg:py-2 rounded text-xs lg:text-sm font-medium hover:bg-blue-700 transition whitespace-nowrap"
          >
            + 商談追加
          </button>
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-1 border-b border-gray-200 -mx-4 lg:-mx-6 px-4 lg:px-6 overflow-x-auto scrollbar-hide">
        {([
          { key: 'overview',      label: '概要' },
          { key: 'ads',           label: '広告' },
          { key: 'applications',  label: '申し込み一覧' },
          { key: 'deals',         label: '商談一覧' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (<>
      {/* 売上サマリー - スマホ横スクロール */}
      <div className="flex lg:grid lg:grid-cols-3 gap-3 lg:gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 lg:overflow-x-visible snap-x snap-mandatory lg:snap-none pb-1">
        <div className="bg-white border border-gray-200 rounded p-4 lg:p-5 min-w-[180px] flex-shrink-0 lg:flex-shrink lg:min-w-0 snap-start">
          <p className="text-xs font-bold text-gray-400 mb-1">全体売上</p>
          <p className="text-xl lg:text-3xl font-black font-mono text-gray-900 break-all">
            ¥{totalRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">成約 {contracted.length}件</p>
        </div>
        <div className="bg-white border border-gray-200 rounded p-4 lg:p-5 min-w-[180px] flex-shrink-0 lg:flex-shrink lg:min-w-0 snap-start">
          <p className="text-xs font-bold text-gray-400 mb-1">広告リスト売上</p>
          <p className="text-xl lg:text-3xl font-black font-mono text-blue-600 break-all">
            ¥{metaRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">Meta広告経由 {metaContracted.length}件</p>
        </div>
        <div className="bg-white border border-gray-200 rounded p-4 lg:p-5 min-w-[180px] flex-shrink-0 lg:flex-shrink lg:min-w-0 snap-start">
          <p className="text-xs font-bold text-gray-400 mb-1">その他売上</p>
          <p className="text-xl lg:text-3xl font-black font-mono text-gray-600 break-all">
            ¥{nonMetaRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">広告以外 {contracted.length - metaContracted.length}件</p>
        </div>
      </div>

      {/* 目標進捗 */}
      <div className="bg-white border border-gray-200 rounded p-4 lg:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-0">
          <span className="text-sm font-bold text-gray-500">{monthLabel} 成約目標</span>
          {editingGoal ? (
            <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>AI CAMP</span>
                <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)}
                  className="w-14 lg:w-16 border border-blue-300 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <span>件</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>プロダクト</span>
                <input type="number" value={productGoalInput} onChange={e => setProductGoalInput(e.target.value)}
                  className="w-14 lg:w-16 border border-blue-300 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <span>件</span>
              </div>
              <button onClick={saveGoal} className="text-sm text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 transition">保存</button>
              <button onClick={() => setEditingGoal(false)} className="text-sm text-gray-400 hover:text-gray-600">取消</button>
            </div>
          ) : (
            <button onClick={() => setEditingGoal(true)} className="text-xs text-blue-500 hover:underline self-start lg:self-auto">目標を変更</button>
          )}
        </div>
        {[
          { label: 'AI CAMP', actual: aicampContracted.length, goal: contractGoal, pct: progressPct },
          { label: 'プロダクト AI CAMP', actual: productContracted.length, goal: productContractGoal, pct: productProgressPct },
        ].map(row => (
          <div key={row.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500 font-medium">{row.label}</span>
              <span className="text-sm font-black font-mono text-gray-800">
                {row.actual} <span className="text-xs font-bold text-gray-400">/ {row.goal}件</span>
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${row.pct >= 100 ? 'bg-green-500' : row.pct >= 60 ? 'bg-blue-500' : 'bg-amber-400'}`}
                style={{ width: `${row.pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {row.pct}% 達成{row.goal > 0 ? ` — あと ${Math.max(row.goal - row.actual, 0)}件` : ''}
            </p>
          </div>
        ))}
      </div>

      {/* サマリーKPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: '成約数', value: contracted.length, unit: '件', color: 'text-green-600' },
          { label: '実商談数', value: conducted.length, unit: '件', color: 'text-gray-800' },
          { label: 'キャンセル率', value: cancelRate, unit: '%', color: cancelRate > 20 ? 'text-red-500' : 'text-gray-800' },
          { label: '成約率', value: contractRate, unit: '%', color: 'text-blue-600' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-200 rounded p-3 lg:p-4">
            <p className="text-xs text-gray-400 font-bold mb-1">{k.label}</p>
            <p className={`text-xl lg:text-2xl font-black font-mono ${k.color}`}>
              {k.value}<span className="text-xs lg:text-sm font-bold text-gray-400 ml-0.5">{k.unit}</span>
            </p>
          </div>
        ))}
      </div>
      </>)}

      {activeTab === 'ads' && (<>
      {/* 広告数値 */}
      {(() => {
        const totalAdSpend = adWeekly.reduce((s, r) => s + r.ad_spend, 0)
        const totalListCount = adWeekly.reduce((s, r) => s + r.list_count, 0)
        const totalConsultation = adWeekly.reduce((s, r) => s + (r.consultation_count ?? 0), 0)
        const totalSeated = adWeekly.reduce((s, r) => s + (r.seated_count ?? 0), 0)
        const cpa = totalListCount > 0 ? Math.round(totalAdSpend / totalListCount) : null
        const meetingCpa = totalConsultation > 0 ? Math.round(totalAdSpend / totalConsultation) : null
        const seatedCpa = totalSeated > 0 ? Math.round(totalAdSpend / totalSeated) : null
        const cpo = metaContracted.length > 0 ? Math.round(totalAdSpend / metaContracted.length) : null
        const roas = totalAdSpend > 0 ? Math.round(totalRevenue / totalAdSpend * 100) : null

        const adCols = ['期間', '広告費[円]', 'リスト数[人]', '面談申込数[人]', '着座数[人]', '']

        return (
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700">広告数値（{monthLabel}）</h2>
              <button
                onClick={() => setShowAddWeek(true)}
                className="text-xs text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 transition"
              >
                + 週を追加
              </button>
            </div>

            {/* 週別テーブル */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {adCols.map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {adWeekly.length === 0 && !showAddWeek ? (
                    <tr><td colSpan={6} className="text-center py-6 text-gray-400 text-xs">「週を追加」から入力してください</td></tr>
                  ) : adWeekly.map(row => {
                    const editing = adEditId === row.id
                    return (
                      <tr key={row.id} className={`border-b border-gray-50 ${editing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        {editing ? (
                          <>
                            <td className="px-4 py-2"><input value={adDraft.week_label} onChange={e => setAdDraft(d => ({ ...d, week_label: e.target.value }))} className="border border-blue-300 rounded px-2 py-1 text-xs w-28 focus:outline-none" placeholder="4/1〜4/5" /></td>
                            <td className="px-4 py-2"><input type="number" value={adDraft.ad_spend} onChange={e => setAdDraft(d => ({ ...d, ad_spend: e.target.value }))} className="border border-blue-300 rounded px-2 py-1 text-xs font-mono w-28 focus:outline-none" /></td>
                            <td className="px-4 py-2"><input type="number" value={adDraft.list_count} onChange={e => setAdDraft(d => ({ ...d, list_count: e.target.value }))} className="border border-blue-300 rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none" /></td>
                            <td className="px-4 py-2"><input type="number" value={adDraft.consultation_count} onChange={e => setAdDraft(d => ({ ...d, consultation_count: e.target.value }))} className="border border-blue-300 rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none" /></td>
                            <td className="px-4 py-2"><input type="number" value={adDraft.seated_count} onChange={e => setAdDraft(d => ({ ...d, seated_count: e.target.value }))} className="border border-blue-300 rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none" /></td>
                            <td className="px-4 py-2">
                              <div className="flex gap-2 justify-end">
                                <button onClick={saveAdRow} disabled={adSaving} className="text-xs text-white bg-blue-600 px-2 py-1 rounded disabled:opacity-50">{adSaving ? '...' : '保存'}</button>
                                <button onClick={() => setAdEditId(null)} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 font-medium text-gray-700">{row.week_label}</td>
                            <td className="px-4 py-3 font-mono text-gray-700">¥{row.ad_spend.toLocaleString()}</td>
                            <td className="px-4 py-3 font-mono text-gray-700">{row.list_count}</td>
                            <td className="px-4 py-3 font-mono text-gray-500">{row.consultation_count ?? '-'}</td>
                            <td className="px-4 py-3 font-mono text-gray-500">{row.seated_count ?? '-'}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => startAdEdit(row)} className="text-xs text-blue-500 hover:underline">編集</button>
                                <button onClick={() => deleteAdRow(row.id)} className="text-xs text-red-400 hover:underline">削除</button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}

                  {/* 追加行 */}
                  {showAddWeek && (
                    <tr className="border-b border-gray-50 bg-green-50">
                      <td className="px-4 py-2"><input value={newWeek.week_label} onChange={e => setNewWeek(w => ({ ...w, week_label: e.target.value }))} className="border border-green-300 rounded px-2 py-1 text-xs w-28 focus:outline-none" placeholder="4/1〜4/5" /></td>
                      <td className="px-4 py-2"><input type="number" value={newWeek.ad_spend} onChange={e => setNewWeek(w => ({ ...w, ad_spend: e.target.value }))} className="border border-green-300 rounded px-2 py-1 text-xs font-mono w-28 focus:outline-none" placeholder="0" /></td>
                      <td className="px-4 py-2"><input type="number" value={newWeek.list_count} onChange={e => setNewWeek(w => ({ ...w, list_count: e.target.value }))} className="border border-green-300 rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none" placeholder="0" /></td>
                      <td className="px-4 py-2"><input type="number" value={newWeek.consultation_count} onChange={e => setNewWeek(w => ({ ...w, consultation_count: e.target.value }))} className="border border-green-300 rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none" placeholder="-" /></td>
                      <td className="px-4 py-2"><input type="number" value={newWeek.seated_count} onChange={e => setNewWeek(w => ({ ...w, seated_count: e.target.value }))} className="border border-green-300 rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none" placeholder="-" /></td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2 justify-end">
                          <button onClick={addWeekRow} disabled={adSaving} className="text-xs text-white bg-green-600 px-2 py-1 rounded disabled:opacity-50">{adSaving ? '...' : '追加'}</button>
                          <button onClick={() => setShowAddWeek(false)} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* 合計行 */}
                  {adWeekly.length > 0 && (
                    <tr className="bg-gray-50 border-t border-gray-200 font-bold">
                      <td className="px-4 py-3 text-gray-500 text-xs">合計</td>
                      <td className="px-4 py-3 font-mono text-gray-800">¥{totalAdSpend.toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-gray-800">{totalListCount}</td>
                      <td className="px-4 py-3 font-mono text-gray-800">{totalConsultation > 0 ? totalConsultation : '-'}</td>
                      <td className="px-4 py-3 font-mono text-gray-800">{totalSeated > 0 ? totalSeated : '-'}</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ファネル */}
            {adWeekly.length > 0 && totalListCount > 0 && (
              <div className="border-t border-gray-100 px-5 py-4">
                <p className="text-xs font-bold text-gray-500 mb-3">LINEファネル</p>
                {(() => {
                  const stages = [
                    { label: 'リスト数', value: totalListCount, unit: '人', color: 'bg-blue-500' },
                    { label: '面談申込', value: totalConsultation, unit: '人', color: 'bg-indigo-500', prev: totalListCount },
                    { label: '着座', value: totalSeated, unit: '人', color: 'bg-violet-500', prev: totalConsultation },
                    { label: '成約(Meta)', value: metaContracted.length, unit: '件', color: 'bg-green-500', prev: totalSeated },
                  ]
                  const max = totalListCount
                  return (
                    <div className="flex flex-col gap-2">
                      {stages.map((s, i) => {
                        const pct = max > 0 ? Math.round(s.value / max * 100) : 0
                        const rate = s.prev && s.prev > 0 ? Math.round(s.value / s.prev * 100) : null
                        return (
                          <div key={s.label} className="flex items-center gap-3">
                            <div className="w-20 text-xs text-gray-500 text-right shrink-0">{s.label}</div>
                            <div className="flex-1 relative h-7 bg-gray-100 rounded overflow-hidden">
                              <div
                                className={`h-full ${s.color} transition-all duration-500`}
                                style={{ width: `${Math.max(pct, s.value > 0 ? 2 : 0)}%` }}
                              />
                              <span className="absolute inset-0 flex items-center px-2.5 text-xs font-mono font-bold text-white mix-blend-luminosity">
                                {s.value > 0 ? `${s.value.toLocaleString()}${s.unit}` : '-'}
                              </span>
                            </div>
                            <div className="w-14 text-xs text-gray-400 shrink-0 font-mono">
                              {i === 0 ? '基準' : rate !== null ? `↓${rate}%` : '-'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* KPI */}
            {adWeekly.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-4 grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: 'CPA', value: cpa ? `¥${cpa.toLocaleString()}` : '-', sub: '広告費÷リスト数' },
                  { label: '面談申込CPA', value: meetingCpa ? `¥${meetingCpa.toLocaleString()}` : '-', sub: '広告費÷面談申込数' },
                  { label: '着座単価', value: seatedCpa ? `¥${seatedCpa.toLocaleString()}` : '-', sub: '広告費÷着座数' },
                  { label: 'CPO', value: cpo ? `¥${cpo.toLocaleString()}` : '-', sub: `広告費÷Meta成約${metaContracted.length}件` },
                  { label: 'ROAS', value: roas !== null ? `${roas}%` : '-', sub: `売上÷広告費`, color: roas !== null ? (roas >= 100 ? 'text-green-600' : roas >= 60 ? 'text-amber-500' : 'text-red-500') : 'text-gray-300' },
                ].map(k => (
                  <div key={k.label}>
                    <p className="text-xs text-gray-400 font-bold mb-0.5">{k.label}</p>
                    <p className={`text-xl font-black font-mono ${k.color ?? 'text-gray-800'}`}>{k.value}</p>
                    <p className="text-xs text-gray-300 mt-0.5">{k.sub}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Meta広告パフォーマンス（fb_ads） */}
      {fbAds.length > 0 && (() => {
        // 日付でグループ集計
        const byDay: Record<string, { day: string; amount_spent: number; registrations: number; impressions: number; clicks: number; reach: number }> = {}
        fbAds.forEach(r => {
          if (!byDay[r.day]) byDay[r.day] = { day: r.day, amount_spent: 0, registrations: 0, impressions: 0, clicks: 0, reach: 0 }
          byDay[r.day].amount_spent += r.amount_spent ?? 0
          byDay[r.day].registrations += r.registrations_completed ?? 0
          byDay[r.day].impressions += r.impressions ?? 0
          byDay[r.day].clicks += r.link_clicks ?? 0
          byDay[r.day].reach = (byDay[r.day].reach || 0) + (r.reach ?? 0)
        })
        const days = Object.values(byDay).sort((a, b) => b.day.localeCompare(a.day))
        const totalSpend = days.reduce((s, d) => s + d.amount_spent, 0)
        const totalRegs = days.reduce((s, d) => s + d.registrations, 0)
        const totalImpressions = days.reduce((s, d) => s + d.impressions, 0)
        const totalClicks = days.reduce((s, d) => s + d.clicks, 0)
        const cpr = totalRegs > 0 ? Math.round(totalSpend / totalRegs) : null
        const cpc = totalClicks > 0 ? Math.round(totalSpend / totalClicks) : null
        const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : null
        return (
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700">Meta広告パフォーマンス（{monthLabel}）</h2>
            </div>
            {/* サマリKPI */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 px-5 py-4 border-b border-gray-100">
              {[
                { label: '広告費', value: `¥${Math.round(totalSpend).toLocaleString()}`, mono: true },
                { label: '登録数', value: `${totalRegs}件`, color: 'text-blue-600' },
                { label: 'CPR', value: cpr ? `¥${cpr.toLocaleString()}` : '-', sub: '広告費÷登録数' },
                { label: 'CPC', value: cpc ? `¥${cpc.toLocaleString()}` : '-', sub: '広告費÷クリック数' },
                { label: 'CTR', value: ctr ? `${ctr}%` : '-', sub: 'クリック率' },
              ].map(k => (
                <div key={k.label}>
                  <p className="text-xs text-gray-400 font-bold mb-0.5">{k.label}</p>
                  <p className={`text-xl font-black font-mono ${k.color ?? 'text-gray-800'}`}>{k.value}</p>
                  {k.sub && <p className="text-xs text-gray-300 mt-0.5">{k.sub}</p>}
                </div>
              ))}
            </div>
            {/* ファネル */}
            <div className="border-t border-gray-100 px-5 py-4">
              <p className="text-xs font-bold text-gray-500 mb-4">LINEファネル（{monthLabel}）</p>
              {(() => {
                const funnelSteps = [
                  { label: 'リーチ', value: days.reduce((s,d) => s + d.reach, 0), color: 'bg-indigo-400', desc: '広告を見たユニーク人数' },
                  { label: 'クリック', value: days.reduce((s,d) => s + d.clicks, 0), color: 'bg-blue-400', desc: 'LPへの流入数' },
                  { label: 'LINE登録', value: days.reduce((s,d) => s + d.registrations, 0), color: 'bg-green-400', desc: '登録完了数' },
                ]
                const maxVal = funnelSteps[0].value || 1
                return (
                  <div className="space-y-2">
                    {funnelSteps.map((step, i) => {
                      const prev = i > 0 ? funnelSteps[i-1].value : null
                      const rate = prev ? (step.value / prev * 100).toFixed(1) : null
                      const pct = Math.round(step.value / maxVal * 100)
                      return (
                        <div key={step.label} className="flex items-center gap-3">
                          <div className="w-20 text-right text-xs font-bold text-gray-600 shrink-0">{step.label}</div>
                          <div className="flex-1 relative h-8 bg-gray-100 rounded overflow-hidden">
                            <div className={`h-full ${step.color} opacity-80 rounded transition-all`} style={{ width: `${pct}%` }} />
                            <span className="absolute inset-0 flex items-center px-2 text-xs font-bold text-gray-700">
                              {step.value.toLocaleString()}
                              {rate && <span className="ml-2 text-gray-400 font-normal">← {rate}%</span>}
                            </span>
                          </div>
                          <div className="w-32 text-xs text-gray-400 shrink-0">{step.desc}</div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* 広告セット × 登録経路 統合テーブル */}
            <div className="border-t border-gray-100">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-500">広告セット別パフォーマンス（{monthLabel}）</p>
                <p className="text-xs text-gray-400 mt-0.5">広告指標 + 登録経路別の相談・成約実績</p>
              </div>
              <div className="overflow-x-auto">
                {(() => {
                  // 広告セット別に集計
                  const adSetMap: Record<string, { spend: number; reach: number; clicks: number; impressions: number; registrations: number }> = {}
                  fbAds.forEach(r => {
                    const key = r.ad_set_name || '不明'
                    if (!adSetMap[key]) adSetMap[key] = { spend: 0, reach: 0, clicks: 0, impressions: 0, registrations: 0 }
                    adSetMap[key].spend += r.amount_spent ?? 0
                    adSetMap[key].reach += r.reach ?? 0
                    adSetMap[key].clicks += r.link_clicks ?? 0
                    adSetMap[key].impressions += r.impressions ?? 0
                    adSetMap[key].registrations += r.registrations_completed ?? 0
                  })
                  // 登録経路別に相談・成約を集計（registration_source = ad_set_name）
                  const srcMap: Record<string, { consultations: number; contracted: number }> = {}
                  consultations.forEach(c => {
                    const key = c.registration_source || ''
                    if (!key) return
                    if (!srcMap[key]) srcMap[key] = { consultations: 0, contracted: 0 }
                    srcMap[key].consultations++
                    if (c.status === '成約') srcMap[key].contracted++
                  })
                  const rows = Object.entries(adSetMap)
                    .map(([name, ad]) => ({ name, ...ad, ...(srcMap[name] ?? { consultations: 0, contracted: 0 }) }))
                    .sort((a, b) => b.registrations - a.registrations || b.spend - a.spend)
                  return (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">広告セット</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">広告費</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">リーチ</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">クリック</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">登録数</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">CPR</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-blue-300 whitespace-nowrap border-l border-gray-100">相談数</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-green-400 whitespace-nowrap">成約数</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">成約率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => {
                          const cpr = r.registrations > 0 ? Math.round(r.spend / r.registrations) : null
                          const ctr = r.impressions > 0 ? (r.clicks / r.impressions * 100).toFixed(1) : '-'
                          const rate = r.consultations > 0 ? Math.round(r.contracted / r.consultations * 100) : null
                          return (
                            <tr key={r.name} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="px-4 py-2 text-xs text-gray-600 max-w-[200px] truncate" title={r.name}>{r.name}</td>
                              <td className="px-4 py-2 font-mono text-xs text-gray-700">¥{Math.round(r.spend).toLocaleString()}</td>
                              <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.reach.toLocaleString()}</td>
                              <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.clicks.toLocaleString()}</td>
                              <td className="px-4 py-2 font-mono text-xs font-bold text-blue-600">{r.registrations}</td>
                              <td className="px-4 py-2 font-mono text-xs text-gray-700">{cpr ? `¥${cpr.toLocaleString()}` : '-'}</td>
                              <td className="px-4 py-2 font-mono text-xs text-gray-700 border-l border-gray-100">{r.consultations || '-'}</td>
                              <td className="px-4 py-2 font-mono text-xs font-bold text-green-600">{r.contracted || '-'}</td>
                              <td className="px-4 py-2 font-mono text-xs text-gray-600">{rate !== null ? `${rate}%` : '-'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )
                })()}
              </div>
            </div>

            {/* ダミー：旧登録経路別テーブルの閉じタグ維持用 */}
            {(() => {
              const sources: [string, {count: number; contracted: number}][] = []
              if (sources.length === 0) return null
              return (
                <div className="border-t border-gray-100">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {sources.map(([src, s]) => (
                          <tr key={src} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-700">{src}</td>
                            <td className="px-4 py-2 font-mono text-gray-700">{s.count}</td>
                            <td className="px-4 py-2 font-mono font-bold text-green-600">{s.contracted}</td>
                            <td className="px-4 py-2 font-mono text-gray-600">
                              {s.count > 0 ? `${Math.round(s.contracted / s.count * 100)}%` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}

            {/* 日別テーブル */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['日付', '広告費', 'インプレッション', 'クリック', 'CTR', '登録数', 'CPR'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map(d => {
                    const dayCpr = d.registrations > 0 ? Math.round(d.amount_spent / d.registrations) : null
                    const dayCtr = d.impressions > 0 ? (d.clicks / d.impressions * 100).toFixed(2) : '-'
                    return (
                      <tr key={d.day} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700">{d.day}</td>
                        <td className="px-4 py-2 font-mono text-gray-700">¥{Math.round(d.amount_spent).toLocaleString()}</td>
                        <td className="px-4 py-2 font-mono text-gray-500">{d.impressions.toLocaleString()}</td>
                        <td className="px-4 py-2 font-mono text-gray-500">{d.clicks.toLocaleString()}</td>
                        <td className="px-4 py-2 font-mono text-gray-500">{dayCtr}%</td>
                        <td className="px-4 py-2 font-mono font-bold text-blue-600">{d.registrations}</td>
                        <td className="px-4 py-2 font-mono text-gray-700">{dayCpr ? `¥${dayCpr.toLocaleString()}` : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}
      </>)}

      {activeTab === 'overview' && (<>
      {/* 担当者別KPI */}
      {memberStats.length > 0 && (
        <div className="bg-white border border-gray-200 rounded overflow-x-auto">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700">担当者別KPI</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['担当者', '成約', '保留', '実商談', 'キャンセル', 'キャンセル率', '成約率', '売上'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {memberStats.map(s => (
                <tr key={s.member.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.member.name}</td>
                  <td className="px-4 py-3 font-bold text-green-600">{s.contracted}</td>
                  <td className="px-4 py-3 text-amber-600">{s.held}</td>
                  <td className="px-4 py-3 text-gray-600">{s.conducted}</td>
                  <td className="px-4 py-3 text-red-400">{s.cancelled}</td>
                  <td className="px-4 py-3">
                    <span className={s.cancelRate > 20 ? 'text-red-500 font-bold' : 'text-gray-600'}>{s.cancelRate}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={s.contractRate >= 50 ? 'text-green-600 font-bold' : 'text-gray-600'}>{s.contractRate}%</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700">
                    {s.revenue > 0 ? `¥${s.revenue.toLocaleString()}` : '-'}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 border-t border-gray-200 font-bold">
                <td className="px-4 py-3 text-gray-500">合計</td>
                <td className="px-4 py-3 text-green-600">{contracted.length}</td>
                <td className="px-4 py-3 text-amber-600">{held.length}</td>
                <td className="px-4 py-3 text-gray-600">{conducted.length}</td>
                <td className="px-4 py-3 text-red-400">{cancelled.length}</td>
                <td className="px-4 py-3 text-gray-600">{cancelRate}%</td>
                <td className="px-4 py-3 text-gray-600">{contractRate}%</td>
                <td className="px-4 py-3 font-mono text-gray-700">
                  {totalRevenue > 0 ? `¥${totalRevenue.toLocaleString()}` : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      </>)}

      {activeTab === 'applications' && (() => {
        const applications = consultations.filter(c => {
          if (filterServiceType && (c.service_type ?? 'AI CAMP') !== filterServiceType) return false
          return true
        })
        return (
          <div className="bg-white border border-gray-200 rounded">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700">申し込み一覧 ({applications.length}件)</h2>
              <div className="flex gap-2 items-center flex-wrap">
                <select
                  value={filterServiceType}
                  onChange={e => setFilterServiceType(e.target.value)}
                  className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="">サービス: 全て</option>
                  {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
                </select>
                {filterServiceType && (
                  <button onClick={() => setFilterServiceType('')} className="text-xs text-gray-400 hover:text-gray-600 px-1">×</button>
                )}
                <AIImport members={members} onImported={fetchAll} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">実施日時</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">サービス</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">担当者</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">氏名</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">年齢</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">職業</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">月収</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap min-w-[160px]">叶えたいこと</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Zoom</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">ステータス</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.length === 0 ? (
                    <tr><td colSpan={11} className="text-center py-10 text-gray-400">申し込みがありません</td></tr>
                  ) : applications.map(c => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                        {c.consultation_date
                          ? new Date(c.consultation_date).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{c.service_type ?? 'AI CAMP'}</td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{(c.member as any)?.name ?? '-'}</td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-800 whitespace-nowrap">{c.name ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">{c.age ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{c.occupation ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{c.monthly_income ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px]">
                        <span className="line-clamp-2">{c.motivation ?? '-'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {c.minutes_url
                          ? <a href={c.minutes_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">Zoom</a>
                          : <span className="text-xs text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[c.status ?? '予定'] ?? 'bg-gray-100 text-gray-500'}`}>
                          {c.status ?? '予定'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2 items-center">
                          <select
                            defaultValue={c.status ?? '予定'}
                            onChange={async e => {
                              await supabase.from('aicamp_consultations').update({ status: e.target.value }).eq('id', c.id)
                              fetchAll()
                            }}
                            className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                            onClick={e => e.stopPropagation()}
                          >
                            {CONSULTATION_STATUSES.map(s => <option key={s}>{s}</option>)}
                          </select>
                          <button
                            onClick={() => { setEditTarget(c); setShowForm(true) }}
                            className="text-xs text-blue-500 hover:underline whitespace-nowrap"
                          >
                            詳細編集
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {activeTab === 'deals' && (
      <div className="bg-white border border-gray-200 rounded">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-gray-700">商談一覧 ({filtered.length}件)</h2>
            {selectedIds.size > 0 && (
              <button
                onClick={bulkDelete}
                disabled={bulkDeleting}
                className="text-xs text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 px-3 py-1 rounded transition"
              >
                {bulkDeleting ? '削除中...' : `${selectedIds.size}件を削除`}
              </button>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none">
              <option value="">担当者: 全員</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none">
              <option value="">ステータス: 全て</option>
              {['予定', '成約', '失注', '保留', 'ドタキャン', 'キャンセル'].map(s => <option key={s}>{s}</option>)}
            </select>
            {(filterMember || filterStatus) && (
              <button onClick={() => { setFilterMember(''); setFilterStatus('') }} className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
            )}
            {/* 列設定 */}
            <div className="relative">
              <button
                onClick={() => setShowColSettings(v => !v)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50 transition text-gray-600"
              >
                列設定
              </button>
              {showColSettings && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-xl z-50 p-3 w-48">
                  <p className="text-xs font-bold text-gray-500 mb-2">表示する列</p>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {AICAMP_COLUMNS.map(col => (
                      <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                        <input
                          type="checkbox"
                          checked={visibleCols.has(col.key)}
                          onChange={() => toggleCol(col.key)}
                          className="rounded"
                        />
                        <span className="text-xs text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowColSettings(false)}
                    className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 py-1"
                  >
                    閉じる
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                {AICAMP_COLUMNS.filter(col => visibleCols.has(col.key)).map(col => (
                  <th key={col.key} className={`px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${AICAMP_COL_MIN_WIDTH[col.key] ?? ''}`}>
                    {col.label}
                  </th>
                ))}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={visibleCols.size + 2} className="text-center py-10 text-gray-400">商談がありません</td></tr>
              ) : filtered.map(c => {
                const isEditing = inlineEditId === c.id
                return (
                  <tr key={c.id} className={`border-b border-gray-50 ${isEditing ? 'bg-blue-50' : selectedIds.has(c.id) ? 'bg-red-50' : 'hover:bg-gray-50 cursor-pointer'}`}
                    onClick={!isEditing ? () => startInlineEdit(c) : undefined}
                  >
                    <td className="px-4 py-3 w-8" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="rounded"
                      />
                    </td>
                    {visibleCols.has('consultation_date') && (
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <input type="datetime-local" value={inlineDraft.consultation_date} onChange={e => setDraft('consultation_date', e.target.value)}
                            className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-40" />
                        ) : (
                          <span className="text-gray-600 text-xs">
                            {c.consultation_date ? new Date(c.consultation_date).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </span>
                        )}
                      </td>
                    )}
                    {visibleCols.has('service_type') && (
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <select value={inlineDraft.service_type} onChange={e => setDraft('service_type', e.target.value)} className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none w-36">
                            {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        ) : <span className="text-xs text-gray-600">{c.service_type ?? 'AI CAMP'}</span>}
                      </td>
                    )}
                    {visibleCols.has('member_id') && (
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <select value={inlineDraft.member_id} onChange={e => setDraft('member_id', e.target.value)}
                            className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                            <option value="">未割当</option>
                            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        ) : <span className="text-gray-700">{(c.member as any)?.name ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('name') && (
                      <td className="px-4 py-3" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <input value={inlineDraft.name} onChange={e => setDraft('name', e.target.value)}
                            className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-28" placeholder="氏名" />
                        ) : <span className="font-medium text-gray-800">{c.name ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('line_name') && (
                      <td className="px-4 py-3 min-w-[140px]" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? <input value={inlineDraft.line_name} onChange={e => setDraft('line_name', e.target.value)} className="border border-blue-300 rounded px-2 py-1 text-xs w-36 focus:outline-none" />
                          : <span className="text-xs text-gray-500">{c.line_name ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('age') && (
                      <td className="px-4 py-3" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? <input type="number" value={inlineDraft.age} onChange={e => setDraft('age', e.target.value)} className="border border-blue-300 rounded px-2 py-1 text-xs font-mono w-16 focus:outline-none" />
                          : <span className="text-xs text-gray-500 font-mono">{c.age ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('source') && (
                      <td className="px-4 py-3 min-w-[180px]" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <input value={inlineDraft.source} onChange={e => setDraft('source', e.target.value)}
                            className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-44" placeholder="流入経路" />
                        ) : <span className="text-xs text-gray-500">{c.source ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('registration_source') && (
                      <td className="px-4 py-3 max-w-[160px]" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? <input value={inlineDraft.registration_source} onChange={e => setDraft('registration_source', e.target.value)} className="border border-blue-300 rounded px-2 py-1 text-xs w-36 focus:outline-none" />
                          : <span className="text-xs text-gray-500 line-clamp-1">{c.registration_source ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('status') && (
                      <td className="px-4 py-3" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <select value={inlineDraft.status} onChange={e => setDraft('status', e.target.value)}
                            className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                            {CONSULTATION_STATUSES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[c.status ?? '予定'] ?? 'bg-gray-100 text-gray-500'}`}>
                            {c.status ?? '予定'}
                          </span>
                        )}
                      </td>
                    )}
                    {visibleCols.has('payment_amount') && (
                      <td className="px-4 py-3" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <input type="number" value={inlineDraft.payment_amount} onChange={e => setDraft('payment_amount', e.target.value)}
                            className="border border-blue-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 w-28" placeholder="円" />
                        ) : <span className="font-mono text-gray-700">{c.payment_amount ? `¥${c.payment_amount.toLocaleString()}` : '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('payment_date') && (
                      <td className="px-4 py-3" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? <input type="date" value={inlineDraft.payment_date} onChange={e => setDraft('payment_date', e.target.value)} className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none" />
                          : <span className="text-xs text-gray-500">{c.payment_date ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('payment_method') && (
                      <td className="px-4 py-3" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <select value={inlineDraft.payment_method} onChange={e => setDraft('payment_method', e.target.value)} className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none">
                            <option value="">-</option>
                            {PAYMENT_METHODS.map(p => <option key={p}>{p}</option>)}
                          </select>
                        ) : <span className="text-xs text-gray-500">{c.payment_method ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('reply_deadline') && (
                      <td className="px-4 py-3" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <input type="date" value={inlineDraft.reply_deadline} onChange={e => setDraft('reply_deadline', e.target.value)}
                            className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        ) : <span className="text-xs text-gray-500">{c.reply_deadline ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('occupation') && (
                      <td className="px-4 py-3" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? <input value={inlineDraft.occupation} onChange={e => setDraft('occupation', e.target.value)} className="border border-blue-300 rounded px-2 py-1 text-xs w-24 focus:outline-none" />
                          : <span className="text-xs text-gray-500">{c.occupation ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('monthly_income') && (
                      <td className="px-4 py-3" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <select value={inlineDraft.monthly_income} onChange={e => setDraft('monthly_income', e.target.value)} className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none">
                            <option value="">-</option>
                            {MONTHLY_INCOMES.map(i => <option key={i}>{i}</option>)}
                          </select>
                        ) : <span className="text-xs text-gray-500">{c.monthly_income ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('ai_experience') && (
                      <td className="px-4 py-3 max-w-[180px]" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <select value={inlineDraft.ai_experience} onChange={e => setDraft('ai_experience', e.target.value)} className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none w-40">
                            <option value="">-</option>
                            {AI_EXPERIENCES.map(e => <option key={e}>{e}</option>)}
                          </select>
                        ) : <span className="text-xs text-gray-400 line-clamp-2">{c.ai_experience ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('customer_attribute') && (
                      <td className="px-4 py-3 max-w-[160px]" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? <input value={inlineDraft.customer_attribute} onChange={e => setDraft('customer_attribute', e.target.value)} className="border border-blue-300 rounded px-2 py-1 text-xs w-36 focus:outline-none" />
                          : <span className="text-xs text-gray-400 line-clamp-2">{c.customer_attribute ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('motivation') && (
                      <td className="px-4 py-3 max-w-[200px]" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? <textarea value={inlineDraft.motivation} onChange={e => setDraft('motivation', e.target.value)} className="border border-blue-300 rounded px-2 py-1 text-xs w-48 h-16 resize-none focus:outline-none" />
                          : <span className="text-xs text-gray-400 line-clamp-2">{c.motivation ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('reason') && (
                      <td className="px-4 py-3 max-w-[160px]" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? <textarea value={inlineDraft.reason} onChange={e => setDraft('reason', e.target.value)} className="border border-blue-300 rounded px-2 py-1 text-xs w-40 h-16 resize-none focus:outline-none" />
                          : <span className="text-xs text-gray-400 line-clamp-2">{c.reason ?? '-'}</span>}
                      </td>
                    )}
                    {visibleCols.has('minutes_url') && (
                      <td className="px-4 py-3" onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing ? <input value={inlineDraft.minutes_url} onChange={e => setDraft('minutes_url', e.target.value)} className="border border-blue-300 rounded px-2 py-1 text-xs w-36 focus:outline-none" placeholder="https://..." />
                          : c.minutes_url
                            ? <a href={c.minutes_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline" onClick={e => e.stopPropagation()}>開く</a>
                            : <span className="text-xs text-gray-300">-</span>}
                      </td>
                    )}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2 justify-end whitespace-nowrap">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveInlineEdit(c.id)} disabled={inlineSaving}
                              className="text-xs text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50 transition">
                              {inlineSaving ? '...' : '保存'}
                            </button>
                            <button onClick={cancelInlineEdit} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditTarget(c); setShowForm(true) }} className="text-xs text-blue-500 hover:underline">詳細編集</button>
                            <button onClick={() => deleteConsultation(c.id)} className="text-xs text-red-400 hover:underline">削除</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {showSourceMaster && <SourceMasterModal onClose={() => setShowSourceMaster(false)} />}

      {showForm && (
        <AICampConsultationForm
          members={members}
          initial={editTarget}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
          onSaved={() => { setShowForm(false); setEditTarget(null); fetchAll() }}
        />
      )}
    </div>
  )
}
