import { useState } from 'react'
import { supabase, Member, MemberMonthlyGoal, AICampConsultation, DealToB } from '@/lib/supabase'
import { CheckCircle2, Target, Edit2, Save, X } from 'lucide-react'

type MemberProgress = {
  member: Member
  goal?: MemberMonthlyGoal
  currentAmount: number
  wonCount: number
}

export default function MemberWhiteboard({
  members,
  goals,
  tobDeals,
  aicampDeals,
  month,
  onSaved
}: {
  members: Member[]
  goals: MemberMonthlyGoal[]
  tobDeals: DealToB[]
  aicampDeals: AICampConsultation[]
  month: string
  onSaved: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editingGoals, setEditingGoals] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  const data: MemberProgress[] = members.map(m => {
    const goal = goals.find(g => g.member_id === m.id)
    
    const tobPaid = tobDeals
      .filter(d => d.member_id === m.id && d.payment_date?.startsWith(month))
      .reduce((s, d) => s + (d.actual_amount ?? d.expected_amount ?? 0), 0)
    
    const aicampPaid = aicampDeals
      .filter(d => d.member_id === m.id && 
        ((d.payment_date && d.payment_date.startsWith(month)) || 
         (!d.payment_date && d.consultation_date && d.consultation_date.startsWith(month))))
      .reduce((s, d) => s + Math.round((d.payment_amount ?? 0) / 10000), 0)

    const currentAmount = tobPaid + aicampPaid
    const wonCount = tobDeals.filter(d => d.member_id === m.id && d.status === '受注' && d.payment_date?.startsWith(month)).length +
                   aicampDeals.filter(d => d.member_id === m.id && d.status === '成約' && (d.payment_date?.startsWith(month) || (!d.payment_date && d.consultation_date?.startsWith(month)))).length

    return { member: m, goal, currentAmount, wonCount }
  })

  function startEditing() {
    const initial: Record<string, string> = {}
    members.forEach(m => {
      const goal = goals.find(g => g.member_id === m.id)
      initial[m.id] = goal?.target_amount.toString() ?? '0'
    })
    setEditingGoals(initial)
    setIsEditing(true)
  }

  async function saveGoals() {
    setIsSaving(true)
    try {
      for (const m of members) {
        const val = parseInt(editingGoals[m.id]) || 0
        const existing = goals.find(g => g.member_id === m.id)

        if (existing) {
          const { error } = await supabase
            .from('member_monthly_goals')
            .update({ target_amount: val })
            .eq('id', existing.id)
          if (error) throw new Error(error.message)
        } else {
          const { error } = await supabase
            .from('member_monthly_goals')
            .insert({ member_id: m.id, month, target_amount: val })
          if (error) throw new Error(error.message)
        }
      }

      onSaved()
      setIsEditing(false)
    } catch (err) {
      console.error(err)
      alert('保存に失敗しました: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setIsSaving(false)
    }
  }

  const [year, monthNum] = month.split('-')
  const displayMonth = `${parseInt(monthNum)}月`

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
      <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Target className="text-indigo-600" size={20} />
          {displayMonth}度 個人目標進捗
        </h2>
        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button
                onClick={saveGoals}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                <Save size={14} /> {isSaving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-50 transition"
              >
                <X size={14} /> キャンセル
              </button>
            </>
          ) : (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-50 transition"
            >
              <Edit2 size={14} /> 目標を編集
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {data.map(p => {
          const target = isEditing ? parseInt(editingGoals[p.member.id]) || 0 : p.goal?.target_amount ?? 0
          const progress = target > 0 ? Math.min(Math.round((p.currentAmount / target) * 100), 100) : 0
          const isAchieved = target > 0 && p.currentAmount >= target

          return (
            <div key={p.member.id} className="space-y-2">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">{p.member.name}</span>
                  {isAchieved && (
                    <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                      CLEAR
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-black text-slate-900 font-mono">{p.currentAmount.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-slate-400">/</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editingGoals[p.member.id]}
                        onChange={e => setEditingGoals(prev => ({ ...prev, [p.member.id]: e.target.value }))}
                        className="w-16 px-1.5 py-0.5 text-sm font-bold border border-indigo-200 rounded focus:border-indigo-500 focus:outline-none bg-indigo-50/30"
                      />
                      <span className="text-[10px] font-bold text-slate-400">万</span>
                    </div>
                  ) : (
                    <>
                      <span className="text-[10px] font-bold text-slate-400">{target.toLocaleString()}万</span>
                      <span className={`ml-3 text-sm font-black font-mono ${isAchieved ? 'text-emerald-500' : 'text-indigo-600'}`}>
                        {progress}%
                      </span>
                    </>
                  )}
                </div>
              </div>
              
              {!isEditing && (
                <>
                  <div className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out relative ${
                        isAchieved ? 'bg-emerald-400' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full animate-shimmer" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 size={12} className={p.wonCount > 0 ? 'text-emerald-500' : 'text-slate-300'} />
                      受注 {p.wonCount}件
                    </div>
                    {target > 0 && !isAchieved && (
                      <div className="text-slate-300 italic font-medium">
                        あと {(target - p.currentAmount).toLocaleString()}万円
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
