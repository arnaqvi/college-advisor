import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useAppContext } from '../context/AppContext.jsx'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'

export default function CounselorBiasCheck() {
  const { studentProfile, updateCounselorList, derivedPlan, colleges } = useAppContext()
  const selected = studentProfile.counselorCollegeList || []
  const result = derivedPlan.counselorBiasCheck
  const [saveError, setSaveError] = useState('')

  useRevealOnMount([result])

  async function toggle(id) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    const saveResult = await updateCounselorList(next)
    setSaveError(saveResult.ok ? '' : saveResult.error)
  }

  return (
    <Reveal>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">Counselor Bias Check</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Enter the college list your school counselor suggested to compare it against your own generated list.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {colleges.map((c) => (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              selected.includes(c.id)
                ? 'border-accent bg-accent text-accent-contrast'
                : 'border-border bg-surface-raised text-text-primary hover:bg-surface'
            }`}
          >
            {c.name}
          </button>
        ))}
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
        </div>
      )}
    </Reveal>
  )
}
