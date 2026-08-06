// Shared drag/drop/camera/preview/progress upload component (design doc §6).
// One component for every section rather than one per section — takes
// ownerType/ownerId/accept/multiple props. Uses XMLHttpRequest (not fetch)
// because only XHR reports upload progress via `upload.onprogress`.

import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.jsx'
import { completeFileUpload, createFileUpload } from '../api/onboardingClient.ts'
import { FileCard } from './FileCard.tsx'
import type { UploadedFile, UploadOwnerType } from '../types/onboarding.ts'

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic']
const MAX_SIZE_BYTES = 15 * 1024 * 1024 // 15MB per §6

export interface UploadDropzoneProps {
  ownerType: UploadOwnerType
  ownerId?: number | null
  files: UploadedFile[]
  onUploaded: (file: UploadedFile) => void
  onRemove: (id: number) => void
  accept?: string
  multiple?: boolean
}

interface InFlightUpload {
  fileName: string
  progress: number
  error?: string
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Unsupported file type — use PDF, JPG, PNG, or HEIC.'
  }
  if (file.size > MAX_SIZE_BYTES) {
    return 'File is too large — max 15MB.'
  }
  return null
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(file)
  })
}

export function UploadDropzone({
  ownerType,
  ownerId = null,
  files,
  onUploaded,
  onRemove,
  accept,
  multiple = true,
}: UploadDropzoneProps): JSX.Element {
  const { user } = useAuth()
  const email: string | null = user?.email ?? null
  const [dragOver, setDragOver] = useState(false)
  const [inFlight, setInFlight] = useState<InFlightUpload[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setInFlight((prev) => [...prev, { fileName: file.name, progress: 0, error: validationError }])
        return
      }
      if (!email) return

      setInFlight((prev) => [...prev, { fileName: file.name, progress: 0 }])

      try {
        const created = await createFileUpload(email, {
          file_name: file.name,
          content_type: file.type,
          size_bytes: file.size,
          owner_type: ownerType,
          owner_id: ownerId,
        })

        await putWithProgress(created.upload_url, file, (pct) => {
          setInFlight((prev) => prev.map((u) => (u.fileName === file.name ? { ...u, progress: pct } : u)))
        })

        const completed = await completeFileUpload(email, created.id)
        onUploaded(completed)
        setInFlight((prev) => prev.filter((u) => u.fileName !== file.name))
      } catch {
        setInFlight((prev) =>
          prev.map((u) => (u.fileName === file.name ? { ...u, error: 'Upload failed — try again.' } : u)),
        )
      }
    },
    [email, onUploaded, ownerId, ownerType],
  )

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return
      Array.from(fileList).forEach((file) => void uploadFile(file))
    },
    [uploadFile],
  )

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          handleFiles(event.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragOver ? 'border-accent bg-accent/5' : 'border-border bg-surface-raised'
        }`}
      >
        <Upload size={22} className="text-text-secondary" />
        <p className="text-sm font-medium text-text-primary">
          <span className="hidden sm:inline">Drag a file in, or click to upload</span>
          <span className="sm:hidden">Tap to upload · Take a photo</span>
        </p>
        <p className="text-xs text-text-secondary">PDF, JPG, PNG, or HEIC — up to 15MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept ?? ACCEPTED_TYPES.join(',')}
          multiple={multiple}
          capture="environment"
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {inFlight.map((upload) => (
        <div key={upload.fileName} className="rounded-md border border-border bg-surface px-3 py-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-text-primary">{upload.fileName}</span>
            <span className={upload.error ? 'text-warning' : 'text-text-secondary'}>
              {upload.error ?? `${upload.progress}%`}
            </span>
          </div>
          {!upload.error && (
            <div className="mt-1 h-1 w-full rounded-full bg-surface-raised">
              <div className="h-1 rounded-full bg-accent transition-all" style={{ width: `${upload.progress}%` }} />
            </div>
          )}
        </div>
      ))}

      {files.map((file) => (
        <FileCard key={file.id} file={file} onRemove={() => onRemove(file.id)} />
      ))}
    </div>
  )
}
