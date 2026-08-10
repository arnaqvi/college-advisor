import { Fragment, useEffect, useState } from 'react'
import { CheckCircle2, Circle, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAppContext } from '../context/AppContext.jsx'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'
import {
  fetchCompletions,
  setCompletion,
  fetchCustomTasks,
  createCustomTask,
  updateCustomTask,
  deleteCustomTask,
} from '../lib/api/tasks.js'

const BLANK_DEADLINE_DRAFT = { edDate: '', eaDate: '', rdDate: '', rolling: false }

export default function Timeline() {
  const { derivedPlan, saveDeadlineOverride } = useAppContext()
  const [completedSlugs, setCompletedSlugs] = useState(new Set())
  const [customTasks, setCustomTasks] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState({})
  const [editingProgramSlug, setEditingProgramSlug] = useState(null)
  const [deadlineDraft, setDeadlineDraft] = useState(BLANK_DEADLINE_DRAFT)
  const [savingDeadline, setSavingDeadline] = useState(false)

  useRevealOnMount([derivedPlan])

  // Checkboxes stay disabled until this resolves (see TaskRow/CustomTaskRow
  // below) — toggling before the real saved state has loaded could race with
  // this fetch overwriting the whole set and silently drop the click.
  useEffect(() => {
    let cancelled = false
    Promise.all([fetchCompletions(), fetchCustomTasks()])
      .then(([slugs, tasks]) => {
        if (cancelled) return
        setCompletedSlugs(new Set(slugs))
        setCustomTasks(tasks)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load your saved progress.')
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function toggleSlug(slug) {
    const wasCompleted = completedSlugs.has(slug)
    setCompletedSlugs((prev) => {
      const next = new Set(prev)
      wasCompleted ? next.delete(slug) : next.add(slug)
      return next
    })
    try {
      await setCompletion(slug, !wasCompleted)
    } catch (err) {
      setCompletedSlugs((prev) => {
        const next = new Set(prev)
        wasCompleted ? next.add(slug) : next.delete(slug)
        return next
      })
      setError(err.message || 'Could not save that change — try again.')
    }
  }

  async function toggleCustomTask(task) {
    const nextCompleted = !task.completed_at
    setCustomTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed_at: nextCompleted ? new Date().toISOString() : null } : t))
    )
    try {
      await updateCustomTask(task.id, { completed: nextCompleted })
    } catch (err) {
      setCustomTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)))
      setError(err.message || 'Could not save that change — try again.')
    }
  }

  async function addCustomTask(month, category) {
    const draftKey = `${month}:${category}`
    const title = (drafts[draftKey] || '').trim()
    if (!title) return
    setDrafts((prev) => ({ ...prev, [draftKey]: '' }))
    try {
      const created = await createCustomTask({ title, category, month })
      setCustomTasks((prev) => [...prev, created])
    } catch (err) {
      setDrafts((prev) => ({ ...prev, [draftKey]: title }))
      setError(err.message || 'Could not add that task — try again.')
    }
  }

  async function removeCustomTask(task) {
    setCustomTasks((prev) => prev.filter((t) => t.id !== task.id))
    try {
      await deleteCustomTask(task.id)
    } catch (err) {
      setCustomTasks((prev) => [...prev, task])
      setError(err.message || 'Could not delete that task — try again.')
    }
  }

  function openDeadlineEditor(programSlug) {
    const program = derivedPlan.classifiedPrograms.find((p) => p.id === programSlug)
    const existing = program?.deadlineOverride
    setDeadlineDraft(
      existing
        ? {
            edDate: existing.edDate || '',
            eaDate: existing.eaDate || '',
            rdDate: existing.rdDate || '',
            rolling: existing.rolling,
          }
        : BLANK_DEADLINE_DRAFT
    )
    setEditingProgramSlug(programSlug)
  }

  async function saveDeadlineDraft(e) {
    e.preventDefault()
    setSavingDeadline(true)
    try {
      await saveDeadlineOverride(editingProgramSlug, {
        edDate: deadlineDraft.edDate || null,
        eaDate: deadlineDraft.eaDate || null,
        rdDate: deadlineDraft.rdDate || null,
        rolling: deadlineDraft.rolling,
      })
      setEditingProgramSlug(null)
    } catch (err) {
      setError(err.message || 'Could not save that deadline — try again.')
    } finally {
      setSavingDeadline(false)
    }
  }

  return (
    <Reveal>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">
        Month-by-Month Timeline
      </h2>
      <p className="mt-1 text-sm text-text-secondary">Student and parent action items across the application season.</p>
      {error && <p className="mt-2 text-sm font-medium text-reach">{error}</p>}

      <div className="mt-6 space-y-4">
        {derivedPlan.roadmap.map((m, i) => (
          <Reveal
            key={m.month}
            delay={`${i * 0.04}s`}
            className="landing-hover landing-stagger rounded-2xl border border-border bg-surface-raised p-4"
          >
            <h3 className="font-semibold text-text-primary">
              {m.month}
              {m.year ? ` ${m.year}` : ''}
            </h3>
            {m.hardDeadlines.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs font-medium text-reach">
                {m.hardDeadlines.map((d) => (
                  <Fragment key={d.slug}>
                    <TaskRow completed={completedSlugs.has(d.slug)} disabled={!loaded} onToggle={() => toggleSlug(d.slug)}>
                      {d.date ? `${d.date} — ` : ''}
                      {d.label}
                      {!d.verified && (
                        <button
                          type="button"
                          onClick={() => openDeadlineEditor(d.programSlug)}
                          className="ml-2 inline-flex items-center gap-1 font-normal text-text-secondary hover:text-accent-contrast"
                        >
                          <Pencil size={11} />
                          Set real deadline
                        </button>
                      )}
                    </TaskRow>
                    {editingProgramSlug === d.programSlug && (
                      <li>
                        <DeadlineEditorForm
                          draft={deadlineDraft}
                          onChange={setDeadlineDraft}
                          onSave={saveDeadlineDraft}
                          onCancel={() => setEditingProgramSlug(null)}
                          saving={savingDeadline}
                        />
                      </li>
                    )}
                  </Fragment>
                ))}
              </ul>
            )}
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <TaskColumn
                title="Student Tasks"
                items={m.studentTasks}
                completedSlugs={completedSlugs}
                loaded={loaded}
                onToggle={toggleSlug}
                customTasks={customTasks.filter((t) => t.month === m.month && t.category === 'student')}
                onToggleCustom={toggleCustomTask}
                onRemoveCustom={removeCustomTask}
                draft={drafts[`${m.month}:student`] || ''}
                onDraftChange={(value) => setDrafts((prev) => ({ ...prev, [`${m.month}:student`]: value }))}
                onAdd={() => addCustomTask(m.month, 'student')}
              />
              <TaskColumn
                title="Parent Tasks"
                items={m.parentTasks}
                completedSlugs={completedSlugs}
                loaded={loaded}
                onToggle={toggleSlug}
                customTasks={customTasks.filter((t) => t.month === m.month && t.category === 'parent')}
                onToggleCustom={toggleCustomTask}
                onRemoveCustom={removeCustomTask}
                draft={drafts[`${m.month}:parent`] || ''}
                onDraftChange={(value) => setDrafts((prev) => ({ ...prev, [`${m.month}:parent`]: value }))}
                onAdd={() => addCustomTask(m.month, 'parent')}
              />
            </div>
          </Reveal>
        ))}
      </div>
    </Reveal>
  )
}

