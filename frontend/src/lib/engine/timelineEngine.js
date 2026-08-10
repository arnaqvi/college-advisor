// Spec 3.7 — Month-by-Month Timeline. Personalizes the static month/task
// skeleton with the student's graduation year and hard deadlines derived
// from their actual classified program list.
import { TIMELINE } from '../../data/timeline.js'
import { parseNumber } from './profileUtils.js'
import { deadlineTaskSlug, systemTaskSlug } from './taskSlugs.js'

const FALL_MONTHS = new Set(['September', 'October', 'November', 'December'])
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const ROUND_LABELS = { ED: 'Early Decision', EA: 'Early Action', RD: 'Regular Decision' }

function calendarYear(month, gradYear) {
  const year = parseNumber(gradYear)
  if (year === null) return null
  return FALL_MONTHS.has(month) ? year - 1 : year
}

function monthNameFromIsoDate(iso) {
  return MONTH_NAMES[Number(iso.slice(5, 7)) - 1]
}

// Real, hand-verified deadlines (backend/app/models/college.py's College.
// deadlines — see the Retention Phase 2 research ledger) shown to every
// user. Never invents a round the school doesn't actually offer.
function entriesFromCurated(deadlines) {
  if (!deadlines) return null
  const entries = []
  if (deadlines.ed) entries.push({ round: 'ED', date: deadlines.ed, verified: true })
  if (deadlines.ea) entries.push({ round: 'EA', date: deadlines.ea, verified: true })
  if (deadlines.rd) entries.push({ round: 'RD', date: deadlines.rd, verified: true })
  return entries.length ? entries : null
}

// A student's own self-reported deadline (lib/api/deadlineOverrides.js) —
// only used when no curated data exists for this program, see
// app/models/college.py's DeadlineOverride docstring for why this is
// per-user rather than a shared fact.
function entriesFromOverride(override) {
  if (!override) return null
  const entries = []
  if (override.edDate) entries.push({ round: 'ED', date: override.edDate, verified: false })
  if (override.eaDate) entries.push({ round: 'EA', date: override.eaDate, verified: false })
  if (override.rdDate) entries.push({ round: 'RD', date: override.rdDate, verified: false })
  // Rolling admission has no fixed date to place on the calendar — noted
  // via the label text elsewhere, not placed in a month bucket here.
  return entries.length ? entries : null
}

function realDeadlineEntries(program) {
  return entriesFromCurated(program.deadlines) || entriesFromOverride(program.deadlineOverride)
}

export function buildTimeline(profile, classifiedPrograms) {
  const hardDeadlinesByMonth = {}
  const addDeadline = (month, entry) => {
    if (!hardDeadlinesByMonth[month]) hardDeadlinesByMonth[month] = []
    hardDeadlinesByMonth[month].push(entry)
  }

  classifiedPrograms.forEach((p) => {
    const real = realDeadlineEntries(p)
    if (real) {
      real.forEach(({ round, date, verified }) => {
        addDeadline(monthNameFromIsoDate(date), {
          slug: deadlineTaskSlug(p.id),
          programSlug: p.id,
          date,
          verified,
          label: `${p.name} — ${ROUND_LABELS[round] || round} deadline${verified ? '' : ' (self-reported)'}`,
        })
      })
      return
    }

    // No real data for this program yet — fall back to the original
    // tier-based estimate, now labeled + flagged as such so the UI can
    // offer "set the real date" instead of presenting a guess as fact.
    if (p.tier === 'Reach') {
      const year = calendarYear('November', profile.gradYear)
      addDeadline('November', {
        slug: deadlineTaskSlug(p.id),
        programSlug: p.id,
        date: year ? `${year}-11-01` : null,
        verified: false,
        label: `${p.name} — Early Action/Decision deadline (estimated)`,
      })
    } else if (p.tier === 'Target' || p.tier === 'Safety') {
      const year = calendarYear('January', profile.gradYear)
      addDeadline('January', {
        slug: deadlineTaskSlug(p.id),
        programSlug: p.id,
        date: year ? `${year}-01-01` : null,
        verified: false,
        label: `${p.name} — Regular Decision deadline (estimated)`,
      })
    }
  })

  return TIMELINE.map((m) => ({
    ...m,
    year: calendarYear(m.month, profile.gradYear),
    hardDeadlines: (hardDeadlinesByMonth[m.month] || []).sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    studentTasks: m.studentTasks.map((text) => ({ slug: systemTaskSlug(m.month, 'student', text), text })),
    parentTasks: m.parentTasks.map((text) => ({ slug: systemTaskSlug(m.month, 'parent', text), text })),
  }))
}
