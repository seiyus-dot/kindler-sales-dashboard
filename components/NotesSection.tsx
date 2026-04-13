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
import type { AiCoachFile, AiCoachNote } from '@/lib/supabase'

const todayStr = () => new Date().toISOString().split('T')[0]
const fmtDate = (s: string | null) => {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  return `${y}/${m}/${d}`
}
const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
const fileLabel = (mimeType?: string) => {
  if (!mimeType) return 'FILE'
  if (mimeType.startsWith('image/')) return 'IMG'
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'XLS'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'DOC'
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'ZIP'
  return 'FILE'
}

// ── Toolbar helpers ────────────────────────────────────────
function TbBtn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title?: string; children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      style={{
        background: active ? '#e4eaf4' : 'none',
        border: `1px solid ${active ? '#c0cce0' : 'transparent'}`,
        borderRadius: 5, padding: '3px 9px', cursor: 'pointer',
        fontSize: 12, color: '#1a2540', fontWeight: active ? 700 : 500,
        fontFamily: 'inherit', lineHeight: '18px',
      }}
    >{children}</button>
  )
}
function Sep() {
  return <div style={{ width: 1, height: 20, background: '#dde2ec', margin: '0 3px', alignSelf: 'center' }} />
}

// ── NoteEditor ─────────────────────────────────────────────
function NoteEditor({ note }: { note: AiCoachNote }) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveNote = async (html: string) => {
    setSaveStatus('saving')
    await supabase.from('aicoach_notes')
      .update({ content: html, updated_at: new Date().toISOString() })
      .eq('id', note.id)
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
      TableRow, TableHeader, TableCell,
      Placeholder.configure({ placeholder: '内容を入力...' }),
    ],
    editorProps: { attributes: { class: 'tiptap-notes' } },
    content: note.content,
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => saveNoteRef.current(editor.getHTML()), 1500)
    },
  })

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current)
    }
  }, [])

  if (!editor) return null

  const inTable = editor.isActive('table')

  return (
    <div style={{ borderTop: '1px solid #f0f2f8', padding: '12px 14px 14px' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        background: '#f8f9fd', border: '1px solid #eaecf4',
        borderRadius: '8px 8px 0 0', padding: '5px 8px',
      }}>
        <TbBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="太字"><strong>B</strong></TbBtn>
        <TbBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="斜体"><em>I</em></TbBtn>
        <TbBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="取り消し線"><s>S</s></TbBtn>
        <Sep />
        <TbBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="見出し1">H1</TbBtn>
        <TbBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="見出し2">H2</TbBtn>
        <Sep />
        <TbBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="箇条書き">• リスト</TbBtn>
        <TbBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="番号付きリスト">1. リスト</TbBtn>
        <Sep />
        <TbBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="表を挿入">表</TbBtn>
        {inTable && (
          <>
            <Sep />
            <TbBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="列追加">+列</TbBtn>
            <TbBtn onClick={() => editor.chain().focus().deleteColumn().run()} title="列削除">-列</TbBtn>
            <TbBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="行追加">+行</TbBtn>
            <TbBtn onClick={() => editor.chain().focus().deleteRow().run()} title="行削除">-行</TbBtn>
            <TbBtn onClick={() => editor.chain().focus().deleteTable().run()} title="表削除">表削除</TbBtn>
          </>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: saveStatus === 'saving' ? '#b8902a' : '#a0aab8', alignSelf: 'center', transition: 'color .3s' }}>
          {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '保存済み' : ''}
        </div>
      </div>
      {/* Editor body */}
      <div
        style={{ border: '1px solid #eaecf4', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', minHeight: 140, cursor: 'text' }}
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

// ── NoteCard ───────────────────────────────────────────────
function NoteCard({ note, isExpanded, onToggle, onDelete, onTitleChange }: {
  note: AiCoachNote
  isExpanded: boolean
  onToggle: () => void
  onDelete: () => void
  onTitleChange: (id: string, title: string) => void
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(note.title)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setTitle(note.title) }, [note.title])
  useEffect(() => { if (editingTitle) titleInputRef.current?.focus() }, [editingTitle])

  const saveTitle = async () => {
    const t = title.trim() || '（タイトルなし）'
    setTitle(t)
    setEditingTitle(false)
    if (t !== note.title) {
      await supabase.from('aicoach_notes').update({ title: t }).eq('id', note.id)
      onTitleChange(note.id, t)
    }
  }

  return (
    <div style={{ border: '1.5px solid #e8ecf4', borderRadius: 10, marginBottom: 8, overflow: 'hidden', background: '#fff' }}>
      {/* Header row */}
      <div
        onClick={!editingTitle ? onToggle : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: editingTitle ? 'default' : 'pointer', background: isExpanded ? '#f8f9fd' : '#fff', userSelect: 'none' }}
      >
        {/* Date */}
        {note.note_date && (
          <span style={{ fontSize: 11, color: '#9aa3bc', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDate(note.note_date)}</span>
        )}

        {/* Title */}
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(note.title); setEditingTitle(false) } }}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, border: '1.5px solid #1a3a6e', borderRadius: 5, padding: '3px 8px', fontSize: 13, fontWeight: 600, color: '#1a2540', fontFamily: 'inherit', outline: 'none' }}
          />
        ) : (
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1a2540', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {note.title || '（タイトルなし）'}
          </span>
        )}

        {/* Actions */}
        <button
          onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setEditingTitle(true) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa3bc', fontSize: 12, padding: '2px 5px', fontFamily: 'inherit', flexShrink: 0 }}
          title="タイトルを編集"
        >編集</button>
        <button
          onMouseDown={e => { e.stopPropagation(); e.preventDefault(); if (confirm('この記録を削除しますか？')) onDelete() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c04a30', fontSize: 13, padding: '2px 4px', fontFamily: 'inherit', flexShrink: 0 }}
          title="削除"
        >✕</button>
        <span style={{ fontSize: 10, color: '#9aa3bc', flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
      </div>

      {/* Editor (only when expanded) */}
      {isExpanded && <NoteEditor key={note.id} note={note} />}
    </div>
  )
}

// ── NotesSection ───────────────────────────────────────────
export function NotesSection({ clientId }: { clientId: string }) {
  const [notes, setNotes] = useState<AiCoachNote[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addingNote, setAddingNote] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState(todayStr())
  const [files, setFiles] = useState<AiCoachFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const newTitleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setNotes([])
    setExpandedId(null)
    setAddingNote(false)
    setFiles([])

    const load = async () => {
      const { data: notesData } = await supabase
        .from('aicoach_notes').select('*')
        .eq('client_id', clientId).order('created_at', { ascending: false })
      setNotes(notesData ?? [])

      const { data: filesData } = await supabase
        .from('aicoach_files').select('*')
        .eq('client_id', clientId).order('created_at')
      setFiles(filesData ?? [])
    }
    load()
  }, [clientId])

  useEffect(() => {
    if (addingNote) { setNewTitle(''); setNewDate(todayStr()); setTimeout(() => newTitleRef.current?.focus(), 50) }
  }, [addingNote])

  const addNote = async () => {
    const t = newTitle.trim()
    if (!t) return
    setAddError(null)
    const { data, error } = await supabase
      .from('aicoach_notes')
      .insert({ client_id: clientId, title: t, content: '', note_date: newDate || null, sort_order: 0 })
      .select().single()
    if (error) {
      setAddError(`保存に失敗しました: ${error.message}`)
      return
    }
    if (data) {
      setNotes(prev => [data, ...prev])
      setExpandedId(data.id)
    }
    setAddingNote(false)
  }

  const deleteNote = async (id: string) => {
    await supabase.from('aicoach_notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const handleTitleChange = (id: string, title: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, title } : n))
  }

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
        .select().single()
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

  return (
    <div style={{ background: '#fff', border: '1.5px solid #e0e6f0', borderRadius: 14, padding: '18px 20px', marginTop: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2540' }}>記録</div>
        <button
          onClick={() => setAddingNote(v => !v)}
          style={{ background: addingNote ? '#f0f2f8' : '#1a3a6e', border: 'none', borderRadius: 7, padding: '5px 14px', fontSize: 11, color: addingNote ? '#6a7a9a' : '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}
        >
          {addingNote ? 'キャンセル' : '+ 記録を追加'}
        </button>
      </div>

      {/* Add note form */}
      {addingNote && (
        <div style={{ background: '#f8f9fd', border: '1.5px solid #d8e0f0', borderRadius: 10, padding: '12px 14px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {addError && (
            <div style={{ fontSize: 11, color: '#c04a30', background: '#fff4f4', border: '1px solid #f4c0b8', borderRadius: 6, padding: '6px 10px' }}>{addError}</div>
          )}
          <input
            ref={newTitleRef}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addNote(); if (e.key === 'Escape') setAddingNote(false) }}
            placeholder="タイトル（例：第一回商談、進捗確認など）"
            style={{ border: '1.5px solid #d0d8ec', borderRadius: 7, padding: '7px 11px', fontSize: 13, color: '#1a2540', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              style={{ border: '1.5px solid #d0d8ec', borderRadius: 7, padding: '6px 10px', fontSize: 12, color: '#1a2540', fontFamily: 'inherit', outline: 'none' }}
            />
            <button
              onClick={addNote}
              disabled={!newTitle.trim()}
              style={{ background: newTitle.trim() ? '#1a3a6e' : '#c0c8d8', border: 'none', borderRadius: 7, padding: '6px 18px', fontSize: 12, color: '#fff', cursor: newTitle.trim() ? 'pointer' : 'default', fontWeight: 700, fontFamily: 'inherit' }}
            >
              作成
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 && !addingNote ? (
        <div style={{ fontSize: 12, color: '#b0b8cc', padding: '12px 0 4px' }}>記録はまだありません。「+ 記録を追加」から作成できます。</div>
      ) : (
        notes.map(note => (
          <NoteCard
            key={note.id}
            note={note}
            isExpanded={expandedId === note.id}
            onToggle={() => setExpandedId(expandedId === note.id ? null : note.id)}
            onDelete={() => deleteNote(note.id)}
            onTitleChange={handleTitleChange}
          />
        ))
      )}

      {/* Files section */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f0f2f8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2540' }}>添付ファイル</div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ background: '#f0f4ff', border: '1px solid #c0cce0', borderRadius: 6, padding: '4px 12px', fontSize: 11, color: '#1a3a6e', cursor: uploading ? 'default' : 'pointer', fontWeight: 600, fontFamily: 'inherit', opacity: uploading ? 0.6 : 1 }}
          >
            {uploading ? 'アップロード中...' : '+ ファイルを追加'}
          </button>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
        </div>
        {uploadError && (
          <div style={{ fontSize: 11, color: '#c04a30', marginBottom: 8, background: '#fff4f4', border: '1px solid #f4c0b8', borderRadius: 6, padding: '6px 10px' }}>{uploadError}</div>
        )}
        {files.length === 0 ? (
          <div style={{ fontSize: 12, color: '#b0b8cc', padding: '4px 0' }}>添付ファイルはありません</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8f9fd', border: '1px solid #eaecf4', borderRadius: 8, padding: '7px 12px' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#5a6a8a', background: '#e4eaf4', borderRadius: 3, padding: '2px 5px', flexShrink: 0, letterSpacing: '0.05em' }}>
                  {fileLabel(f.mime_type)}
                </span>
                <a href={getPublicUrl(f.storage_path)} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, fontSize: 12, color: '#1a3a6e', fontWeight: 600, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </a>
                <span style={{ fontSize: 11, color: '#9aa3bc', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtSize(f.size)}</span>
                <button onClick={() => deleteFile(f.id, f.storage_path)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c04a30', fontSize: 13, padding: '0 2px', fontFamily: 'inherit', flexShrink: 0 }}
                  title="削除">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
