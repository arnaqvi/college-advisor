import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Loader2, Search, ShieldAlert, X } from 'lucide-react'
import { useAppContext } from '../context/AppContext.jsx'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'
import { researchCollegeBias } from '../lib/api/biasResearch.js'

// Splits the backend's fixed "## Verified" / "## Perceived" report (see
// backend/app/routers/bias_research.py's system prompt) into bulleted lines
// per section. Safe to do with plain string splitting rather than a
// markdown library — the heading/bullet shape is a contract we enforce in
// the prompt, not arbitrary model output.
function parseBiasReport(report) {
  const sections = { verified: [], perceived: [] }
  const [, verifiedBlock = '', perceivedBlock = ''] =
    report.match(/## Verified\s*([\s\S]*?)## Perceived\s*([\s\S]*)/) || []
  sections.verified = verifiedBlock
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2))
  sections.perceived = perceivedBlock
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2))
  return sections
}

export default function CounselorBiasCheck() {
  const { studentProfile, updateCounselorList, derivedPlan, colleges } = useAppContext()
  const selectedIds = studentProfile.counselorCollegeList || []
  const result = derivedPlan.counselorBiasCheck
  const [saveError, setSaveError] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  // Keyed by college id: { status: 'loading'|'done'|'error', report, sources, message }
  const [research, setResearch] = useState({})

  useRevealOnMount([result])

  // Same click-outside-closes pattern as MultiSelect.jsx/Compare.jsx.
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const selected = useMemo(
    () => selectedIds.map((id) => colleges.find((c) => c.id === id)).filter(Boolean),
    [selectedIds, colleges]
  )

  // `colleges` (really programs — see biasResearch.js) can list the same
  // school more than once if the counselor's list includes multiple
  // programs there. Admissions bias is a property of the school, not the
  // program, so dedupe by name for the research cards below — any one of
  // that school's program ids resolves to the same college on the backend.
  const uniqueCollegesForResearch = useMemo(() => {
    const seen = new Map()
    for (const c of selected) {
      if (!seen.has(c.name)) seen.set(c.name, c)
    }
    return [...seen.values()]
  }, [selected])

  // `colleges` is the full directory (~230 rows once Scorecard imports are
  // in) — a bare pill-per-college wall doesn't scale, so only a short,
  // name-filtered list is ever shown at once.
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return colleges.filter((c) => !selectedIds.includes(c.id) && c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, colleges, selectedIds])

  async function toggle(id) {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    const saveResult = await updateCounselorList(next)
    setSaveError(saveResult.ok ? '' : saveResult.error)
  }

  async function addCollege(id) {
    await toggle(id)
    setQuery('')
    setOpen(false)
  }

  // Live web-search-backed research (see backend/app/routers/bias_research.py)
  // — deliberately opt-in per college rather than auto-firing on every list
  // change, since each call does real web searches and can take a while.
  // Keyed by college name (not the program slug passed to the API), since
  // research is a property of the school and uniqueCollegesForResearch
  // already dedupes multiple programs at the same school to one card.
  async function runResearch(college) {
    const key = college.name
    setResearch((r) => ({ ...r, [key]: { status: 'loading' } }))
    try {
      const data = await researchCollegeBias(college.id)
      if (data.status !== 'ok') {
        setResearch((r) => ({
          ...r,
          [key]: { status: 'error', message: data.message || 'No research available for this college.' },
        }))
        return
      }
      setResearch((r) => ({ ...r, [key]: { status: 'done', report: data.report, sources: data.sources } }))
    } catch (err) {
      setResearch((r) => ({ ...r, [key]: { status: 'error', message: err.message } }))
    }
  }

  return (
    <Reveal>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">Counselor Bias Check</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Enter the college list your school counselor suggested to compare it against your own generated list.
      </p>

      <div className="relative mt-6 max-w-md" ref={rootRef}>
        {selected.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selected.map((c) => (
              <span
                key={c.id}
                className="flex items-center gap-1.5 rounded-full border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast"
              >
                {c.name}
                <button type="button" onClick={() => toggle(c.id)} aria-label={`Remove ${c.name}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search colleges your counselor suggested…"
          className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary"
        />

        {open && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-surface-raised py-1 shadow-lg">
            {suggestions.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => addCollege(c.id)}
                  className="block w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-accent/10"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && query.trim() && suggestions.length === 0 && (
          <p className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-secondary shadow-lg">
            No matches in the directory.
          </p>
        )}
      </div>

      {saveError && <p className="mt-2 text-xs font-medium text-reach">{saveError}</p>}

      {!result ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border bg-surface-raised py-8 text-center text-sm text-text-secondary">
          Select the colleges your counselor suggested above to run the bias check.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          <Reveal className="landing-hover rounded-2xl border border-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 text-text-primary">
              <ShieldAlert size={16} />
              <h3 className="font-semibold">Concentration Flags</h3>
            </div>
            {result.concentrationFlags.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-target">
                {result.concentrationFlags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-safety">No concentration issues detected.</p>
            )}
          </Reveal>
          <Reveal delay="0.05s" className="landing-hover landing-stagger rounded-2xl border border-border bg-surface-raised p-4">
            <h3 className="font-semibold text-text-primary">Missing Categories</h3>
            <p className="mt-2 text-sm text-text-secondary">
              {result.missingCategories.length > 0
                ? result.missingCategories.join(', ')
                : 'None — the counselor list covers every category on your radar.'}
            </p>
          </Reveal>
          <Reveal delay="0.1s" className="landing-hover landing-stagger rounded-2xl border border-border bg-surface-raised p-4">
            <h3 className="font-semibold text-text-primary">Suggested Additions</h3>
            {result.suggestedAdditions.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-text-secondary">
                {result.suggestedAdditions.map((id) => {
                  const c = colleges.find((col) => col.id === id)
                  return <li key={id}>{c?.name}</li>
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-text-secondary">No additional suggestions.</p>
            )}
          </Reveal>

          <Reveal delay="0.15s" className="landing-hover landing-stagger rounded-2xl border border-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 text-text-primary">
              <Search size={16} />
              <h3 className="font-semibold">Admissions Bias Research</h3>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              Web-search-backed research into each school's own admissions process — separate from the list-balance
              checks above. Verified findings are backed by a cited source; perceived findings are anecdotal, not
              confirmed.
            </p>
            <div className="mt-3 space-y-3">
              {uniqueCollegesForResearch.map((c) => {
                const state = research[c.name]
                const parsed = state?.status === 'done' ? parseBiasReport(state.report) : null
                return (
                  <div key={c.name} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-text-primary">{c.name}</span>
                      <button
                        type="button"
                        onClick={() => runResearch(c)}
                        disabled={state?.status === 'loading'}
                        className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-accent/10 disabled:opacity-50"
                      >
                        {state?.status === 'loading' ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Search size={12} />
                        )}
                        {state?.status === 'done' ? 'Refresh' : 'Research'}
                      </button>
                    </div>

                    {state?.status === 'error' && <p className="mt-2 text-xs text-reach">{state.message}</p>}

                    {parsed && (
                      <div className="mt-3 space-y-3 text-sm">
                        <div>
                          <p className="font-medium text-safety">Verified</p>
                          {parsed.verified.length > 0 ? (
                            <ul className="mt-1 list-disc space-y-1 pl-4 text-text-secondary">
                              {parsed.verified.map((line, i) => (
                                <li key={i}>{line}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-text-secondary">No verified bias found.</p>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-target">Perceived (anecdotal)</p>
                          {parsed.perceived.length > 0 ? (
                            <ul className="mt-1 list-disc space-y-1 pl-4 text-text-secondary">
                              {parsed.perceived.map((line, i) => (
                                <li key={i}>{line}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-text-secondary">No commonly-discussed perceived bias found.</p>
                          )}
                        </div>
                        {state.sources.length > 0 && (
                          <div>
                            <p className="font-medium text-text-primary">Sources</p>
                            <ul className="mt-1 space-y-1">
                              {state.sources.map((s) => (
                                <li key={s.url}>
                                  <a
                                    href={s.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                                  >
                                    {s.title}
                                    <ExternalLink size={10} />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Reveal>
        </div>
      )}
    </Reveal>
  )
}
