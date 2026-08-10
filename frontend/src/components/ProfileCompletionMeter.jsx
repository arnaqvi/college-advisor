import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useAppContext } from '../context/AppContext.jsx'
import { calculateProfileCompletion } from '../lib/engine/profileCompletion.js'

// Meter spec (dataviz skill): fill carries severity (accent -> warning ->
// danger), unfilled track is a lighter step of the SAME ramp so state reads
// across the whole bar. Reuses this app's existing reach/target/safety
// triad (already validated, already used for Reach/Target/Safety tiers)
// rather than inventing a new palette — same red/amber/green meaning maps
// naturally onto low/medium/high completion.
function severityClasses(percent) {
  if (percent >= 80) return { fill: 'bg-safety', track: 'bg-safety-bg', text: 'text-safety' }
  if (percent >= 40) return { fill: 'bg-target', track: 'bg-target-bg', text: 'text-target' }
  return { fill: 'bg-reach', track: 'bg-reach-bg', text: 'text-reach' }
}

const READ_ONLY_ROLES = new Set(['parent', 'counselor'])

export default function ProfileCompletionMeter() {
  const { user } = useAuth()
  const { studentProfile } = useAppContext()
  const completion = calculateProfileCompletion(studentProfile)
  const { fill, track, text } = severityClasses(completion.percent)
  const isReadOnly = READ_ONLY_ROLES.has(user?.role)

  return (
    <div className="rounded-2xl border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-text-primary">Profile Completion</h3>
        <span className={`text-sm font-semibold ${completion.percent === 100 ? 'text-safety' : text}`}>
          {completion.percent}%
        </span>
      </div>
      <div
        className={`mt-3 h-3 w-full overflow-hidden rounded-full ${track}`}
        role="progressbar"
        aria-valuenow={completion.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Profile completion"
      >
        <div className={`h-full rounded-full ${fill} transition-all duration-500`} style={{ width: `${completion.percent}%` }} />
      </div>
      {completion.percent === 100 ? (
        <p className="mt-2 text-xs text-text-secondary">Every field that applies to you is filled in.</p>
      ) : (
        <p className="mt-2 text-xs text-text-secondary">
          {completion.completedCount} of {completion.totalCount} fields complete — missing{' '}
          {completion.missingFields.map((f) => f.label).join(', ')}
        </p>
      )}
      {!isReadOnly && completion.percent < 100 && (
        <Link to="/profile" className="mt-3 inline-block text-xs font-semibold text-accent-contrast hover:underline">
          Finish your profile →
        </Link>
      )}
    </div>
  )
}
