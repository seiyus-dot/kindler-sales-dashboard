'use client'

import { useState, useCallback, useEffect } from 'react'
import { Upload, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList, ReferenceLine,
} from 'recharts'

// ────────────────────────────────────────────
// サービスカテゴリ定義
// ────────────────────────────────────────────
const CATEGORY_KEYS: { category: string; prefixes: string[] }[] = [
  { category: 'AI CAMP',         prefixes: ['SOSO', 'SOSWRij', 'TfY6', 'SO0W', 'SfEN', 'UOR8', 'UPTK', 'TMmcV', 'TNAU', 'Tndy', 'Tx7n', 'ULLc', 'ULVO', 'U7aH', 'TOb5', 'TEmi', 'SNHu', 'TsDj', 'Tr40'] },
  { category: 'Product AI CAMP', prefixes: ['UCRY'] },
  { category: 'AIスタッフ',      prefixes: ['U3Pb', 'S0nj', 'SNkl', 'TGnp'] },
  { category: 'SARI',            prefixes: ['NiW5'] },
  { category: 'HARU',            prefixes: ['Nkne'] },
  { category: 'レビューAI',      prefixes: ['U4XY'] },
  { category: 'MFB',             prefixes: ['PAPk'] },
  { category: '仕組み化ハブ',    prefixes: ['U90v'] },
  { category: 'SNSセミナー',     prefixes: ['Ro9D'] },
  { category: 'フェイススキャン', prefixes: ['Q6q3'] },
  { category: '花巡りai',        prefixes: ['OYKC'] },
]

const CATEGORY_ORDER = [
  'AI CAMP', 'Product AI CAMP', 'AIスタッフ', 'SARI', 'HARU',
  'レビューAI', 'MFB', '仕組み化ハブ', 'SNSセミナー', 'フェイススキャン', '花巡りai', 'その他',
]

const CATEGORY_COLORS: Record<string, string> = {
  'AI CAMP':         '#1a3a6e',
  'Product AI CAMP': '#2563eb',
  'AIスタッフ':      '#b8902a',
  'SARI':            '#16a34a',
  'HARU':            '#db2777',
  'レビューAI':      '#7c3aed',
  'MFB':             '#0891b2',
  '仕組み化ハブ':    '#ea580c',
  'SNSセミナー':     '#65a30d',
  'フェイススキャン': '#6b7280',
  '花巡りai':        '#e11d48',
  'その他':          '#9ca3af',
}

function getCategory(productId: string): string {
  const key = productId.replace('prod_', '')
  for (const { category, prefixes } of CATEGORY_KEYS) {
    if (prefixes.some(p => key.startsWith(p))) return category
  }
  return 'その他'
}

// ────────────────────────────────────────────
// 型・パース・集計
// ────────────────────────────────────────────
interface RawRow {
  product_id: string
  month_end: string
  mrr_usd: number
}

interface ChartRow {
  month: string
  [category: string]: number | string
}

const STORAGE_KEY = 'kindler_mrr_data'

function parseCsv(text: string): RawRow[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
  const idxProductId = header.findIndex(h => h === 'product_id')
  const idxMonthEnd  = header.findIndex(h => h === 'month_end')
  const idxMrr       = header.findIndex(h => h === 'total_mrr_in_usd')
  if (idxProductId < 0 || idxMonthEnd < 0 || idxMrr < 0) return []

  const rows: RawRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim())
    const productId = cols[idxProductId] ?? ''
    const monthEnd  = cols[idxMonthEnd] ?? ''
    const mrrRaw    = cols[idxMrr] ?? ''
    if (!productId || !monthEnd) continue
    const mrr = mrrRaw === '' ? 0 : parseFloat(mrrRaw)
    rows.push({ product_id: productId, month_end: monthEnd, mrr_usd: isNaN(mrr) ? 0 : mrr })
  }
  return rows
}

// Stripeは month_end が翌月1日（"2026-05-01"）になることがあるため
// 日付が1日の場合は前月として扱う（文字列ベースで処理しタイムゾーン誤差を回避）
function monthEndToKey(monthEnd: string): string {
  const datePart = monthEnd.trim().split(/[\sT]/)[0]
  const parts = datePart.split('-')
  if (parts.length < 3) return datePart.substring(0, 7)
  let year = parseInt(parts[0], 10)
  let month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)
  if (isNaN(year) || isNaN(month) || isNaN(day)) return datePart.substring(0, 7)
  if (day === 1) {
    month -= 1
    if (month === 0) { month = 12; year -= 1 }
  }
  return `${year}-${String(month).padStart(2, '0')}`
}

