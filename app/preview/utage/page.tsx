'use client'

// ローカル開発用プレビューページ（認証不要）
// このファイルは本番環境にデプロイしないこと

import { useState } from 'react'

type Account = {
  id: string
  name: string
  type: string
  scenarios: { id: string; title: string }[]
}

const DUMMY: Account[] = [
  {
    id: 'ac1', name: 'AI CAMP 2026.04.11', type: 'line',
    scenarios: [
      { id: 'ehwpN1oaRmBF', title: '無料プレゼント受け取り後シナリオ' },
      { id: 'sc_abc123', title: 'セミナー申込後ステップ' },
      { id: 'sc_def456', title: 'クロージングリマインダー' },
    ],
  },
  {
    id: 'ac2', name: 'Product AI CAMP運営', type: 'line',
    scenarios: [
      { id: 'sc_ghi789', title: '入会後オンボーディング' },
      { id: 'sc_jkl012', title: '月次リマインド配信' },
    ],
  },
  {
    id: 'ac3', name: 'AI法人リスト', type: 'email',
    scenarios: [
      { id: 'sc_mno345', title: '問い合わせ後フォロー' },
    ],
  },
  {
    id: 'ac4', name: 'AI CAMPサポートLINE', type: 'line',
    scenarios: [],
  },
]

const TYPE_CONFIG = {
  line:  { label: 'LINE',  icon: '💬', badge: 'bg-green-100 text-green-700',  border: 'border-green-200', bg: 'bg-green-50' },
  email: { label: 'メール', icon: '📧', badge: 'bg-blue-100 text-blue-700',   border: 'border-blue-200',  bg: 'bg-blue-50'  },
  sms:   { label: 'SMS',   icon: '📱', badge: 'bg-orange-100 text-orange-700', border: 'border-orange-200', bg: 'bg-orange-50' },
}

function getType(type: string) {
  const t = type.toLowerCase()
  if (t.includes('line')) return TYPE_CONFIG.line
  if (t.includes('mail')) return TYPE_CONFIG.email
  if (t.includes('sms'))  return TYPE_CONFIG.sms
  return TYPE_CONFIG.line
}

export default function PreviewPage() {
  const [open, setOpen] = useState<string | null>('ac1')

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 inline-block mb-4">
            ⚠️ ローカル開発用プレビュー
          </p>
          <h1 className="text-2xl font-black text-gray-900">配信アカウント</h1>
          <p className="text-sm text-gray-400 mt-0.5">アカウントをクリックするとシナリオが展開されます</p>
        </div>

        <div className="space-y-2">
          {DUMMY.map(account => {
            const cfg = getType(account.type)
            const isOpen = open === account.id

            return (
              <div key={account.id} className={`bg-white border rounded-lg overflow-hidden transition-all ${isOpen ? cfg.border : 'border-gray-100'}`}>
                {/* アカウントヘッダー */}
                <button
                  onClick={() => setOpen(isOpen ? null : account.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xl">{cfg.icon}</span>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-sm text-gray-900">{account.name}</p>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  {/* シナリオ数バッジ */}
                  {account.scenarios.length > 0 && (
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                      {account.scenarios.length}件
                    </span>
                  )}
                  {/* 開閉矢印 */}
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* シナリオ一覧（展開時） */}
                {isOpen && (
                  <div className={`border-t border-gray-100 ${cfg.bg} px-4 py-3 space-y-2`}>
                    {account.scenarios.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2 text-center">シナリオがありません</p>
                    ) : (
                      account.scenarios.map(s => (
                        <div key={s.id} className="bg-white border border-gray-100 rounded-lg px-4 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{s.id}</p>
                          </div>
                          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
