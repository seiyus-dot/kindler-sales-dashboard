'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import type { OrderRequest } from '@/lib/supabase'
import { DEMO_ORDER_REQUESTS } from '@/lib/demoData'
import PageHeader from '@/components/PageHeader'

const SERVICE_LABELS: Record<string, string> = {
  ai_kenshu: 'AI研修（法人）',
  ai_camp:   'AI CAMP（個人）',
  ai_step:   'AIステップ',
  other:     'その他',
}

const STATUSES = ['未対応', '対応中', '完了']

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === '完了'   ? 'bg-green-100 text-green-700' :
    status === '対応中' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status}
    </span>
  )
}

function DetailModal({ req, onClose, onStatusChange }: {
  req: OrderRequest
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
}) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 pb-1 border-b border-slate-100">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
  const Row = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div className="flex gap-3">
      <span className="text-xs text-slate-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-700">{value || '—'}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="font-bold text-slate-800">{req.company_name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{new Date(req.created_at).toLocaleString('ja-JP')}</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={req.status}
              onChange={e => onStatusChange(req.id, e.target.value)}
              className="input !py-1.5 !px-3 text-sm w-auto"
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="p-6">
          <Section title="企業情報">
            <Row label="企業名" value={req.company_name} />
            <Row label="代表者名（漢字）" value={req.rep_name_kanji} />
            <Row label="代表者名（フリガナ）" value={req.rep_name_kana} />
            <Row label="代表電話番号" value={req.company_phone} />
          </Section>
          <Section title="担当者情報">
            <Row label="担当者名（漢字）" value={req.contact_name_kanji} />
            <Row label="担当者名（フリガナ）" value={req.contact_name_kana} />
            <Row label="部署名" value={req.department} />
            <Row label="役職名" value={req.position} />
            <Row label="メールアドレス" value={req.contact_email} />
            <Row label="電話番号" value={req.contact_phone} />
          </Section>
          <Section title="請求書送付先">
            <Row label="郵便番号" value={req.billing_zip} />
            <Row label="住所" value={req.billing_address} />
            <Row label="担当者名（漢字）" value={req.billing_name_kanji} />
            <Row label="担当者名（フリガナ）" value={req.billing_name_kana} />
            <Row label="役職名" value={req.billing_position} />
            <Row label="部署名" value={req.billing_department} />
            <Row label="メールアドレス" value={req.billing_email} />
          </Section>
          <Section title="発注内容">
            <Row label="発注サービス" value={req.services.map(s => SERVICE_LABELS[s] ?? s).join('、')} />
            <Row label="詳細" value={req.order_detail} />
          </Section>
        </div>
      </div>
    </div>
  )
}

export default function OrderRequestsPage() {
  const [requests, setRequests] = useState<OrderRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<OrderRequest | null>(null)

  const fetchAll = useCallback(() => {
    setRequests(DEMO_ORDER_REQUESTS)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleStatusChange = (id: string, status: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="発注リクエスト一覧" sub="フォームから送信された発注リクエストを管理します" />

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">読み込み中...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">まだ発注リクエストはありません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 whitespace-nowrap">受付日時</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 whitespace-nowrap">企業名</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 whitespace-nowrap">担当者名</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 whitespace-nowrap">メールアドレス</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 whitespace-nowrap">発注サービス</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 whitespace-nowrap">ステータス</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {requests.map(req => (
                  <tr
                    key={req.id}
                    className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                    onClick={() => setSelected(req)}
                  >
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(req.created_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-800 whitespace-nowrap">
                      {req.company_name}
                    </td>
                    <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                      {req.contact_name_kanji}
                    </td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                      {req.contact_email}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {req.services.map(s => (
                          <span key={s} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
                            {SERVICE_LABELS[s] ?? s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <select
                        value={req.status}
                        onChange={e => handleStatusChange(req.id, e.target.value)}
                        className="input !py-1 !px-2 text-xs w-auto"
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <DetailModal
          req={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
