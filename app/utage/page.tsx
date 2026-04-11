'use client'

import { useEffect, useState } from 'react'

type Tab = 'funnels' | 'accounts' | 'media'

type Funnel = { id: string; name: string; created_at?: string; [key: string]: unknown }
type Account = { id: string; name: string; type?: string; [key: string]: unknown }
type Scenario = { id: string; name: string; [key: string]: unknown }
type MediaItem = { id: string; name: string; duration?: number; [key: string]: unknown }

export default function UtagePage() {
  const [tab, setTab] = useState<Tab>('funnels')

  // ファネル
  const [funnels, setFunnels] = useState<Funnel[]>([])
  const [funnelsLoading, setFunnelsLoading] = useState(false)
  const [funnelsError, setFunnelsError] = useState<string | null>(null)

  // 配信アカウント
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [scenariosLoading, setScenariosLoading] = useState(false)

  // メディア
  const [mediaType, setMediaType] = useState<'video' | 'audio'>('video')
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)

  // ---- ファネル取得 ----
  useEffect(() => {
    if (tab !== 'funnels') return
    setFunnelsLoading(true)
    setFunnelsError(null)
    fetch('/api/utage/funnels')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(String(d.error))
        setFunnels(d.data ?? [])
      })
      .catch(e => setFunnelsError(String(e)))
      .finally(() => setFunnelsLoading(false))
  }, [tab])

  // ---- 配信アカウント取得 ----
  useEffect(() => {
    if (tab !== 'accounts') return
    setAccountsLoading(true)
    setAccountsError(null)
    fetch('/api/utage/accounts')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(String(d.error))
        setAccounts(d.data ?? [])
      })
      .catch(e => setAccountsError(String(e)))
      .finally(() => setAccountsLoading(false))
  }, [tab])

  // ---- シナリオ取得 ----
  useEffect(() => {
    if (!selectedAccountId) return
    setScenariosLoading(true)
    fetch(`/api/utage/accounts?accountId=${selectedAccountId}`)
      .then(r => r.json())
      .then(d => setScenarios(d.data ?? []))
      .catch(() => setScenarios([]))
      .finally(() => setScenariosLoading(false))
  }, [selectedAccountId])

  // ---- メディア取得 ----
  useEffect(() => {
    if (tab !== 'media') return
    setMediaLoading(true)
    setMediaError(null)
    fetch(`/api/utage/media?type=${mediaType}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(String(d.error))
        setMediaItems(d.data ?? [])
      })
      .catch(e => setMediaError(String(e)))
      .finally(() => setMediaLoading(false))
  }, [tab, mediaType])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'funnels', label: 'ファネル' },
    { key: 'accounts', label: '配信アカウント' },
    { key: 'media', label: 'メディア' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">UTAGE</h1>
        <p className="text-sm text-gray-400 mt-0.5">ファネル・配信・メディアの管理</p>
      </div>

      {/* タブ */}
      <div className="flex gap-1 border-b border-gray-100">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ファネルタブ */}
      {tab === 'funnels' && (
        <div>
          {funnelsLoading && <Loading />}
          {funnelsError && <Error message={funnelsError} />}
          {!funnelsLoading && !funnelsError && (
            funnels.length === 0
              ? <Empty text="ファネルがありません" />
              : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {funnels.map(f => (
                    <div key={f.id} className="bg-white border border-gray-100 rounded shadow-sm p-4 hover:shadow-md transition-shadow">
                      <p className="font-bold text-gray-900 text-sm truncate">{f.name}</p>
                      <p className="text-xs text-gray-400 mt-1 font-mono">{f.id}</p>
                      {f.created_at && (
                        <p className="text-xs text-gray-300 mt-1">{new Date(f.created_at).toLocaleDateString('ja-JP')}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
          )}
        </div>
      )}

      {/* 配信アカウントタブ */}
      {tab === 'accounts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* アカウント一覧 */}
          <div>
            <h2 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide">配信アカウント</h2>
            {accountsLoading && <Loading />}
            {accountsError && <Error message={accountsError} />}
            {!accountsLoading && !accountsError && (
              accounts.length === 0
                ? <Empty text="配信アカウントがありません" />
                : (
                  <div className="space-y-2">
                    {accounts.map(a => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAccountId(a.id === selectedAccountId ? null : a.id)}
                        className={`w-full text-left bg-white border rounded p-3 hover:shadow-sm transition-all ${
                          selectedAccountId === a.id ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{accountTypeIcon(String(a.type ?? ''))}</span>
                          <div>
                            <p className="font-semibold text-sm text-gray-900">{a.name}</p>
                            {a.type && (
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${accountTypeBadge(String(a.type))}`}>
                                {accountTypeLabel(String(a.type))}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )
            )}
          </div>

          {/* シナリオ一覧 */}
          <div>
            <h2 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide">シナリオ</h2>
            {!selectedAccountId && (
              <p className="text-sm text-gray-400">← アカウントを選択してください</p>
            )}
            {selectedAccountId && scenariosLoading && <Loading />}
            {selectedAccountId && !scenariosLoading && (
              scenarios.length === 0
                ? <Empty text="シナリオがありません" />
                : (
                  <div className="space-y-2">
                    {scenarios.map(s => (
                      <div key={s.id} className="bg-white border border-gray-100 rounded p-3">
                        <p className="font-semibold text-sm text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{s.id}</p>
                      </div>
                    ))}
                  </div>
                )
            )}
          </div>
        </div>
      )}

      {/* メディアタブ */}
      {tab === 'media' && (
        <div>
          {/* 動画/音声切替 */}
          <div className="flex gap-2 mb-4">
            {(['video', 'audio'] as const).map(t => (
              <button
                key={t}
                onClick={() => setMediaType(t)}
                className={`px-3 py-1.5 text-sm font-semibold rounded transition-colors ${
                  mediaType === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-900'
                }`}
              >
                {t === 'video' ? '動画' : '音声'}
              </button>
            ))}
          </div>

          {mediaLoading && <Loading />}
          {mediaError && <Error message={mediaError} />}
          {!mediaLoading && !mediaError && (
            mediaItems.length === 0
              ? <Empty text={`${mediaType === 'video' ? '動画' : '音声'}がありません`} />
              : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mediaItems.map(m => (
                    <div key={m.id} className="bg-white border border-gray-100 rounded shadow-sm p-4">
                      <div className="w-full h-24 bg-gray-50 rounded flex items-center justify-center mb-3">
                        <span className="text-3xl">{mediaType === 'video' ? '🎬' : '🎵'}</span>
                      </div>
                      <p className="font-semibold text-sm text-gray-900 truncate">{m.name}</p>
                      {m.duration && (
                        <p className="text-xs text-gray-400 mt-1">{formatDuration(Number(m.duration))}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
          )}
        </div>
      )}
    </div>
  )
}

function Loading() {
  return <div className="text-sm text-gray-400 py-8 text-center">読み込み中...</div>
}

function Error({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded p-4 text-sm text-red-600">
      エラー: {message}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="text-sm text-gray-400 py-8 text-center">{text}</div>
}

function accountTypeIcon(type: string) {
  const t = type.toLowerCase()
  if (t.includes('line')) return '💬'
  if (t.includes('mail') || t.includes('email')) return '📧'
  if (t.includes('sms')) return '📱'
  return '📣'
}

function accountTypeLabel(type: string) {
  const t = type.toLowerCase()
  if (t.includes('line')) return 'LINE'
  if (t.includes('mail') || t.includes('email')) return 'メール'
  if (t.includes('sms')) return 'SMS'
  return type
}

function accountTypeBadge(type: string) {
  const t = type.toLowerCase()
  if (t.includes('line')) return 'bg-green-100 text-green-700'
  if (t.includes('mail') || t.includes('email')) return 'bg-blue-100 text-blue-700'
  if (t.includes('sms')) return 'bg-orange-100 text-orange-700'
  return 'bg-gray-100 text-gray-600'
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
