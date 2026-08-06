import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAppContext } from '../context/AppContext.jsx'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'
import { countWords } from '../lib/engine/essayTracker.js'

const STATUS_OPTIONS = ['Not started', 'Drafting', 'Revising', 'Final review', 'Submitted']
const PROMPT_TYPES = ['Personal statement', 'Supplemental — Why us', 'Supplemental — Activity', 'Supplemental — Other']

function newEssay() {
  return {
    id: `essay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    collegeId: '',
    promptType: PROMPT_TYPES[0],
    promptText: '',
    wordLimit: 650,
    wordCount: 0,
    status: STATUS_OPTIONS[0],
    reusedFromEssayId: '',
    updatedAt: new Date().toISOString(),
  }
}

export default function EssayTracker() {
  const { studentProfile, updateEssays, derivedPlan, colleges } = useAppContext()
  const enriched = derivedPlan.essayTracker
  const [saveError, setSaveError] = useState('')

  useRevealOnMount([enriched.length])

  async function persistEssays(essays) {
    const result = await updateEssays(essays)
    setSaveError(result.ok ? '' : result.error)
  }

  function handleAdd() {
    persistEssays([...(studentProfile.essays || []), newEssay()])
  }

  function handleChange(id, field, value) {
    persistEssays(
      (studentProfile.essays || []).map((e) => {
        if (e.id !== id) return e
        const updated = { ...e, [field]: value, updatedAt: new Date().toISOString() }
        // Live word count: derive from the essay text itself whenever it changes,
        // so "Word count" never has to be typed in by hand.
        if (field === 'promptText') {
          updated.wordCount = countWords(value)
        }
        return updated
      })
    )
  }

  function handleRemove(id) {
    persistEssays((studentProfile.essays || []).filter((e) => e.id !== id))
  }

  return (
    <Reveal>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">Essay Tracker</h2>
          <p className="mt-1 text-sm text-text-secondary">Track drafts, word counts, and reuse across your applications.</p>
        </div>
        <button
          onClick={handleAdd}
          className="landing-button-dark flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast hover:bg-accent/90"
        >
          <Plus size={14} /> Add Essay
        </button>
      </div>

      {saveError && <p className="mt-2 text-xs font-medium text-reach">{saveError}</p>}

      <div className="mt-6 space-y-4">
        {enriched.map((essay, i) => (
          <Reveal
            key={essay.id}
            delay={`${i * 0.04}s`}
            className="landing-stagger rounded-2xl border border-border bg-surface-raised p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-text-secondary">
                  College
                  <select
                    value={essay.collegeId}
                    onChange={(e) => handleChange(essay.id, 'collegeId', e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="">Select a college</option>
                    {colleges.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-text-secondary">
                  Prompt type
                  <select
                    value={essay.promptType}
                    onChange={(e) => handleChange(essay.id, 'promptType', e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                  >
                    {PROMPT_TYPES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-text-secondary sm:col-span-2">
                  Prompt text
                  <textarea
                    value={essay.promptText}
                    onChange={(e) => handleChange(essay.id, 'promptText', e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                  />
                </label>
                <label className="text-xs font-medium text-text-secondary">
                  Word limit
                  <input
                    type="number"
                    min={0}
                    value={essay.wordLimit}
                    onChange={(e) => handleChange(essay.id, 'wordLimit', Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                  />
                </label>
                <label className="text-xs font-medium text-text-secondary">
                  Word count
                  <input
                    type="number"
                    min={0}
                    value={essay.wordCount}
                    readOnly
                    title="Calculated automatically from the Prompt text field"
                    className="mt-1 w-full cursor-not-allowed rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-secondary"
                  />
                </label>
                <label className="text-xs font-medium text-text-secondary">
                  Status
                  <select
                    value={essay.status}
                    onChange={(e) => handleChange(essay.id, 'status', e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-text-secondary">
                  Reused from
                  <select
                    value={essay.reusedFromEssayId || ''}
                    onChange={(e) => handleChange(essay.id, 'reusedFromEssayId', e.target.value || null)}
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="">None</option>
                    {enriched
                      .filter((e) => e.id !== essay.id)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.promptType} ({colleges.find((c) => c.id === e.collegeId)?.name || 'unassigned'})
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <button
                onClick={() => handleRemove(essay.id)}
                className="shrink-0 rounded-full p-1.5 text-text-secondary hover:bg-reach-bg hover:text-reach"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-surface">
                <div className="h-2 rounded-full bg-accent" style={{ width: `${essay.progressPercent}%` }} />
              </div>
              <span className="text-xs font-medium text-text-secondary">{essay.progressPercent}%</span>
            </div>
            {essay.overlapWarning && (
              <p className="mt-2 text-xs font-medium text-target">
                This essay is very close in length to the one it's reused from — check for excessive overlap.
              </p>
            )}
          </Reveal>
        ))}
        {enriched.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border bg-surface-raised py-8 text-center text-sm text-text-secondary">
            No essays yet — click "Add Essay" to start tracking one.
          </p>
        )}
      </div>
    </Reveal>
  )
}
