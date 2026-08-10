'use client'

import { useCallback, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * 主タブの状態を URL のクエリ（既定キー `tab`）に保存するフック。
 * useState と同じ `[value, setValue]` のタプルを返すので、既存の
 * `const [activeTab, setActiveTab] = useState<...>('overview')` を
 * `const [activeTab, setActiveTab] = useTabParam([...] as const, 'overview')`
 * に置き換えるだけで、リロード時に URL からタブを復元できる。
 *
 * - URL の値を初期値として読み込み、ローカル state で保持（即時UI反映）。
 * - 切替時は state 更新 + router.replace で URL を同期（scroll: false / 履歴を汚さない）。
 * - 既定値のときはクエリを削除して URL を綺麗に保つ。
 * - 未知/欠落値は fallback にフォールバック（不正URL対策）。
 */
export function useTabParam<T extends string>(
  valid: readonly T[],
  fallback: T,
  key = 'tab',
): readonly [T, (next: T) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const fromUrl = searchParams.get(key)
  const initial = fromUrl && (valid as readonly string[]).includes(fromUrl) ? (fromUrl as T) : fallback
  const [value, setValue] = useState<T>(initial)

  const set = useCallback(
    (next: T) => {
      setValue(next)
      const params = new URLSearchParams(searchParams.toString())
      if (next === fallback) params.delete(key)
      else params.set(key, next)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams, fallback, key],
  )

  return [value, set] as const
}