function TaskRow({ completed, disabled, onToggle, children }) {
  return (
    <li className="flex items-start gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className="mt-0.5 shrink-0 text-text-secondary hover:text-accent-contrast disabled:opacity-40"
      >
        {completed ? <CheckCircle2 size={16} className="text-safety" /> : <Circle size={16} />}
      </button>
      <span className={completed ? 'text-text-secondary line-through' : ''}>{children}</span>
    </li>
  )
}

function TaskColumn({
  title,
  items,
  completedSlugs,
  loaded,
  onToggle,
  customTasks,
  onToggleCustom,
  onRemoveCustom,
  draft,
  onDraftChange,
  onAdd,
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-text-secondary">
        {items.map((t) => (
          <TaskRow key={t.slug} completed={completedSlugs.has(t.slug)} disabled={!loaded} onToggle={() => onToggle(t.slug)}>
            {t.text}
          </TaskRow>
        ))}
        {customTasks.map((task) => (
          <li key={task.id} className="flex items-start gap-2">
            <button
              type="button"
              disabled={!loaded}
              onClick={() => onToggleCustom(task)}
              className="mt-0.5 shrink-0 text-text-secondary hover:text-accent-contrast disabled:opacity-40"
            >
              {task.completed_at ? <CheckCircle2 size={16} className="text-safety" /> : <Circle size={16} />}
            </button>
            <span className={`flex-1 ${task.completed_at ? 'text-text-secondary line-through' : ''}`}>
              {task.title}
            </span>
            <button
              type="button"
              onClick={() => onRemoveCustom(task)}
              className="shrink-0 text-text-secondary hover:text-reach"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onAdd()
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Add a task…"
          maxLength={500}
          className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-primary"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-semibold text-text-primary disabled:opacity-40"
        >
          <Plus size={12} />
          Add
        </button>
      </form>
    </div>
  )
}

// Lets a student self-report a real deadline for a school with no verified
// data yet (see lib/engine/timelineEngine.js's `entriesFromOverride`) —
// stored per-user, never shown to other students, see
// backend/app/models/college.py's DeadlineOverride docstring for why.
function DeadlineEditorForm({ draft, onChange, onSave, onCancel, saving }) {
  return (
    <form onSubmit={onSave} className="mt-1 space-y-2 rounded-lg border border-border bg-surface p-3 font-normal normal-case text-text-primary">
      <div className="grid grid-cols-3 gap-2">
        <DateField label="ED" value={draft.edDate} disabled={draft.rolling} onChange={(v) => onChange({ ...draft, edDate: v })} />
        <DateField label="EA" value={draft.eaDate} disabled={draft.rolling} onChange={(v) => onChange({ ...draft, eaDate: v })} />
        <DateField label="RD" value={draft.rdDate} disabled={draft.rolling} onChange={(v) => onChange({ ...draft, rdDate: v })} />
      </div>
      <label className="flex items-center gap-2 text-xs text-text-secondary">
        <input type="checkbox" checked={draft.rolling} onChange={(e) => onChange({ ...draft, rolling: e.target.checked })} />
        Rolling admission (no fixed deadline)
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-accent-contrast disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-text-primary">
          Cancel
        </button>
      </div>
    </form>
  )
}

function DateField({ label, value, disabled, onChange }) {
  return (
    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-text-secondary">
      {label}
      <input
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-surface-raised px-1.5 py-1 text-xs text-text-primary disabled:opacity-40"
      />
    </label>
  )
}
