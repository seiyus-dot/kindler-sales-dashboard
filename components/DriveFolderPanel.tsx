'use client'

import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Upload, ExternalLink, FileText, Loader2, FolderPlus, X } from 'lucide-react'

type DriveFile = {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  webViewLink: string
  iconLink?: string
  size?: string
}

function fileIcon(mimeType: string) {
  if (mimeType.includes('folder')) return '📁'
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📋'
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('image')) return '🖼️'
  return '📎'
}

export default function DriveFolderPanel({
  dealId,
  companyName,
  folderId,
  onFolderCreated,
  onFolderRemoved,
}: {
  dealId: string
  companyName: string
  folderId?: string
  onFolderCreated: (folderId: string) => void
  onFolderRemoved?: () => void
}) {
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (folderId) fetchFiles()
  }, [folderId])

  async function fetchFiles() {
    if (!folderId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/drive/files?folderId=${folderId}`)
      const json = await res.json()
      setFiles(json.files ?? [])
    } catch {
      // Drive API 失敗時はファイル一覧を空のままにする
    } finally {
      setLoading(false)
    }
  }

  async function createFolder() {
    setCreating(true)
    try {
      const res = await fetch('/api/drive/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName }),
      })
      const text = await res.text()
      alert(`DEBUG: status=${res.status} body=${text}`)
      const json = JSON.parse(text)
      if (json.folderId) {
        onFolderCreated(json.folderId)
      } else {
        alert('フォルダ作成に失敗しました: ' + json.error)
      }
    } catch (e) {
      alert('フォルダ作成に失敗しました: ' + String(e))
    } finally {
      setCreating(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !folderId) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    form.append('folderId', folderId)
    const res = await fetch('/api/drive/upload', { method: 'POST', body: form })
    const json = await res.json()
    if (json.error) alert('アップロード失敗: ' + json.error)
    else await fetchFiles()
    setUploading(false)
    e.target.value = ''
  }

  const folderUrl = folderId
    ? `https://drive.google.com/drive/folders/${folderId}`
    : null

  return (
    <div className="bg-white rounded-xl border border-[#e0e6f0] shadow-sm overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e0e6f0] bg-[#f8f9fd]">
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className="text-[#4285f4]" />
          <span className="text-sm font-bold text-gray-700">Driveフォルダ</span>
        </div>
        <div className="flex items-center gap-2">
          {folderUrl && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-navy bg-white border border-[#e0e6f0] px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                アップロード
              </button>
              <a
                href={folderUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-bold text-[#4285f4] hover:text-[#1a73e8] bg-white border border-[#e0e6f0] px-2.5 py-1.5 rounded-lg transition"
              >
                <ExternalLink size={12} />
                Driveで開く
              </a>
              {onFolderRemoved && (
                <button
                  onClick={() => { if (confirm('フォルダの紐付けを解除しますか？（Driveのフォルダは削除されません）')) onFolderRemoved() }}
                  className="flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-600 bg-white border border-[#e0e6f0] px-2.5 py-1.5 rounded-lg transition"
                  title="フォルダの紐付けを解除"
                >
                  <X size={12} />
                  解除
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />

      {/* コンテンツ */}
      <div className="p-4">
        {!folderId ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <FolderOpen size={36} className="text-gray-200" />
            <p className="text-sm text-gray-400">まだDriveフォルダが作成されていません</p>
            <button
              onClick={createFolder}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#4285f4] text-white text-sm font-bold rounded-lg hover:bg-[#1a73e8] transition disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <FolderPlus size={14} />}
              {creating ? '作成中...' : 'フォルダを作成'}
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <FileText size={32} className="text-gray-200" />
            <p className="text-sm text-gray-400">ファイルがありません</p>
            <p className="text-xs text-gray-300">「アップロード」からファイルを追加できます</p>
          </div>
        ) : (
          <div className="space-y-1">
            {files.map(f => (
              <a
                key={f.id}
                href={f.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f0f4ff] transition group"
              >
                <span className="text-base flex-shrink-0">{fileIcon(f.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate group-hover:text-navy">{f.name}</p>
                  <p className="text-[10px] text-gray-400">{new Date(f.modifiedTime).toLocaleDateString('ja-JP')}</p>
                </div>
                <ExternalLink size={12} className="text-gray-300 group-hover:text-navy flex-shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
