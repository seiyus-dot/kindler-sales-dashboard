'use client'

import { useEffect, useState } from 'react'
import { supabase, Contract, ContractStatus, Member, Client, CONTRACT_STATUSES } from '@/lib/supabase'
import PageHeader from '@/components/PageHeader'
import ContractForm from '@/components/ContractForm'
import ContractDetailModal from '@/components/ContractDetailModal'

type Tab = 'form' | 'dash'

const STATUS_BADGE: Record<ContractStatus, string> = {
  '新規受付（未対応）': 'bg-red-100 text-red-600',
  '契約書作成中': 'bg-amber-100 text-amber-700',
  '送付済': 'bg-blue-100 text-blue-700',
  '締結完了': 'bg-green-100 text-green-700',
}

const STAT_TEXT: Record<ContractStatus, string> = {
  '新規受付（未対応）': 'text-red-600',
  '契約書作成中': 'text-amber-600',
  '送付済': 'text-blue-600',
  '締結完了': 'text-green-600',
}

function fmt(n: number) {
  return '¥' + n.toLocaleString('ja-JP')
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${y}年${m}月${d}日`
}

function fmtDateTime(s: string) {
  const dt = new Date(s)
  return dt.toLocaleDateString('ja-JP') + ' ' + dt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-lg text-xs font-medium shadow-lg z-[999]">
      {msg}
    </div>
  )
}

export default function ContractsPage() {
  const [tab, setTab] = useState<Tab>('form')
  const [contracts, setContracts] = useState<Contract[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [activeContract, setActiveContract] = useState<Contract | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  async function fetchAll() {
    setLoading(true)
    const [{ data: contractData }, { data: memberData }, { data: clientData }] = await Promise.all([
      supabase
        .from('contracts')
        .select('*, members(name), clients(*), contract_items(*)')
        .order('submitted_at', { ascending: false }),
      supabase.from('members').select('*').order('sort_order'),
      supabase.from('clients').select('*').order('company_name'),
    ])
    setContracts((contractData ?? []) as Contract[])
    setMembers((memberData ?? []) as Member[])
    setClients((clientData ?? []) as Client[])
    setLoading(false)
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').order('company_name')
    setClients((data ?? []) as Client[])
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const counts = CONTRACT_STATUSES.map(s => contracts.filter(c => c.status === s).length)

  return (
    <>
      <PageHeader title="契約管理" sub="営業フォームの申請をCSが受け取り、契約書発行までを管理します" />

      <div className="px-4 lg:px-6 pt-4">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab('form')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              tab === 'form' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            営業フォーム
          </button>
          <button
            onClick={() => setTab('dash')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              tab === 'dash' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            CSダッシュボード
            {counts[0] > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5">
                {counts[0]}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 lg:px-6 py-5">
        {tab === 'form' && (
          <ContractForm
            members={members}
            clients={clients}
            onClientsChanged={fetchClients}
            onSubmitted={() => {
              setToast('申請が完了しました。CSダッシュボードに送信されました。')
              fetchAll()
              setTimeout(() => setTab('dash'), 900)
            }}
          />
        )}

        {tab === 'dash' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">CS ダッシュボード</h2>
              <p className="text-xs text-slate-500 mt-1">営業からトスアップされた案件を確認・処理してください</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {CONTRACT_STATUSES.map((s, i) => (
                <div key={s} className="bg-white border border-slate-200 rounded-xl px-5 py-4">
                  <div className="text-[11px] text-slate-500">{s}</div>
                  <div className={`text-2xl font-bold mt-1 ${STAT_TEXT[s]}`}>{counts[i]}</div>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">案件一覧</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-[11px] font-semibold text-slate-500 px-4 py-2.5 whitespace-nowrap">企業名</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 px-4 py-2.5 whitespace-nowrap">担当</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 px-4 py-2.5 whitespace-nowrap">種別</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 px-4 py-2.5 whitespace-nowrap">契約金額（税込）</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 px-4 py-2.5 whitespace-nowrap">開始予定日</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 px-4 py-2.5 whitespace-nowrap">ステータス</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 px-4 py-2.5 whitespace-nowrap">申請日時</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && contracts.map(c => (
                      <tr
                        key={c.id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => setActiveContract(c)}
                      >
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{c.client_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{c.members?.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            c.contract_type === 'training' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'
                          }`}>
                            {c.contract_type === 'training' ? 'AI研修' : 'AI顧問'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-900">{fmt(c.total_tax_inc)}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{fmtDate(c.start_date)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[c.status]}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-500">{fmtDateTime(c.submitted_at)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={e => { e.stopPropagation(); setActiveContract(c) }}
                            className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-[11px] font-semibold hover:bg-blue-600 hover:text-white transition-colors"
                          >
                            詳細
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!loading && !contracts.length && (
                  <div className="text-center text-sm text-slate-400 py-12">まだ申請された案件がありません</div>
                )}
                {loading && (
                  <div className="text-center text-sm text-slate-400 py-12">読み込み中…</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {activeContract && (
        <ContractDetailModal
          contract={activeContract}
          onClose={() => setActiveContract(null)}
          onChanged={fetchAll}
        />
      )}

      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </>
  )
}