function aggregate(rows: RawRow[], rate: number): { chartData: ChartRow[]; categories: string[] } {
  const map = new Map<string, Map<string, number>>()
  for (const row of rows) {
    const month = monthEndToKey(row.month_end)
    const cat   = getCategory(row.product_id)
    if (!map.has(month)) map.set(month, new Map())
    const catMap = map.get(month)!
    catMap.set(cat, (catMap.get(cat) ?? 0) + row.mrr_usd)
  }

  const months = Array.from(map.keys()).sort()
  const categorySet = new Set<string>()
  map.forEach(m => m.forEach((_, c) => categorySet.add(c)))
  const categories = Array.from(categorySet).sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
  )

  const chartData: ChartRow[] = months.map(month => {
    const row: ChartRow = { month }
    const catMap = map.get(month)!
    for (const cat of categories) {
      row[cat] = Math.round((catMap.get(cat) ?? 0) * rate / 10000)
    }
    return row
  })

  return { chartData, categories }
}

// ────────────────────────────────────────────
// 期（会計年度）ヘルパー
// ────────────────────────────────────────────
const FOUNDING_YEAR = 2017 // 創業年（8月始まり第1期）

function getKi(yyyymm: string): number {
  const parts = yyyymm.split('-')
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const startYear = m >= 8 ? y : y - 1
  return startYear - FOUNDING_YEAR + 1
}

function getCurrentKi(): number {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const startYear = m >= 8 ? y : y - 1
  return startYear - FOUNDING_YEAR + 1
}

function kiLabel(ki: number): string {
  const startYear = FOUNDING_YEAR + ki - 1
  return `第${ki}期 (${startYear}/8〜${startYear + 1}/7)`
}

