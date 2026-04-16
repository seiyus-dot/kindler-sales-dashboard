import React from 'react'

type Props = {
  title: string
  sub?: string
  right?: React.ReactNode
}

export default function PageHeader({ title, sub, right }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold tracking-[0.15em] text-[#b8902a] mb-0.5 uppercase">KINDLER</p>
        <h1 className="text-[17px] lg:text-xl font-bold text-[#1a2540] tracking-tight">{title}</h1>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {right && <div className="flex items-center gap-2 flex-wrap shrink-0">{right}</div>}
    </div>
  )
}
