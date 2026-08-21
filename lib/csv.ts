// CSV書き出しの共通ユーティリティ（クライアント専用）
// Excelでの文字化けを避けるため UTF-8 BOM 付き・CRLF 改行で出力する。

export type CsvValue = string | number | boolean | null | undefined

/** 先頭が =,+,@ などの値はExcelで数式として解釈されるため、シングルクォートで無害化する */
function neutralizeFormula(s: string): string {
  if (/^[=+@\t\r]/.test(s)) return `'${s}`
  // 「-」始まりは負の数だけ許可し、それ以外（-abc など）は無害化する
  if (s.startsWith('-') && !/^-\d/.test(s)) return `'${s}`
  return s
}

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  const s = neutralizeFormula(typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value))
  return `"${s.replace(/"/g, '""')}"`
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(escapeCell).join(','), ...rows.map(r => r.map(escapeCell).join(','))]
  return '\uFEFF' + lines.join('\r\n')
}

/** ヘッダ＋行データをCSVとしてダウンロードさせる */
export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]) {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** ファイル名用の日付スタンプ（YYYYMMDD） */
export function csvStamp(d = new Date()): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

/** ISO日時を「YYYY-MM-DD HH:mm」に整形（CSV用） */
export function csvDateTime(v?: string | null): string {
  if (!v) return ''
  return v.replace('T', ' ').slice(0, 16)
}