// ────────────────────────────────────────────
// ページ
// ────────────────────────────────────────────
export default function MrrPage() {
  const [rawRows, setRawRows]       = useState<RawRow[]>([])
  const [chartData, setChartData]   = useState<ChartRow[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [hidden, setHidden]         = useState<Set<string>>(new Set())
  const [rate, setRate]             = useState(150)
  const [rateInput, setRateInput]   = useState('150')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName]     = useState('')
  const [tableOpen, setTableOpen]             = useState(false)
  const [growthTableOpen, setGrowthTableOpen] = useState(false)
  const [selectedKi, setSelectedKi]           = useState<number>(getCurrentKi())

  // ── localStorage 復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return
      const { rows, rate: savedRate, fileName: savedName } = JSON.parse(saved) as {
        rows: RawRow[]; rate: number; fileName: string
      }
      setRawRows(rows)
      setRate(savedRate)
      setRateInput(String(savedRate))
      setFileName(savedName)
      const { chartData, categories } = aggregate(rows, savedRate)
      setChartData(chartData)
      setCategories(categories)
    } catch { /* 無視 */ }
  }, [])

  // ── CSV 処理 & 保存
  const processFile = useCallback((file: File, currentRate: number) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCsv(text)
      setRawRows(rows)
      const { chartData, categories } = aggregate(rows, currentRate)
      setChartData(chartData)
      setCategories(categories)
      setHidden(new Set())
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, rate: currentRate, fileName: file.name }))
      } catch { /* 容量超過等は無視 */ }
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const applyRate = () => {
    const r = parseFloat(rateInput)
    if (!isNaN(r) && r > 0) {
      setRate(r)
      if (rawRows.length > 0) {
        const { chartData, categories } = aggregate(rawRows, r)
        setChartData(chartData)
        setCategories(categories)
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved) {
            const parsed = JSON.parse(saved)
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, rate: r }))
          }
        } catch { /* 無視 */ }
      }
    }
  }

  const clearData = () => {
    localStorage.removeItem(STORAGE_KEY)
    setRawRows([])
    setChartData([])
    setCategories([])
    setHidden(new Set())
    setFileName('')
  }

  const toggleCategory = (cat: string) => {
    setHidden(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  const visibleCategories = categories.filter(c => !hidden.has(c))

  // ── 期フィルター
  const kiList = Array.from(new Set(chartData.map(row => getKi(row.month as string)))).sort((a, b) => a - b)
  const filteredChartData = selectedKi === 0
    ? chartData
    : chartData.filter(row => getKi(row.month as string) === selectedKi)

  // ── 月次成長率
  const monthlyTotals = filteredChartData.map(row => ({
    month: row.month,
    total: visibleCategories.reduce((s, c) => s + ((row[c] as number) || 0), 0),
  }))
  const growthData = monthlyTotals.slice(1).map((m, i) => ({
    month: m.month,
    pct: monthlyTotals[i].total > 0
      ? Math.round((m.total - monthlyTotals[i].total) / monthlyTotals[i].total * 100)
      : 0,
  }))

  // ── テーブル行（前月比付き）
  const tableRows = [...filteredChartData].reverse().map((row, i, arr) => {
    const total = visibleCategories.reduce((s, c) => s + ((row[c] as number) || 0), 0)
    const prevRow = arr[i + 1]
    const prevTotal = prevRow
      ? visibleCategories.reduce((s, c) => s + ((prevRow[c] as number) || 0), 0)
      : null
    const momPct = prevTotal !== null && prevTotal > 0
      ? Math.round((total - prevTotal) / prevTotal * 100)
      : null
    const catGrowths: Record<string, number | null> = {}
    for (const cat of visibleCategories) {
      const curr = (row[cat] as number) || 0
      const prev = prevRow !== undefined ? ((prevRow[cat] as number) || 0) : null
      catGrowths[cat] = prev !== null && prev > 0 ? Math.round((curr - prev) / prev * 100) : null
    }
    return { row, total, momPct, catGrowths }
  })

  // ── KPI
  const latestMonth = filteredChartData.length > 0 ? filteredChartData[filteredChartData.length - 1] : null
  const prevMonth   = filteredChartData.length > 1 ? filteredChartData[filteredChartData.length - 2] : null
  const totalLatest = latestMonth ? visibleCategories.reduce((s, c) => s + ((latestMonth[c] as number) || 0), 0) : 0
  const totalPrev   = prevMonth   ? visibleCategories.reduce((s, c) => s + ((prevMonth[c]   as number) || 0), 0) : 0
  const momChange   = totalPrev > 0 ? Math.round((totalLatest - totalPrev) / totalPrev * 100) : 0

  // ── 最新月 BarChart 用
  const barData = latestMonth
    ? visibleCategories
        .map(c => ({ name: c, 金額: (latestMonth[c] as number) || 0 }))
        .filter(d => d.金額 > 0)
        .sort((a, b) => b.金額 - a.金額)
    : []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader title="MRR推移" sub="Stripe「製品別月次MRR CSV」をアップロードするとサービス別MRR推移を表示します" />

      {/* 設定 & アップロード */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* 為替レート */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-medium text-slate-600 whitespace-nowrap">USD → JPY</span>
          <input
            className="input w-20"
            value={rateInput}
            onChange={e => setRateInput(e.target.value)}
            onBlur={applyRate}
            onKeyDown={e => e.key === 'Enter' && applyRate()}
          />
          <span className="text-sm text-slate-400">円</span>
        </div>

        {/* ドロップゾーン */}
        <div
          className={`flex-1 border-2 border-dashed rounded-2xl p-5 flex items-center justify-center gap-3 cursor-pointer transition-colors ${
            isDragging ? 'border-navy bg-navy/5' : 'border-slate-300 hover:border-navy/50 hover:bg-slate-50'
          }`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setIsDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) processFile(file, rate)
          }}
          onClick={() => document.getElementById('mrr-file-input')?.click()}
        >
          <Upload size={18} className="text-slate-400 flex-shrink-0" />
          <div className="min-w-0">
            {fileName
              ? <p className="text-sm font-medium text-navy truncate">{fileName}</p>
              : <p className="text-sm text-slate-500">CSV をドロップ または クリックして選択</p>
            }
            <p className="text-xs text-slate-400 mt-0.5">前回アップロードは自動で復元されます</p>
          </div>
          <input
            id="mrr-file-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f, rate) }}
          />
        </div>

        {/* クリアボタン */}
        {rawRows.length > 0 && (
          <button
            onClick={clearData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors flex-shrink-0"
          >
            <RefreshCw size={14} />
            クリア
          </button>
        )}
      </div>

      {/* 期セレクター */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">表示期間</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedKi(0)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                selectedKi === 0
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              全期間
            </button>
            {kiList.map(ki => (
              <button
                key={ki}
                onClick={() => setSelectedKi(ki)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  selectedKi === ki
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                第{ki}期
              </button>
            ))}
          </div>
          {selectedKi !== 0 && (
            <p className="text-xs text-slate-400 mt-2">{kiLabel(selectedKi)}</p>
          )}
        </div>
      )}

      {filteredChartData.length > 0 && (
        <>
          {/* カテゴリフィルター */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">表示カテゴリ</p>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => {
                const isVisible = !hidden.has(cat)
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      isVisible
                        ? 'text-white border-transparent'
                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                    }`}
                    style={isVisible ? { backgroundColor: CATEGORY_COLORS[cat] ?? '#9ca3af', borderColor: CATEGORY_COLORS[cat] ?? '#9ca3af' } : {}}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: isVisible ? 'rgba(255,255,255,0.7)' : (CATEGORY_COLORS[cat] ?? '#9ca3af') }}
                    />
                    {cat}
                  </button>
                )
              })}
              <button
                onClick={() => setHidden(new Set())}
                className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
              >
                すべて表示
              </button>
              <button
                onClick={() => setHidden(new Set(categories))}
                className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
              >
                すべて非表示
              </button>
            </div>
          </div>

          {/* KPIカード */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">最新月 MRR</p>
              <p className="text-2xl font-bold text-navy">
                {totalLatest.toLocaleString()} <span className="text-base font-medium text-slate-400">万円</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">{latestMonth?.month}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">前月比</p>
              <div className="flex items-center gap-2">
                {momChange > 0
                  ? <TrendingUp size={20} className="text-green-500" />
                  : momChange < 0
                  ? <TrendingDown size={20} className="text-red-500" />
                  : <Minus size={20} className="text-slate-400" />
                }
                <p className={`text-2xl font-bold ${momChange > 0 ? 'text-green-600' : momChange < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                  {momChange > 0 ? '+' : ''}{momChange}%
                </p>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {totalPrev.toLocaleString()} 万円 → {totalLatest.toLocaleString()} 万円
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">最大カテゴリ</p>
              {barData[0] && (
                <>
                  <p className="text-2xl font-bold" style={{ color: CATEGORY_COLORS[barData[0].name] ?? '#1a3a6e' }}>
                    {barData[0].name}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{barData[0].金額.toLocaleString()} 万円</p>
                </>
              )}
            </div>
          </div>

          {/* 月次成長率チャート */}
          {growthData.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-sm font-bold text-slate-700 mb-4">月次MRR成長率（前月比 %）</h2>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={growthData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f8" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#8a96b0', fontWeight: 700 }}
                    tickFormatter={v => v.substring(5)}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#8a96b0', fontWeight: 700 }}
                    tickFormatter={v => `${v}%`}
                  />
                  <Tooltip formatter={(v: number) => [`${v > 0 ? '+' : ''}${v}%`, '前月比']} />
                  <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
                  <Bar dataKey="pct" radius={[3, 3, 0, 0]} barSize={20}>
                    {growthData.map(entry => (
                      <Cell key={entry.month} fill={entry.pct >= 0 ? '#16a34a' : '#ef4444'} fillOpacity={0.8} />
                    ))}
                    <LabelList
                      dataKey="pct"
                      position="top"
                      formatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`}
                      style={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* AreaChart：推移 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-700 mb-4">月別MRR推移（万円）</h2>
            {visibleCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={filteredChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f8" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#8a96b0', fontWeight: 700 }}
                    tickFormatter={v => v.substring(5)}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#8a96b0', fontWeight: 700 }}
                    tickFormatter={v => `${v}万`}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [`${v.toLocaleString()} 万円`, name]}
                  />
                  <Legend verticalAlign="top" align="right" height={36} iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  {visibleCategories.map(cat => (
                    <Area
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stackId="1"
                      stroke={CATEGORY_COLORS[cat] ?? '#9ca3af'}
                      fill={CATEGORY_COLORS[cat] ?? '#9ca3af'}
                      fillOpacity={0.7}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400 text-center py-16">表示するカテゴリを選択してください</p>
            )}
          </div>

          {/* BarChart：最新月カテゴリ別 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-700 mb-4">
              {latestMonth?.month} カテゴリ別MRR（万円）
            </h2>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, barData.length * 44)}>
                <BarChart data={barData} layout="vertical" margin={{ right: 70, left: 8 }}>
                  <XAxis type="number" hide domain={[0, (d: number) => Math.ceil(d * 1.4)]} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    width={120}
                    tick={{ fontSize: 12, fill: '#8a96b0', fontWeight: 700 }}
                  />
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString()} 万円`, '金額']} />
                  <Bar dataKey="金額" radius={[0, 4, 4, 0]} barSize={20}>
                    {barData.map(entry => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#9ca3af'} />
                    ))}
                    <LabelList
                      dataKey="金額"
                      position="right"
                      formatter={(v: number) => `${v.toLocaleString()}万`}
                      style={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400 text-center py-16">表示するカテゴリを選択してください</p>
            )}
          </div>

          {/* 月別 × カテゴリ テーブル（金額） */}
          <div className="bg-white rounded-2xl border border-slate-200">
            <button
              className="w-full flex items-center justify-between px-6 py-4 text-sm font-bold text-slate-700"
              onClick={() => setTableOpen(o => !o)}
            >
              <span>月別詳細テーブル（万円）</span>
              {tableOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {tableOpen && (
              <div className="overflow-x-auto border-t border-slate-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-2 text-left text-slate-500 font-semibold whitespace-nowrap">月</th>
                      {visibleCategories.map(c => (
                        <th key={c} className="px-4 py-2 text-right text-slate-500 font-semibold whitespace-nowrap">{c}</th>
                      ))}
                      <th className="px-4 py-2 text-right text-slate-700 font-bold whitespace-nowrap">合計</th>
                      <th className="px-4 py-2 text-right text-slate-500 font-semibold whitespace-nowrap">前月比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(({ row, total, momPct }, i) => (
                      <tr key={row.month} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-4 py-2 text-slate-600 font-medium">{row.month}</td>
                        {visibleCategories.map(c => (
                          <td key={c} className="px-4 py-2 text-right text-slate-600 tabular-nums">
                            {((row[c] as number) || 0) > 0 ? (row[c] as number).toLocaleString() : '—'}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-right font-bold text-navy tabular-nums">
                          {total.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">
                          {momPct === null ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <span className={momPct > 0 ? 'text-green-600' : momPct < 0 ? 'text-red-500' : 'text-slate-400'}>
                              {momPct > 0 ? '+' : ''}{momPct}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* カテゴリ別成長率テーブル */}
          <div className="bg-white rounded-2xl border border-slate-200">
            <button
              className="w-full flex items-center justify-between px-6 py-4 text-sm font-bold text-slate-700"
              onClick={() => setGrowthTableOpen(o => !o)}
            >
              <span>カテゴリ別成長率テーブル（前月比 %）</span>
              {growthTableOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {growthTableOpen && (
              <div className="overflow-x-auto border-t border-slate-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-2 text-left text-slate-500 font-semibold whitespace-nowrap">月</th>
                      {visibleCategories.map(c => (
                        <th key={c} className="px-4 py-2 text-right text-slate-500 font-semibold whitespace-nowrap">{c}</th>
                      ))}
                      <th className="px-4 py-2 text-right text-slate-700 font-bold whitespace-nowrap">合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(({ row, momPct, catGrowths }, i) => (
                      <tr key={row.month} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-4 py-2 text-slate-600 font-medium">{row.month}</td>
                        {visibleCategories.map(c => {
                          const g = catGrowths[c]
                          return (
                            <td key={c} className="px-4 py-2 text-right tabular-nums font-medium">
                              {g === null ? (
                                <span className="text-slate-300">—</span>
                              ) : (
                                <span className={g > 0 ? 'text-green-600' : g < 0 ? 'text-red-500' : 'text-slate-400'}>
                                  {g > 0 ? '+' : ''}{g}%
                                </span>
                              )}
                            </td>
                          )
                        })}
                        <td className="px-4 py-2 text-right tabular-nums font-bold">
                          {momPct === null ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <span className={momPct > 0 ? 'text-green-600' : momPct < 0 ? 'text-red-500' : 'text-slate-400'}>
                              {momPct > 0 ? '+' : ''}{momPct}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
