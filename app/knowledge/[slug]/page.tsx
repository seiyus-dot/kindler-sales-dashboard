import { articles, getArticle, Section } from '@/lib/knowledge'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export function generateStaticParams() {
  return articles.map(a => ({ slug: a.slug }))
}

function renderSection(section: Section, i: number) {
  return (
    <div key={i} className="space-y-3">
      {section.heading && (
        <h2 className="text-base font-bold text-gray-800 border-l-4 border-indigo-400 pl-3">{section.heading}</h2>
      )}
      {section.text && (
        <p className="text-sm text-gray-600 leading-relaxed">{section.text}</p>
      )}
      {section.table && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {section.table.headers.map((h, j) => (
                  <th key={j} className="text-left text-xs font-bold text-gray-500 px-3 py-2 border border-gray-100">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, j) => (
                <tr key={j} className="hover:bg-gray-50 transition-colors">
                  {row.map((cell, k) => (
                    <td key={k} className={`px-3 py-2 text-xs text-gray-600 border border-gray-100 leading-relaxed ${k === 0 ? 'font-medium text-gray-700' : ''}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.example && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <p className="text-xs font-bold text-gray-400 mb-1">{section.example.label}</p>
          <p className="text-sm font-mono text-gray-700">{section.example.content}</p>
        </div>
      )}
      {section.tip && (
        <div className="bg-indigo-50 border-l-4 border-indigo-400 rounded-r-lg px-4 py-3">
          <p className="text-xs font-bold text-indigo-500 mb-1">ポイント</p>
          <p className="text-sm text-indigo-700 leading-relaxed">{section.tip}</p>
        </div>
      )}
    </div>
  )
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) notFound()

  const currentIndex = articles.findIndex(a => a.slug === article.slug)
  const prev = articles[currentIndex - 1]
  const next = articles[currentIndex + 1]

  return (
    <div className="max-w-2xl space-y-6">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/knowledge" className="hover:text-indigo-600 transition-colors">営業ナレッジ</Link>
        <span>/</span>
        <span className="text-gray-600">{article.title}</span>
      </div>

      {/* 記事ヘッダー */}
      <div className="bg-white border border-gray-100 rounded-2xl px-7 py-6">
        <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{article.category}</span>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">{article.title}</h1>
        <p className="text-sm text-gray-400 mt-2 leading-relaxed">{article.summary}</p>
      </div>

      {/* 本文 */}
      <div className="bg-white border border-gray-100 rounded-2xl px-7 py-6 space-y-6">
        {article.body.map((section, i) => renderSection(section, i))}
      </div>

      {/* 前後ナビゲーション */}
      <div className="flex gap-3">
        {prev && (
          <Link href={`/knowledge/${prev.slug}`} className="flex-1 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-indigo-200 hover:shadow-sm transition-all group">
            <p className="text-xs text-gray-400 mb-0.5">前の記事</p>
            <p className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition-colors">{prev.title}</p>
          </Link>
        )}
        {next && (
          <Link href={`/knowledge/${next.slug}`} className="flex-1 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-indigo-200 hover:shadow-sm transition-all group text-right">
            <p className="text-xs text-gray-400 mb-0.5">次の記事</p>
            <p className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition-colors">{next.title}</p>
          </Link>
        )}
      </div>

      <div className="text-center">
        <Link href="/knowledge" className="text-sm text-gray-400 hover:text-indigo-600 transition-colors">
          ← ナレッジ一覧に戻る
        </Link>
      </div>
    </div>
  )
}
