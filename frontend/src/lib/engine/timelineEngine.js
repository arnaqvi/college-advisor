// Spec 3.7 — Month-by-Month Timeline. Personalizes the static month/task
// skeleton with the student's graduation year and hard deadlines derived
// from their actual classified program list.
import { TIMELINE } from '../../data/timeline.js'
import { parseNumber } from './profileUtils.js'

const FALL_MONTHS = new Set(['September', 'October', 'November', 'December'])

function calendarYear(month, gradYear) {
  const year = parseNumber(gradYear)
  if (year === null) return null
  return FALL_MONTHS.has(month) ? year - 1 : year
}

export function buildTimeline(profile, classifiedPrograms) {
  return TIMELINE.map((m) => {
    const year = calendarYear(m.month, profile.gradYear)
    const hardDeadlines = []

    if (m.month === 'November') {
      classifiedPrograms
        .filter((p) => p.tier === 'Reach')
        .forEach((p) =>
          hardDeadlines.push({
            date: year ? `${year}-11-01` : null,
            label: `${p.name} — Early Action/Decision deadline`,
          })
        )
    }
    if (m.month === 'January') {
      classifiedPrograms
        .filter((p) => p.tier === 'Target' || p.tier === 'Safety')
        .forEach((p) =>
          hardDeadlines.push({
            date: year ? `${year}-01-01` : null,
            label: `${p.name} — Regular Decision deadline`,
          })
        )
    }

    return { ...m, year, hardDeadlines }
  })
}
