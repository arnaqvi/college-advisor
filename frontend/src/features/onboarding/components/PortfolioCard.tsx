// Portfolio-grid card for personal projects (design doc §1: "Internships &
// Projects — Two tabs, portfolio-grid cards").

import { ExternalLink, Github, Pencil, Play, Trash2 } from 'lucide-react'

export interface PortfolioCardProps {
  name: string
  description?: string | null
  technologies?: string | null
  githubUrl?: string | null
  websiteUrl?: string | null
  videoUrl?: string | null
  onEdit: () => void
  onDelete: () => void
}

export function PortfolioCard({
  name,
  description,
  technologies,
  githubUrl,
  websiteUrl,
  videoUrl,
  onEdit,
  onDelete,
}: PortfolioCardProps): JSX.Element {
  const techList = technologies
    ? technologies
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : []

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border border-t-4 border-t-accent bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-text-primary">{name}</p>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit"
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface-raised hover:text-accent"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete"
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface-raised hover:text-warning"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {description && <p className="line-clamp-3 text-sm text-text-secondary">{description}</p>}

      {techList.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {techList.map((tech) => (
            <span key={tech} className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] text-text-secondary">
              {tech}
            </span>
          ))}
        </div>
      )}

      {(githubUrl || websiteUrl || videoUrl) && (
        <div className="flex gap-3 text-xs text-accent">
          {githubUrl && (
            <a href={githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
              <Github size={13} /> Code
            </a>
          )}
          {websiteUrl && (
            <a href={websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
              <ExternalLink size={13} /> Live site
            </a>
          )}
          {videoUrl && (
            <a href={videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
              <Play size={13} /> Demo
            </a>
          )}
        </div>
      )}
    </div>
  )
}
