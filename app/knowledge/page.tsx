import { articles } from '@/lib/knowledge'
import PageHeader from '@/components/PageHeader'
import Link from 'next/link'

const categoryOrder = ['基礎知識', '営業スキル', '分析・KPI']
const categoryColor: Record<string, string> = {
  '基礎知識': 'bg-blue-50 text-blue-600',
  '営業スキル': 'bg-emerald-50 text-emerald-600',
  '分析・KPI': 'bg-violet-50 text-violet-600',
}

export default function KnowledgePage() {
  const grouped = categoryOrder.map(cat => ({
    category: cat,
    items: articles.filter(a => a.category === cat),
  }))

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader title="営業ナレッジ" sub="営業の基礎知識とKINDLERの指標の読み方を解説します" />

      {grouped.map(({ category, items }) => (
        <div key={category}>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">{category}</p>
          <div className="space-y-2">
            {items.map(article => (
              <Link key={article.slug} href={`/knowledge/${article.slug}`}>
                <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 hover:shadow-sm hover:border-indigo-100 transition-all group">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${categoryColor[article.category]}`}>
                          {article.category}
                        </span>
                      </div>
                      <p className="font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{article.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{article.summary}</p>
                    </div>
                    <span className="text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-1">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
