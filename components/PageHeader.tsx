import React from 'react'

type Props = {
  title: string
  sub?: string
  right?: React.ReactNode
}

export default function PageHeader({ title, sub, right }: Props) {
  return (
    <div className="bg-white border border-[#e0e6f0] rounded-xl shadow-sm px-4 py-3 lg:px-5 lg:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.15em] text-[#b8902a] mb-0.5 uppercase">KINDLER</p>
          <h1 className="text-base lg:text-xl font-bold text-[#1a2540] tracking-tight truncate">{title}</h1>
          {sub && <p className="text-xs text-gray-400 mt-0.5 hidden sm:block truncate">{sub}</p>}
        </div>
        {right && <div className="flex items-center gap-1.5 lg:gap-2 flex-wrap justify-end shrink-0 max-w-[60%] sm:max-w-none">{right}</div>}
      </div>
    </div>
  )
}
