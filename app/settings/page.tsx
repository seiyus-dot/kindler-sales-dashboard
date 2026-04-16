'use client'

import { useEffect, useState } from 'react'
import { supabase, Member, MasterOption, ColumnConfig } from '@/lib/supabase'
import PageHeader from '@/components/PageHeader'

type Section = 'members' | 'source' | 'service' | 'industry' | 'columns'
type ColTab = 'tob' | 'toc'

export default function SettingsPage() {
  const [section, setSection] = useState<Section>('members')
  const [members, setMembers] = useState<Member[]>([])
  const [options, setOptions] = useState<MasterOption[]>([])
  const [tobCols, setTobCols] = useState<ColumnConfig[]>([])
  const [tocCols, setTocCols] = useState<ColumnConfig[]>([])
  const [colTab, setColTab] = useState<ColTab>('tob')
  const [loading, setLoading] = useState(true)
  const [newValue, setNewValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [membersRes, optionsRes, colRes] = await Promise.all([
      supabase.from('members').select('*').order('sort_order'),
      supabase.from('master_options').select('*').order('sort_order'),
      supabase.from('column_config').select('*').order('sort_order'),
    ])
    if (membersRes.data) setMembers(membersRes.data)
    if (optionsRes.data) setOptions(optionsRes.data)
    if (colRes.data) {
      setTobCols(colRes.data.filter((c: ColumnConfig) => c.table_type === 'tob'))
      setTocCols(colRes.data.filter((c: ColumnConfig) => c.table_type === 'toc'))
    }
    setLoading(false)
  }

  const filteredOptions = options.filter(o => o.type === section)
  const activeCols = colTab === 'tob' ? tobCols : tocCols

  async function addMember() {
    if (!newValue.trim()) return
    setAdding(true)
    const maxOrder = Math.max(...members.map(m => m.sort_order), 0) + 1
    await supabase.from('members').insert({ name: newValue.trim(), sort_order: maxOrder })
    setNewValue('')
    setAdding(false)
    fetchAll()
  }

  async function deleteMember(id: string) {
    if (!confirm('削除しますか？案件データは残ります。')) return
    await supabase.from('members').delete().eq('id', id)
    fetchAll()
  }

  async function saveMemberName(id: string) {
    await supabase.from('members').update({ name: editValue }).eq('id', id)
    setEditingId(null)
    fetchAll()
  }

  async function addOption() {
    if (!newValue.trim()) return
    setAdding(true)
    const maxOrder = Math.max(...filteredOptions.map(o => o.sort_order), 0) + 1
    await supabase.from('master_options').insert({ type: section, value: newValue.trim(), sort_order: maxOrder })
    setNewValue('')
    setAdding(false)
    fetchAll()
  }

  async function deleteOption(id: string) {
    if (!confirm('削除しますか？')) return
    await supabase.from('master_options').delete().eq('id', id)
    fetchAll()
  }

  async function saveOptionValue(id: string) {
    await supabase.from('master_options').update({ value: editValue }).eq('id', id)
    setEditingId(null)
    fetchAll()
  }

  async function toggleCol(id: string, visible: boolean) {
    await supabase.from('column_config').update({ visible: !visible }).eq('id', id)
    fetchAll()
  }

  async function moveCol(id: string, direction: 'up' | 'down') {
    const cols = activeCols
    const idx = cols.findIndex(c => c.id === id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= cols.length) return
    const a = cols[idx], b = cols[swapIdx]
    await Promise.all([
      supabase.from('column_config').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('column_config').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    fetchAll()
  }

  function startEdit(id: string, value: string) {
    setEditingId(id)
    setEditValue(value)
  }

  const tabs: { key: Section; label: string }[] = [
    { key: 'members', label: '担当者' },
    { key: 'source', label: '流入経路' },
    { key: 'service', label: '検討サービス' },
    { key: 'industry', label: '業種' },
    { key: 'columns', label: '列設定' },
  ]

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="マスタ設定" sub="プルダウンの選択肢・表示列を管理します" />

      <div className="flex gap-1 bg-gray-100 p-1 rounded-sm w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setSection(t.key); setEditingId(null); setNewValue('') }}
            className={`px-4 py-2 rounded-md text-base font-medium transition-all ${section === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-base text-gray-400 py-8 text-center">読み込み中...</div>
      ) : section === 'columns' ? (
        <div className="space-y-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-sm w-fit">
            {(['tob', 'toc'] as ColTab[]).map(ct => (
              <button
                key={ct}
                onClick={() => setColTab(ct)}
                className={`px-4 py-1.5 rounded-md text-base font-medium transition-all ${colTab === ct ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
              >
                {ct === 'tob' ? '法人案件' : '個人案件'}
              </button>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {activeCols.map((col, idx) => (
                <li key={col.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`flex-1 text-base font-medium ${col.visible ? 'text-gray-700' : 'text-gray-300'}`}>
                    {col.label}
                  </span>
                  <button
                    onClick={() => toggleCol(col.id, col.visible)}
                    className={`px-3 py-1 rounded text-sm font-bold transition ${
                      col.visible ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {col.visible ? '表示' : '非表示'}
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveCol(col.id, 'up')}
                      disabled={idx === 0}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 disabled:opacity-20 text-base"
                    >↑</button>
                    <button
                      onClick={() => moveCol(col.id, 'down')}
                      disabled={idx === activeCols.length - 1}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 disabled:opacity-20 text-base"
                    >↓</button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="px-5 py-3 text-sm text-gray-400 bg-gray-50 border-t border-gray-100">
              変更はすぐに案件管理の表示列に反映されます
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {(section === 'members' ? members : filteredOptions).length === 0 ? (
              <li className="px-5 py-6 text-base text-gray-400 text-center">データがありません</li>
            ) : (section === 'members' ? members : filteredOptions).map(item => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                {editingId === item.id ? (
                  <>
                    <input
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                              autoFocus
                      className="flex-1 border border-blue-300 rounded px-3 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button onClick={() => section === 'members' ? saveMemberName(item.id) : saveOptionValue(item.id)} className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded transition">保存</button>
                    <button onClick={() => setEditingId(null)} className="text-sm text-gray-400 hover:text-gray-600">取消</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-base text-gray-700 font-medium">
                      {'name' in item ? item.name : item.value}
                    </span>
                    <button onClick={() => startEdit(item.id, 'name' in item ? item.name : item.value)} className="text-sm text-blue-500 hover:underline">編集</button>
                    <button onClick={() => section === 'members' ? deleteMember(item.id) : deleteOption(item.id)} className="text-sm text-red-400 hover:underline">削除</button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
            <input
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              placeholder={section === 'members' ? '担当者名を入力' : section === 'source' ? '流入経路を入力' : section === 'industry' ? '業種を入力' : 'サービス名を入力'}
              className="flex-1 border border-gray-200 rounded-sm px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={section === 'members' ? addMember : addOption}
              disabled={adding || !newValue.trim()}
              className="px-4 py-2 text-base font-medium text-white bg-blue-600 rounded-sm hover:bg-blue-700 disabled:opacity-40 transition"
            >
              追加
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
