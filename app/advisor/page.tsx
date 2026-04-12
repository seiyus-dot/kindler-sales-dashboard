'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AiCoachClient, AiCoachItem } from '@/lib/supabase'

// ── helpers ───────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]
const addMonths = (dateStr: string, n: number) => {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const fmtDate = (s: string) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${y}/${m}/${d}` }

const PLAN_MONTHS: Record<string, number> = { '3ヶ月': 3, '6ヶ月': 6, '12ヶ月': 12 }
const BAR_COLORS = [
  '#1a3a6e','#b8902a','#2a7a4a','#a04a20','#5a3a9a','#3a7a9a','#9a3a5a','#4a8a4a',
]
const PHASE_OPTIONS = ['ヒアリング','提案中','契約交渉','研修実施中','フォロー中','完了']
const PHASE_COLOR: Record<string, string> = {
  'ヒアリング':'#3a7a9a','提案中':'#b8902a','契約交渉':'#a04a20',
  '研修実施中':'#2a7a4a','フォロー中':'#5a3a9a','完了':'#8a96b0',
}

const DOW = ['日', '月', '火', '水', '木', '金', '土']

function getAllDays(start: string, end: string) {
  const result: { date: string; day: number; dow: string; isSat: boolean; isSun: boolean; isMonthStart: boolean }[] = []
  const d = new Date(start + 'T00:00:00')
  const endD = new Date(end + 'T00:00:00')
  while (d <= endD) {
    const s = d.toISOString().split('T')[0]
    const dow = DOW[d.getDay()]
    result.push({ date: s, day: d.getDate(), dow, isSat: d.getDay() === 6, isSun: d.getDay() === 0, isMonthStart: d.getDate() === 1 })
    d.setDate(d.getDate() + 1)
  }
  return result
}
function getMonthStarts(start: string, end: string): Date[] {
  const months: Date[] = []
  const cur = new Date(start)
  cur.setDate(1)
  while (cur.toISOString().split('T')[0] <= end) {
    months.push(new Date(cur))
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

// ── Badge / ProgressBar ───────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: color + '18', color, border: `1px solid ${color}44`, borderRadius: 999, fontSize: 10, padding: '2px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}
function ProgressBar({ value, color = '#1a3a6e' }: { value: number; color?: string }) {
  return (
    <div style={{ background: '#e8ebf4', borderRadius: 999, height: 5, overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .5s' }} />
    </div>
  )
}

// ── GanttView ─────────────────────────────────────────────
function GanttView({ client, isMobile, onUpdateItems }: { client: AiCoachClient; isMobile: boolean; onUpdateItems: (clientId: string, items: AiCoachItem[]) => Promise<void> }) {
  const planEnd = addMonths(client.startDate, PLAN_MONTHS[client.plan] ?? 6)
  const totalDays = daysBetween(client.startDate, planEnd)
  const [editingItem, setEditingItem] = useState<AiCoachItem | null>(null)
  const [addingItem, setAddingItem] = useState(false)
  const LABEL_W = isMobile ? 84 : 148
  const DAY_PX = totalDays <= 100 ? (isMobile ? 14 : 24) : totalDays <= 200 ? (isMobile ? 8 : 16) : (isMobile ? 5 : 10)
  const chartW = Math.max(totalDays * DAY_PX, isMobile ? 440 : 540)
  const allDays = getAllDays(client.startDate, planEnd)
  const monthStarts = getMonthStarts(client.startDate, planEnd)
  const pct = (v: number) => `${clamp((v / totalDays) * 100, 0, 100)}%`
  const todayOff = daysBetween(client.startDate, todayStr())
  const todayPct = clamp((todayOff / totalDays) * 100, 0, 100)
  const showToday = todayOff >= 0 && todayOff <= totalDays
  const doneCount = client.items.filter(i => i.end < todayStr()).length
  const progress = client.items.length ? Math.round((doneCount / client.items.length) * 100) : 0

  const saveItem = async (item: AiCoachItem) => {
    const exists = client.items.find(i => i.id === item.id)
    const newItems = exists ? client.items.map(i => i.id === item.id ? item : i) : [...client.items, item]
    await onUpdateItems(client.id, newItems)
    setEditingItem(null)
    setAddingItem(false)
  }
  const deleteItem = async (id: string) => {
    await onUpdateItems(client.id, client.items.filter(i => i.id !== id))
    setEditingItem(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><ProgressBar value={progress} /></div>
        <span style={{ fontSize: 12, color: '#1a3a6e', fontWeight: 700, minWidth: 32 }}>{progress}%</span>
        <span style={{ fontSize: 11, color: '#aab0c8' }}>{doneCount}/{client.items.length} 完了</span>
        <button onClick={() => setAddingItem(true)}
          style={{ background: '#f0f4ff', border: '1.5px solid #c8d4f0', color: '#1a3a6e', borderRadius: 8, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
          ＋ タスク
        </button>
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1.5px solid #e0e6f0', borderRadius: 12, background: '#fff' }}>
        <div style={{ width: chartW + LABEL_W }}>
          {/* month row */}
          <div style={{ display: 'flex', background: '#f0f2fa', borderBottom: '1px solid #e0e6f0', height: 22 }}>
            <div style={{ width: LABEL_W, minWidth: LABEL_W, borderRight: '1px solid #eef0f8' }} />
            <div style={{ flex: 1, position: 'relative', width: chartW }}>
              {monthStarts.map((m, i) => {
                const off = daysBetween(client.startDate, m.toISOString().split('T')[0])
                const l = clamp((off / totalDays) * 100, 0, 100)
                return (
                  <div key={i} style={{ position: 'absolute', left: `${l}%`, top: 0, bottom: 0 }}>
                    <div style={{ borderLeft: '1px solid #d0d8ec', height: '100%', position: 'absolute' }} />
                    <span style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#1a3a6e', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {m.getFullYear()}年{m.getMonth() + 1}月
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
          {/* date row */}
          <div style={{ display: 'flex', background: '#f8f9fd', borderBottom: '1px solid #f0f2f8', height: 20 }}>
            <div style={{ width: LABEL_W, minWidth: LABEL_W, borderRight: '1px solid #eef0f8' }} />
            <div style={{ flex: 1, position: 'relative', width: chartW }}>
              {allDays.map((d, i) => {
                const l = (i / totalDays) * 100
                const w = (1 / totalDays) * 100
                return (
                  <div key={i} style={{ position: 'absolute', left: `${l}%`, width: `${w}%`, top: 0, bottom: 0, borderLeft: '1px solid #eef0f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(!isMobile || i % 2 === 0) && (
                      <span style={{ fontSize: 9, color: d.isSun ? '#c04a30' : d.isSat ? '#4a6aaa' : '#8a96b0', fontWeight: d.isMonthStart ? 700 : 400 }}>{d.day}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {/* DOW row */}
          <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e8ecf4', height: 20 }}>
            <div style={{ width: LABEL_W, minWidth: LABEL_W, borderRight: '1px solid #eef0f8' }} />
            <div style={{ flex: 1, position: 'relative', width: chartW }}>
              {allDays.map((d, i) => {
                const l = (i / totalDays) * 100
                const w = (1 / totalDays) * 100
                return (
                  <div key={i} style={{ position: 'absolute', left: `${l}%`, width: `${w}%`, top: 0, bottom: 0, borderLeft: '1px solid #eef0f8', display: 'flex', alignItems: 'center', justifyContent: 'center', background: d.isSat ? '#f0f4ff' : d.isSun ? '#fff4f4' : 'transparent' }}>
                    <span style={{ fontSize: 9, color: d.isSun ? '#c04a30' : d.isSat ? '#4a6aaa' : '#aab0c8', fontWeight: d.isSat || d.isSun ? 700 : 400 }}>{d.dow}</span>
                  </div>
                )
              })}
              {showToday && (
                <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, borderLeft: '2px solid #b8902a', zIndex: 2 }}>
                  <span style={{ position: 'absolute', top: 2, left: 3, fontSize: 8, color: '#b8902a', fontWeight: 700, whiteSpace: 'nowrap', background: '#fff', padding: '0 2px' }}>今日</span>
                </div>
              )}
            </div>
          </div>
          {/* rows */}
          {client.items.length === 0 ? (
            <div style={{ padding: '28px 0', textAlign: 'center', color: '#b0b8d0', fontSize: 12 }}>「＋ タスクを追加」で始めましょう</div>
          ) : client.items.map((item, idx) => {
            const left = clamp(daysBetween(client.startDate, item.start), 0, totalDays)
            const right = clamp(daysBetween(client.startDate, item.end) + 1, 0, totalDays)
            const w = Math.max(right - left, 1)
            const col = BAR_COLORS[item.colorIdx % BAR_COLORS.length]
            const isDone = item.end < todayStr()
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #f0f2f8', minHeight: 38, background: idx % 2 === 0 ? '#fff' : '#fafbff' }}>
                <div style={{ width: LABEL_W, minWidth: LABEL_W, borderRight: '1px solid #eef0f8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 0 10px', gap: 2 }}>
                  <span style={{ fontSize: isMobile ? 10 : 11, color: isDone ? '#b0b8d0' : '#4a5a7a', lineHeight: 1.3, wordBreak: 'break-all', flex: 1 }}>{item.label}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                    <button onClick={() => setEditingItem(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#aab0c8', padding: '1px 3px' }}>✏️</button>
                    <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#e0a0a0', padding: '1px 3px' }}>✕</button>
                  </div>
                </div>
                <div style={{ position: 'relative', height: 38, width: chartW }}>
                  {allDays.map((d, i) => (
                    <div key={i} style={{ position: 'absolute', left: `${(i / totalDays) * 100}%`, width: `${(1 / totalDays) * 100}%`, top: 0, bottom: 0, borderLeft: '1px solid #f0f2f8', background: d.isSat || d.isSun ? '#f8f9ff' : 'transparent' }} />
                  ))}
                  {showToday && <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, borderLeft: '2px solid #b8902a44', zIndex: 1 }} />}
                  <div onClick={() => setEditingItem(item)}
                    title={`${fmtDate(item.start)} → ${fmtDate(item.end)}`}
                    style={{ position: 'absolute', left: pct(left), width: pct(w), top: 0, height: '100%', background: isDone ? '#c8cce0' : col, cursor: 'pointer', display: 'flex', alignItems: 'center', paddingLeft: 6, overflow: 'hidden', whiteSpace: 'nowrap', fontSize: 10, color: '#fff', fontWeight: 600, zIndex: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    {(w / totalDays) > 0.08 ? item.label : ''}
                  </div>
                </div>
              </div>
            )
          })}
          <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid #eef0f8' }}>
            <button onClick={() => setAddingItem(true)} style={{ width: LABEL_W, minWidth: LABEL_W, background: 'none', border: 'none', cursor: 'pointer', padding: '9px 10px', fontSize: 11, color: '#1a3a6e', fontWeight: 700, textAlign: 'left', fontFamily: 'inherit' }}>＋ タスク追加</button>
            <div style={{ flex: 1, height: 36 }} />
          </div>
        </div>
      </div>
      {(editingItem || addingItem) && (
        <ItemModal item={editingItem ?? null} planStart={client.startDate} planEnd={planEnd}
          onSave={saveItem} onClose={() => { setEditingItem(null); setAddingItem(false) }} onDelete={deleteItem} />
      )}
    </div>
  )
}

// ── ItemModal ─────────────────────────────────────────────
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid #dde2ec', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', color: '#1a2540', background: '#fff', boxSizing: 'border-box', outline: 'none' }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#8a96b0', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }

function ItemModal({ item, planStart, planEnd, onSave, onClose, onDelete }: {
  item: AiCoachItem | null; planStart: string; planEnd: string;
  onSave: (item: AiCoachItem) => Promise<void>; onClose: () => void; onDelete: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState<AiCoachItem>(
    item ?? { id: crypto.randomUUID(), label: '', start: planStart, end: planStart, colorIdx: 0 }
  )
  const [saving, setSaving] = useState(false)
  const up = (k: keyof AiCoachItem, v: string | number) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520, boxShadow: '0 -8px 40px #0002' }}>
        <div style={{ width: 36, height: 4, background: '#dde2ec', borderRadius: 2, margin: '0 auto 18px' }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2540', marginBottom: 18 }}>{item ? 'タスクを編集' : 'タスクを追加'}</div>
        <label style={lbl}>タスク名</label>
        <input style={{ ...inp, marginBottom: 14 }} value={form.label} onChange={e => up('label', e.target.value)} placeholder="例: ワークショップ①" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {([['開始日', 'start'], ['終了日', 'end']] as const).map(([l, k]) => (
            <div key={k}><label style={lbl}>{l}</label><input type="date" style={inp} value={form[k]} min={planStart} max={planEnd} onChange={e => up(k, e.target.value)} /></div>
          ))}
        </div>
        <label style={lbl}>カラー</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {BAR_COLORS.map((c, i) => (
            <div key={i} onClick={() => up('colorIdx', i)} style={{ width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer', outline: form.colorIdx === i ? `3px solid ${c}` : '3px solid transparent', outlineOffset: 2 }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled={saving} onClick={async () => { setSaving(true); await onSave(form); setSaving(false) }}
            style={{ flex: 1, background: '#1a3a6e', border: 'none', borderRadius: 10, padding: 13, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {saving ? '保存中...' : '保存する'}
          </button>
          {item && (
            <button onClick={async () => { setSaving(true); await onDelete(item.id); setSaving(false) }}
              style={{ background: '#fff0ee', border: '1.5px solid #f0c0b0', borderRadius: 10, padding: '13px 16px', color: '#c04a30', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              削除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ClientModal ───────────────────────────────────────────
function ClientModal({ client, onSave, onClose }: { client: AiCoachClient | null; onSave: (c: AiCoachClient) => Promise<void>; onClose: () => void }) {
  const isNew = !client
  const [form, setForm] = useState<AiCoachClient>(
    client ?? { id: crypto.randomUUID(), name: '', plan: '6ヶ月', startDate: todayStr(), phase: 'ヒアリング', goals: '', items: [] }
  )
  const [saving, setSaving] = useState(false)
  const up = (k: keyof AiCoachClient, v: string) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px #0003', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2540', marginBottom: 22 }}>{isNew ? 'クライアントを追加' : 'クライアントを編集'}</div>
        <label style={lbl}>クライアント名</label>
        <input style={{ ...inp, marginBottom: 14 }} value={form.name} onChange={e => up('name', e.target.value)} placeholder="株式会社○○" />
        <label style={lbl}>開始日</label>
        <input type="date" style={{ ...inp, marginBottom: 14 }} value={form.startDate} onChange={e => up('startDate', e.target.value)} />
        <label style={lbl}>プラン</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {Object.keys(PLAN_MONTHS).map(p => (
            <button key={p} onClick={() => up('plan', p)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: 'none', fontFamily: 'inherit', fontWeight: form.plan === p ? 700 : 500, background: form.plan === p ? '#1a3a6e' : '#f0f2f6', color: form.plan === p ? '#fff' : '#6a7a9a' }}>
              {p}
            </button>
          ))}
        </div>
        <label style={lbl}>フェーズ</label>
        <select value={form.phase} onChange={e => up('phase', e.target.value)} style={{ ...inp, marginBottom: 14 }}>
          {PHASE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <label style={lbl}>目標設定</label>
        <textarea value={form.goals} onChange={e => up('goals', e.target.value)} rows={3} placeholder="例: AI活用で業務効率30%改善..." style={{ ...inp, resize: 'vertical', marginBottom: 22, lineHeight: 1.6 } as React.CSSProperties} />
        <button disabled={saving} onClick={async () => { setSaving(true); await onSave(form); setSaving(false) }}
          style={{ width: '100%', background: '#1a3a6e', border: 'none', borderRadius: 10, padding: 14, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  )
}

// ── OverviewView ──────────────────────────────────────────
function OverviewView({ clients, isMobile, onDrillDown }: { clients: AiCoachClient[]; isMobile: boolean; onDrillDown: (c: AiCoachClient) => void }) {
  const total = clients.length
  const byPlan = Object.keys(PLAN_MONTHS).map(p => ({ label: p, count: clients.filter(c => c.plan === p).length }))
  const byPhase = PHASE_OPTIONS.map(p => ({ label: p, count: clients.filter(c => c.phase === p).length })).filter(x => x.count > 0)
  const alerts = clients.filter(c => {
    const planEnd = addMonths(c.startDate, PLAN_MONTHS[c.plan] ?? 6)
    const d = daysBetween(todayStr(), planEnd)
    return d <= 30 && d >= 0
  })
  const active = clients.filter(c => ['研修実施中', 'フォロー中'].includes(c.phase))
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
        {([
          ['総クライアント', `${total}社`, '#1a3a6e'],
          ['稼働中', `${active.length}社`, '#2a7a4a'],
          ['今月終了予定', `${alerts.length}社`, alerts.length > 0 ? '#c04a30' : '#8a96b0'],
          ['提案中', `${clients.filter(c => c.phase === '提案中').length}社`, '#b8902a'],
        ] as const).map(([l, v, col]) => (
          <div key={l} style={{ background: '#fff', border: '1.5px solid #e0e6f0', borderRadius: 14, padding: '16px 18px', borderTop: `3px solid ${col}` }}>
            <div style={{ fontSize: 11, color: '#8a96b0', marginBottom: 6, fontWeight: 600 }}>{l}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: col }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', border: '1.5px solid #e0e6f0', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2540', marginBottom: 14 }}>プラン内訳</div>
        {byPlan.map(({ label, count }) => (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#4a5a7a' }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1a3a6e' }}>{count}社</span>
            </div>
            <ProgressBar value={total ? Math.round((count / total) * 100) : 0} />
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', border: '1.5px solid #e0e6f0', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2540', marginBottom: 12 }}>フェーズ状況</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {byPhase.map(({ label, count }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8f9fd', borderRadius: 8, padding: '8px 12px' }}>
              <Badge label={label} color={PHASE_COLOR[label] ?? '#8a96b0'} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a2540' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>
      {alerts.length > 0 && (
        <div style={{ background: '#fff8f0', border: '1.5px solid #f0d0b0', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#b8602a', marginBottom: 10 }}>終了30日以内</div>
          {alerts.map(c => {
            const planEnd = addMonths(c.startDate, PLAN_MONTHS[c.plan] ?? 6)
            const days = daysBetween(todayStr(), planEnd)
            return (
              <div key={c.id} onClick={() => onDrillDown(c)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0d8c0', cursor: 'pointer' }}>
                <span style={{ fontSize: 13, color: '#3a2a1a' }}>{c.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#c04a30' }}>残{days}日</span>
              </div>
            )
          })}
        </div>
      )}
      {active.length > 0 && (
        <div style={{ background: '#fff', border: '1.5px solid #e0e6f0', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2540', marginBottom: 12 }}>稼働中クライアント</div>
          {active.map(c => {
            const doneCount = c.items.filter(i => i.end < todayStr()).length
            const progress = c.items.length ? Math.round((doneCount / c.items.length) * 100) : 0
            return (
              <div key={c.id} onClick={() => onDrillDown(c)} style={{ padding: '10px 0', borderBottom: '1px solid #f0f2f8', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2540' }}>{c.name}</span>
                  <span style={{ fontSize: 11, color: '#1a3a6e', fontWeight: 700 }}>{progress}%</span>
                </div>
                <ProgressBar value={progress} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── ClientListView ────────────────────────────────────────
function ClientListView({ clients, isMobile, onEdit, onDrillDown }: { clients: AiCoachClient[]; isMobile: boolean; onEdit: (c: AiCoachClient) => void; onDrillDown: (c: AiCoachClient) => void }) {
  return (
    <div>
      {clients.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#b0b8d0', padding: 60, fontSize: 14 }}>「＋ 追加」でクライアントを登録してください</div>
      ) : clients.map(c => {
        const planEnd = addMonths(c.startDate, PLAN_MONTHS[c.plan] ?? 6)
        const doneCount = c.items.filter(i => i.end < todayStr()).length
        const progress = c.items.length ? Math.round((doneCount / c.items.length) * 100) : 0
        const daysLeft = daysBetween(todayStr(), planEnd)
        return (
          <div key={c.id} style={{ background: '#fff', border: '1.5px solid #e0e6f0', borderRadius: 14, padding: '16px 18px', marginBottom: 12, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
              <div onClick={() => onDrillDown(c)} style={{ flex: 1 }}>
                <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, color: '#1a2540', marginBottom: 6 }}>{c.name}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Badge label={c.plan} color="#1a3a6e" />
                  <Badge label={c.phase} color={PHASE_COLOR[c.phase] ?? '#8a96b0'} />
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); onEdit(c) }} style={{ background: '#f5f6fa', border: '1.5px solid #dde2ec', color: '#6a7a9a', borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>✏️ 編集</button>
            </div>
            {c.goals && (
              <div style={{ background: '#f8f9fd', borderRadius: 8, padding: '7px 10px', marginBottom: 10, borderLeft: '3px solid #b8902a' }}>
                <span style={{ fontSize: 11, color: '#4a5a7a' }}>{c.goals}</span>
              </div>
            )}
            <div onClick={() => onDrillDown(c)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: '#8a96b0' }}>{fmtDate(c.startDate)} 〜 {fmtDate(planEnd)}</span>
                <span style={{ fontSize: 11, color: daysLeft <= 30 && daysLeft >= 0 ? '#c04a30' : '#8a96b0', fontWeight: daysLeft <= 30 && daysLeft >= 0 ? 700 : 400 }}>
                  {daysLeft >= 0 ? `残${daysLeft}日` : '終了'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}><ProgressBar value={progress} /></div>
                <span style={{ fontSize: 11, color: '#1a3a6e', fontWeight: 700, minWidth: 30 }}>{progress}%</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── AllGanttView ──────────────────────────────────────────
function AllGanttView({ clients, isMobile, onDrillDown }: { clients: AiCoachClient[]; isMobile: boolean; onDrillDown: (c: AiCoachClient) => void }) {
  if (clients.length === 0) return <div style={{ textAlign: 'center', color: '#b0b8d0', padding: 60, fontSize: 14 }}>クライアントがいません</div>
  const allStarts = clients.map(c => c.startDate)
  const allEnds = clients.map(c => addMonths(c.startDate, PLAN_MONTHS[c.plan] ?? 6))
  const rangeStart = allStarts.reduce((a, b) => a < b ? a : b)
  const rangeEnd = allEnds.reduce((a, b) => a > b ? a : b)
  const totalDays = daysBetween(rangeStart, rangeEnd)
  const LABEL_W = isMobile ? 84 : 148
  const DAY_PX = totalDays <= 100 ? (isMobile ? 14 : 24) : totalDays <= 200 ? (isMobile ? 8 : 16) : (isMobile ? 5 : 10)
  const chartW = Math.max(totalDays * DAY_PX, isMobile ? 420 : 540)
  const allDays = getAllDays(rangeStart, rangeEnd)
  const monthStarts = getMonthStarts(rangeStart, rangeEnd)
  const todayOff = daysBetween(rangeStart, todayStr())
  const todayPct = clamp((todayOff / totalDays) * 100, 0, 100)
  const showToday = todayOff >= 0 && todayOff <= totalDays
  return (
    <div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1.5px solid #e0e6f0', borderRadius: 14, background: '#fff' }}>
        <div style={{ width: chartW + LABEL_W }}>
          <div style={{ display: 'flex', background: '#f0f2fa', borderBottom: '1px solid #e0e6f0', height: 22 }}>
            <div style={{ width: LABEL_W, minWidth: LABEL_W, borderRight: '1px solid #eef0f8', padding: '0 12px', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#8a96b0', fontWeight: 700 }}>クライアント</span>
            </div>
            <div style={{ flex: 1, position: 'relative', width: chartW }}>
              {monthStarts.map((m, i) => {
                const off = daysBetween(rangeStart, m.toISOString().split('T')[0])
                const l = clamp((off / totalDays) * 100, 0, 100)
                return (
                  <div key={i} style={{ position: 'absolute', left: `${l}%`, top: 0, bottom: 0 }}>
                    <div style={{ borderLeft: '1px solid #d0d8ec', height: '100%', position: 'absolute' }} />
                    <span style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#1a3a6e', fontWeight: 700, whiteSpace: 'nowrap' }}>{m.getFullYear()}年{m.getMonth() + 1}月</span>
                  </div>
                )
              })}
            </div>
          </div>
          {/* date row */}
          <div style={{ display: 'flex', background: '#f8f9fd', borderBottom: '1px solid #f0f2f8', height: 20 }}>
            <div style={{ width: LABEL_W, minWidth: LABEL_W, borderRight: '1px solid #eef0f8' }} />
            <div style={{ flex: 1, position: 'relative', width: chartW }}>
              {allDays.map((d, i) => (
                <div key={i} style={{ position: 'absolute', left: `${(i / totalDays) * 100}%`, width: `${(1 / totalDays) * 100}%`, top: 0, bottom: 0, borderLeft: '1px solid #eef0f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(!isMobile || i % 2 === 0) && <span style={{ fontSize: 9, color: d.isSun ? '#c04a30' : d.isSat ? '#4a6aaa' : '#8a96b0', fontWeight: d.isMonthStart ? 700 : 400 }}>{d.day}</span>}
                </div>
              ))}
            </div>
          </div>
          {/* DOW row */}
          <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e8ecf4', height: 20 }}>
            <div style={{ width: LABEL_W, minWidth: LABEL_W, borderRight: '1px solid #eef0f8' }} />
            <div style={{ flex: 1, position: 'relative', width: chartW }}>
              {allDays.map((d, i) => (
                <div key={i} style={{ position: 'absolute', left: `${(i / totalDays) * 100}%`, width: `${(1 / totalDays) * 100}%`, top: 0, bottom: 0, borderLeft: '1px solid #eef0f8', display: 'flex', alignItems: 'center', justifyContent: 'center', background: d.isSat ? '#f0f4ff' : d.isSun ? '#fff4f4' : 'transparent' }}>
                  <span style={{ fontSize: 9, color: d.isSun ? '#c04a30' : d.isSat ? '#4a6aaa' : '#aab0c8', fontWeight: d.isSat || d.isSun ? 700 : 400 }}>{d.dow}</span>
                </div>
              ))}
              {showToday && (
                <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, borderLeft: '2px solid #b8902a', zIndex: 2 }}>
                  <span style={{ position: 'absolute', top: 2, left: 3, fontSize: 8, color: '#b8902a', fontWeight: 700, background: '#fff', padding: '0 2px', whiteSpace: 'nowrap' }}>今日</span>
                </div>
              )}
            </div>
          </div>
          {clients.map((c, idx) => {
            const cStart = daysBetween(rangeStart, c.startDate)
            const cEnd = daysBetween(rangeStart, addMonths(c.startDate, PLAN_MONTHS[c.plan] ?? 6))
            const doneCount = c.items.filter(i => i.end < todayStr()).length
            const progress = c.items.length ? Math.round((doneCount / c.items.length) * 100) : 0
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f2f8', minHeight: 44, background: idx % 2 === 0 ? '#fff' : '#fafbff' }}>
                <div onClick={() => onDrillDown(c)} style={{ width: LABEL_W, minWidth: LABEL_W, padding: '4px 10px 4px 12px', borderRight: '1px solid #eef0f8', cursor: 'pointer' }}>
                  <div style={{ fontSize: isMobile ? 10 : 11, color: '#1a2540', fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>{c.name}</div>
                  <Badge label={c.plan} color="#1a3a6e" />
                </div>
                <div style={{ position: 'relative', height: 44, width: chartW }}>
                  {allDays.map((d, i) => (
                    <div key={i} style={{ position: 'absolute', left: `${(i / totalDays) * 100}%`, width: `${(1 / totalDays) * 100}%`, top: 0, bottom: 0, borderLeft: '1px solid #f0f2f8', background: d.isSat || d.isSun ? '#f8f9ff' : 'transparent' }} />
                  ))}
                  {showToday && <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, borderLeft: '2px dashed #b8902a55', zIndex: 1 }} />}
                  <div onClick={() => onDrillDown(c)}
                    style={{ position: 'absolute', left: `${clamp((cStart / totalDays) * 100, 0, 100)}%`, width: `${clamp(((cEnd - cStart) / totalDays) * 100, 0, 100)}%`, top: 0, height: '100%', background: '#1a3a6e22', borderLeft: '2px solid #1a3a6e88', borderRight: '2px solid #1a3a6e88', cursor: 'pointer', zIndex: 2 }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: '#1a3a6e55', transition: 'width .5s' }} />
                    {((cEnd - cStart) / totalDays) > 0.12 && (
                      <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: '#1a3a6e', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {c.name.length > 8 ? c.name.slice(0, 8) + '…' : c.name} {progress}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: '#aab0c8', textAlign: 'center' }}>クライアントをタップすると詳細ガントを表示</div>
    </div>
  )
}

// ── DetailView ────────────────────────────────────────────
function DetailView({ client, isMobile, onBack, onEdit, onUpdateItems }: { client: AiCoachClient; isMobile: boolean; onBack: () => void; onEdit: (c: AiCoachClient) => void; onUpdateItems: (clientId: string, items: AiCoachItem[]) => Promise<void> }) {
  const planEnd = addMonths(client.startDate, PLAN_MONTHS[client.plan] ?? 6)
  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#1a3a6e', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0, fontFamily: 'inherit' }}>← 戻る</button>
      <div style={{ background: '#fff', border: '1.5px solid #e0e6f0', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: '#1a2540', marginBottom: 8 }}>{client.name}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Badge label={client.plan} color="#1a3a6e" />
              <Badge label={client.phase} color={PHASE_COLOR[client.phase] ?? '#8a96b0'} />
              <span style={{ fontSize: 11, color: '#9aa3bc', alignSelf: 'center' }}>{fmtDate(client.startDate)} 〜 {fmtDate(planEnd)}</span>
            </div>
          </div>
          <button onClick={() => onEdit(client)} style={{ background: '#f5f6fa', border: '1.5px solid #dde2ec', color: '#6a7a9a', borderRadius: 8, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>✏️ 編集</button>
        </div>
        {client.goals && (
          <div style={{ marginTop: 12, background: '#f8f9fd', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid #b8902a' }}>
            <span style={{ fontSize: 12, color: '#3a4a6a' }}>{client.goals}</span>
          </div>
        )}
      </div>
      <GanttView client={client} isMobile={isMobile} onUpdateItems={onUpdateItems} />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: '概要' },
  { id: 'list', label: 'クライアント一覧' },
  { id: 'gantt', label: 'ガントチャート' },
]

export default function AdvisorPage() {
  const [clients, setClients] = useState<AiCoachClient[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [drillClient, setDrillClient] = useState<AiCoachClient | null>(null)
  const [editingClient, setEditingClient] = useState<AiCoachClient | null>(null)
  const [addingClient, setAddingClient] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const fetchAll = useCallback(async () => {
    const [clientsRes, itemsRes] = await Promise.all([
      supabase.from('aicoach_clients').select('*').order('created_at'),
      supabase.from('aicoach_items').select('*').order('sort_order'),
    ])
    const clientsData = clientsRes.data ?? []
    const itemsData = itemsRes.data ?? []
    const merged: AiCoachClient[] = clientsData.map((c: { id: string; name: string; plan: string; start_date: string; phase: string; goals: string | null }) => ({
      id: c.id,
      name: c.name,
      plan: c.plan,
      startDate: c.start_date,
      phase: c.phase,
      goals: c.goals ?? '',
      items: itemsData
        .filter((i: { client_id: string }) => i.client_id === c.id)
        .map((i: { id: string; label: string; start_date: string; end_date: string; color_idx: number }) => ({
          id: i.id,
          label: i.label,
          start: i.start_date,
          end: i.end_date,
          colorIdx: i.color_idx,
        })),
    }))
    setClients(merged)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const saveClient = async (client: AiCoachClient) => {
    const isNew = !clients.find(c => c.id === client.id)
    if (isNew) {
      const { data } = await supabase.from('aicoach_clients').insert({
        name: client.name, plan: client.plan, start_date: client.startDate, phase: client.phase, goals: client.goals || null,
      }).select().single()
      if (data) {
        const planEnd = addMonths(client.startDate, PLAN_MONTHS[client.plan] ?? 6)
        const { data: itemData } = await supabase.from('aicoach_items').insert({
          client_id: data.id, label: 'AI顧問契約期間', start_date: client.startDate, end_date: planEnd, color_idx: 0, sort_order: 0,
        }).select().single()
        const defaultItem: AiCoachItem = itemData
          ? { id: itemData.id, label: itemData.label, start: itemData.start_date, end: itemData.end_date, colorIdx: itemData.color_idx }
          : { id: crypto.randomUUID(), label: 'AI顧問契約期間', start: client.startDate, end: planEnd, colorIdx: 0 }
        setClients(prev => [...prev, { ...client, id: data.id, items: [defaultItem] }])
      }
    } else {
      await supabase.from('aicoach_clients').update({
        name: client.name, plan: client.plan, start_date: client.startDate, phase: client.phase, goals: client.goals || null,
      }).eq('id', client.id)
      setClients(prev => prev.map(c => c.id === client.id ? { ...client } : c))
    }
    setEditingClient(null)
    setAddingClient(false)
  }

  const updateItems = async (clientId: string, items: AiCoachItem[]) => {
    await supabase.from('aicoach_items').delete().eq('client_id', clientId)
    if (items.length > 0) {
      await supabase.from('aicoach_items').insert(
        items.map((item, idx) => ({
          client_id: clientId, label: item.label, start_date: item.start, end_date: item.end, color_idx: item.colorIdx, sort_order: idx,
        }))
      )
    }
    const { data: newItems } = await supabase.from('aicoach_items').select('*').eq('client_id', clientId).order('sort_order')
    const updatedItems: AiCoachItem[] = (newItems ?? []).map((i: { id: string; label: string; start_date: string; end_date: string; color_idx: number }) => ({
      id: i.id, label: i.label, start: i.start_date, end: i.end_date, colorIdx: i.color_idx,
    }))
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, items: updatedItems } : c))
    setDrillClient(prev => prev?.id === clientId ? { ...prev, items: updatedItems } : prev)
  }

  const currentClient = drillClient ? clients.find(c => c.id === drillClient.id) ?? drillClient : null

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">読み込み中...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6fb', fontFamily: "'Noto Sans JP',sans-serif", margin: '-24px -16px' }}>
      {/* header */}
      <div style={{ background: '#fff', borderBottom: '1.5px solid #e0e6f0', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ padding: isMobile ? '12px 16px 0' : '14px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#b8902a', marginBottom: 2 }}>KINDLER</div>
            <h1 style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: '#1a2540', margin: 0 }}>
              {currentClient ? currentClient.name : 'AI顧問 進捗管理'}
            </h1>
          </div>
          {!drillClient && (
            <button onClick={() => setAddingClient(true)}
              style={{ background: '#1a3a6e', border: 'none', borderRadius: 10, padding: isMobile ? '8px 14px' : '9px 18px', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              ＋ 追加
            </button>
          )}
        </div>
        {!drillClient && (
          <div style={{ display: 'flex', padding: isMobile ? '0 16px' : '0 28px', marginTop: 10, borderTop: '1px solid #f0f2f8' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 14px 11px', fontSize: isMobile ? 11 : 12, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? '#1a3a6e' : '#8a96b0', borderBottom: tab === t.id ? '3px solid #1a3a6e' : '3px solid transparent', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* content */}
      <div style={{ padding: isMobile ? '14px 12px' : '20px 28px' }}>
        {drillClient && currentClient ? (
          <DetailView client={currentClient} isMobile={isMobile}
            onBack={() => setDrillClient(null)}
            onEdit={c => setEditingClient(c)}
            onUpdateItems={updateItems} />
        ) : tab === 'overview' ? (
          <OverviewView clients={clients} isMobile={isMobile} onDrillDown={setDrillClient} />
        ) : tab === 'list' ? (
          <ClientListView clients={clients} isMobile={isMobile} onEdit={setEditingClient} onDrillDown={setDrillClient} />
        ) : (
          <AllGanttView clients={clients} isMobile={isMobile} onDrillDown={setDrillClient} />
        )}
      </div>

      {(editingClient || addingClient) && (
        <ClientModal client={editingClient ?? null} onSave={saveClient} onClose={() => { setEditingClient(null); setAddingClient(false) }} />
      )}
    </div>
  )
}
