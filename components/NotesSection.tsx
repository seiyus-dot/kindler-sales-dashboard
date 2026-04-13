'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Placeholder } from '@tiptap/extension-placeholder'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AiCoachFile } from '@/lib/supabase'

// ── Toolbar button ─────────────────────────────────────────
function TbBtn({
  onClick, active, title, children,
}: {
  onClick: () => void
  active?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      style={{
        background: active ? '#e4eaf4' : 'none',
        border: `1px solid ${active ? '#c0cce0' : 'transparent'}`,
        borderRadius: 5,
        padding: '3px 9px',
        cursor: 'pointer',
        fontSize: 12,
        color: '#1a2540',
        fontWeight: active ? 700 : 500,
        fontFamily: 'inherit',
        lineHeight: '18px',
        transition: 'background .1s',
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 20, background: '#dde2ec', margin: '0 3px', alignSelf: 'center' }} />
}

function fileLabel(mimeType?: string) {
  if (!mimeType) return 'FILE'
  if (mimeType.startsWith('image/')) return 'IMG'
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'XLS'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'DOC'
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'ZIP'
  return 'FILE'
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── NotesSection ───────────────────────────────────────────
export function NotesSection({ clientId }: { clientId: string }) {
  const [noteId, setNoteId] = useState<string | null>(null)
  const [files, setFiles] = useState<AiCoachFile[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteIdRef = useRef<string | null>(null)
  const clientIdRef = useRef(clientId)

  // Keep refs in sync with latest state/props
  clientIdRef.current = clientId
  noteIdRef.current = noteId

  const saveNote = async (html: string) => {
    setSaveStatus('saving')
    const cId = clientIdRef.current
    const nId = noteIdRef.current
    if (nId) {
      await supabase
        .from('aicoach_notes')
        .update({ content: html, updated_at: new Date().toISOString() })
        .eq('id', nId)
    } else {
      const { data } = await supabase
        .from('aicoach_notes')
        .insert({ client_id: cId, content: html })
        .select()
        .single()
      if (data) setNoteId(data.id)
    }
    setSaveStatus('saved')
    if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current)
    saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
  }

  const saveNoteRef = useRef(saveNote)
  saveNoteRef.current = saveNote

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: 'メモや記録を自由に入力できます。見出し・箇条書き・表の挿入も可能です。' }),
    ],
    editorProps: {
      attributes: { class: 'tiptap-notes' },
    },
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => saveNoteRef.current(editor.getHTML()), 1500)
    },
  })

  useEffect(() => {
    if (!editor) return
    setNoteId(null)
    setFiles([])
    setSaveStatus('idle')
    if (saveTimer.current) clearTimeout(saveTimer.current)

    const load = async () => {
      const { data: note } = await supabase
        .from('aicoach_notes')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      if (note) {
        setNoteId(note.id)
        editor.commands.setContent(note.content ?? '')
      } else {
        editor.commands.setContent('')
      }
      const { data: filesData } = await supabase
        .from('aicoach_files')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at')
      setFiles(filesData ?? [])
    }
    load()
  }, [editor, clientId])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current)
    }
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const path = `${clientId}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('aicoach-files').upload(path, file)
    if (error) {
      setUploadError('アップロードに失敗しました（ストレージバケット「aicoach-files」が必要です）')
    } else {
      const { data } = await supabase
        .from('aicoach_files')
        .insert({ client_id: clientId, name: file.name, storage_path: path, size: file.size, mime_type: file.type })
        .select()
        .single()
      if (data) setFiles(prev => [...prev, data])
    }
    setUploading(false)
    e.target.value = ''
  }

  const deleteFile = async (id: string, storagePath: string) => {
    await supabase.storage.from('aicoach-files').remove([storagePath])
    await supabase.from('aicoach_files').delete().eq('id', id)
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const getPublicUrl = (path: string) =>
    supabase.storage.from('aicoach-files').getPublicUrl(path).data.publicUrl

  if (!editor) return null

  const inTable = editor.isActive('table')

  return (
    <div style={{ background: '#fff', border: '1.5px solid #e0e6f0', borderRadius: 14, padding: '18px 20px', marginTop: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2540' }}>メモ・記録</div>
        <span style={{
          fontSize: 11,
          color: saveStatus === 'saving' ? '#b8902a' : '#a0aab8',
          transition: 'color .3s',
        }}>
          {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '保存済み' : ''}
        </span>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        background: '#f8f9fd', border: '1px solid #eaecf4',
        borderRadius: '8px 8px 0 0', padding: '5px 8px',
      }}>
        <TbBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="太字 (Ctrl+B)">
          <strong>B</strong>
        </TbBtn>
        <TbBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="斜体 (Ctrl+I)">
          <em>I</em>
        </TbBtn>
        <TbBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="取り消し線">
          <s>S</s>
        </TbBtn>
        <Sep />
        <TbBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="見出し1">H1</TbBtn>
        <TbBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="見出し2">H2</TbBtn>
        <TbBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="見出し3">H3</TbBtn>
        <Sep />
        <TbBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="箇条書き">
          • リスト
        </TbBtn>
        <TbBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="番号付きリスト">
          1. リスト
        </TbBtn>
        <Sep />
        <TbBtn
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="3×3の表を挿入"
        >
          表を挿入
        </TbBtn>
        {inTable && (
          <>
            <Sep />
            <TbBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="右に列を追加">+列</TbBtn>
            <TbBtn onClick={() => editor.chain().focus().deleteColumn().run()} title="列を削除">-列</TbBtn>
            <TbBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="下に行を追加">+行</TbBtn>
            <TbBtn onClick={() => editor.chain().focus().deleteRow().run()} title="行を削除">-行</TbBtn>
            <TbBtn onClick={() => editor.chain().focus().deleteTable().run()} title="表を削除">表削除</TbBtn>
          </>
        )}
      </div>

      {/* Editor body */}
      <div style={{
        border: '1px solid #eaecf4', borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        padding: '12px 14px',
        minHeight: 200,
        cursor: 'text',
      }}
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Files section */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #f0f2f8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2540' }}>添付ファイル</div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              background: '#f0f4ff', border: '1px solid #c0cce0',
              borderRadius: 6, padding: '4px 12px', fontSize: 11,
              color: '#1a3a6e', cursor: uploading ? 'default' : 'pointer',
              fontWeight: 600, fontFamily: 'inherit',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? 'アップロード中...' : '+ ファイルを追加'}
          </button>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
        </div>

        {uploadError && (
          <div style={{ fontSize: 11, color: '#c04a30', marginBottom: 8, background: '#fff4f4', border: '1px solid #f4c0b8', borderRadius: 6, padding: '6px 10px' }}>
            {uploadError}
          </div>
        )}

        {files.length === 0 ? (
          <div style={{ fontSize: 12, color: '#b0b8cc', padding: '6px 0' }}>添付ファイルはありません</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: '#f8f9fd', border: '1px solid #eaecf4',
                borderRadius: 8, padding: '7px 12px',
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: '#5a6a8a',
                  background: '#e4eaf4', borderRadius: 3,
                  padding: '2px 5px', flexShrink: 0, letterSpacing: '0.05em',
                }}>
                  {fileLabel(f.mime_type)}
                </span>
                <a
                  href={getPublicUrl(f.storage_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1, fontSize: 12, color: '#1a3a6e', fontWeight: 600,
                    textDecoration: 'none', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {f.name}
                </a>
                <span style={{ fontSize: 11, color: '#9aa3bc', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {fmtSize(f.size)}
                </span>
                <button
                  onClick={() => deleteFile(f.id, f.storage_path)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#c04a30', fontSize: 13, padding: '0 2px',
                    fontFamily: 'inherit', flexShrink: 0,
                  }}
                  title="削除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
