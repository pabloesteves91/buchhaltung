import { useRef, useState } from 'react'
import { FileText, Image as ImageIcon, Paperclip, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { fileUrl, uploadAttachment, deleteFile } from '@/lib/storage'
import type { Attachment } from '@/lib/types'

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function AttachmentList({
  folder,
  attachments,
  onChange,
  compact,
}: {
  folder: string
  attachments: Attachment[]
  onChange: (next: Attachment[]) => void
  compact?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      const added: Attachment[] = []
      for (const file of Array.from(files)) {
        added.push(await uploadAttachment(folder, file))
      }
      onChange([...attachments, ...added])
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function open(a: Attachment) {
    const url = await fileUrl(a.storagePath)
    window.open(url, '_blank', 'noopener')
  }

  async function remove(a: Attachment) {
    await deleteFile(a.storagePath)
    onChange(attachments.filter((x) => x.storagePath !== a.storagePath))
  }

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((a) => (
            <li
              key={a.storagePath}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            >
              {a.contentType.startsWith('image/') ? (
                <ImageIcon className="size-4 shrink-0 text-slate-400" />
              ) : (
                <FileText className="size-4 shrink-0 text-slate-400" />
              )}
              <button
                type="button"
                className="flex-1 truncate text-left text-slate-700 hover:text-brand-600"
                onClick={() => open(a)}
              >
                {a.name}
              </button>
              <span className="text-xs text-slate-400">{fmtSize(a.size)}</span>
              <button
                type="button"
                className="text-slate-300 hover:text-red-600"
                onClick={() => remove(a)}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="secondary"
        size={compact ? 'sm' : 'md'}
        onClick={() => input.current?.click()}
        disabled={busy}
      >
        <Paperclip className="size-4" />
        {busy ? 'Wird hochgeladen …' : 'Beleg anhängen'}
      </Button>
    </div>
  )
}
