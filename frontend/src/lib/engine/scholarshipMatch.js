// Pure rules-engine module for scholarship matching — same shape as
// classification.js's college Reach/Target/Safety scoring, applied to
// frontend/src/data/scholarships.js instead of the college directory.
//
// Each scholarship's `criteria` object only lists dimensions it actually
// restricts on (see scholarships.js for the full list). For every criterion,
// the student's profile is checked and comes back as one of:
//   'met'     — profile satisfies the criterion
//   'unmet'   — profile has the relevant data and it doesn't satisfy it
//   'unknown' — profile hasn't filled in the relevant field yet
// `unknown` counts against matchPercent the same as `unmet` (a scholarship
// can't be scored as a good match on data we don't have), but is reported
// separately so the UI can nudge "fill this in" rather than "you don't
// qualify".

import { INCOME_RANGE_OPTIONS } from '../../data/collegePreferenceOptions.js'

// Index 0 of INCOME_RANGE_OPTIONS is "Prefer not to say" — not a real tier,
// so income-based criteria compare against the tiers only.
const INCOME_TIERS = INCOME_RANGE_OPTIONS.slice(1)

function nonEmpty(value) {
  return typeof value === 'string' ? value.trim() !== '' : Boolean(value)
}

const EVALUATORS = {
  gradeLevels: (profile, allowed) => {
    if (!nonEmpty(profile.gradeLevel)) return 'unknown'
    return allowed.includes(profile.gradeLevel) ? 'met' : 'unmet'
  },
  minGpaUnweighted: (profile, min) => {
    const gpa = parseFloat(profile.gpaUnweighted || profile.gpaWeighted)
    if (Number.isNaN(gpa)) return 'unknown'
    return gpa >= min ? 'met' : 'unmet'
  },
  majors: (profile, allowed) => {
    const chosen = profile.intendedMajors || []
    if (chosen.length === 0) return 'unknown'
    return chosen.some((m) => allowed.includes(m)) ? 'met' : 'unmet'
  },
  states: (profile, allowed) => {
    if (!nonEmpty(profile.homeState)) return 'unknown'
    return allowed.includes(profile.homeState) ? 'met' : 'unmet'
  },
  ethnicityKeywords: (profile, keywords) => {
    const value = (profile.ethnicity || '').toLowerCase()
    if (!nonEmpty(value)) return 'unknown'
    return keywords.some((k) => value.includes(k)) ? 'met' : 'unmet'
  },
  religionKeywords: (profile, keywords) => {
    const value = (profile.religionCulture || '').toLowerCase()
    if (!nonEmpty(value)) return 'unknown'
    return keywords.some((k) => value.includes(k)) ? 'met' : 'unmet'
  },
  firstGenPreferred: (profile) => {
    if (!nonEmpty(profile.firstGen)) return 'unknown'
    return profile.firstGen === 'Yes' ? 'met' : 'unmet'
  },
  incomeMaxRangeIndex: (profile, maxIndex) => {
    const tierIndex = INCOME_TIERS.indexOf(profile.householdIncomeRange)
    if (tierIndex < 0) return 'unknown'
    return tierIndex <= maxIndex ? 'met' : 'unmet'
  },
  sportsRequired: (profile) => (nonEmpty(profile.sports) ? 'met' : 'unknown'),
  volunteerRequired: (profile) => (nonEmpty(profile.volunteerWork) ? 'met' : 'unknown'),
  certificationsRequired: (profile) => (nonEmpty(profile.certifications) ? 'met' : 'unknown'),
  specialCircumstances: (profile, allowed) => {
    const chosen = profile.specialCircumstances || []
    if (chosen.length === 0) return 'unknown'
    return chosen.some((c) => allowed.includes(c)) ? 'met' : 'unmet'
  },
  clubKeywords: (profile, keywords) => {
    const value = (profile.extracurriculars || '').toLowerCase()
    if (!nonEmpty(value)) return 'unknown'
    return keywords.some((k) => value.includes(k)) ? 'met' : 'unmet'
  },
}

const CRITERIA_LABELS = {
  gradeLevels: 'grade level',
  minGpaUnweighted: 'GPA',
  majors: 'intended major',
  states: 'home state',
  ethnicityKeywords: 'ethnicity/heritage',
  religionKeywords: 'religious/cultural background',
  firstGenPreferred: 'first-generation status',
  incomeMaxRangeIndex: 'household income',
  sportsRequired: 'sports involvement',
  volunteerRequired: 'volunteer experience',
  certificationsRequired: 'certifications',
  specialCircumstances: 'special circumstances',
  clubKeywords: 'club/activity involvement',
}

export function matchScholarships(profile, scholarships) {
  return scholarships.map((s) => {
    const criteria = s.criteria || {}
    const keys = Object.keys(criteria).filter((k) => k !== 'hardRequirement')
    const hardKeys = criteria.hardRequirement || []

    let met = 0
    const metCriteria = []
    const missingCriteria = []
    let hardFailed = false

    for (const key of keys) {
      const evaluator = EVALUATORS[key]
      if (!evaluator) continue
      const status = evaluator(profile, criteria[key])
      if (status === 'met') {
        met += 1
        metCriteria.push(key)
      } else {
        missingCriteria.push({ key, label: CRITERIA_LABELS[key] || key, reason: status })
        if (hardKeys.includes(key)) hardFailed = true
      }
    }

    const matchPercent = keys.length === 0 ? 100 : Math.round((met / keys.length) * 100)
    const matchTier = matchPercent >= 85 ? 'green' : matchPercent >= 70 ? 'amber' : 'red'

    return {
      ...s,
      matchPercent,
      matchTier,
      disqualified: hardFailed,
      metCriteria,
      missingCriteria,
      reasons: metCriteria.map((key) => `Matches your ${CRITERIA_LABELS[key] || key}`),
    }
  })
}

// Groups matched scholarships that share an essay theme — only themes with
// more than one scholarship count as a "cluster" worth writing once for.
export function buildEssayClusters(matched) {
  const groups = {}
  for (const s of matched) {
    if (!s.essayTheme) continue
    ;(groups[s.essayTheme] ||= []).push(s)
  }
  return Object.entries(groups)
    .filter(([, list]) => list.length > 1)
    .map(([theme, list]) => ({ theme, scholarships: list }))
}

// The profile fields scholarship matching relies on (see the 15-field
// spec this feature is built from) that are still empty — surfaced as the
// page's "Unlock More" section.
export const UNLOCK_FIELD_DEFS = [
  { key: 'homeState', label: 'Home state', why: 'Unlocks state-level scholarship guidance.' },
  { key: 'gpaUnweighted', label: 'GPA', why: 'Many merit scholarships require a minimum GPA.' },
  { key: 'householdIncomeRange', label: 'Household income range', why: 'Unlocks need-based scholarships.' },
  { key: 'firstGen', label: 'First-generation status', why: 'Several need-based programs prioritize first-gen students.' },
  { key: 'intendedMajors', label: 'Intended major', why: 'Unlocks major-specific scholarships.' },
  { key: 'extracurriculars', label: 'Extracurriculars & clubs', why: 'Unlocks club-sponsored scholarships (FBLA, NHS, Scouting, etc.).' },
  { key: 'sports', label: 'Sports played or coached', why: 'Unlocks athletic scholarships.' },
  { key: 'religionCulture', label: 'Religious / cultural background', why: 'Unlocks faith-based scholarships.' },
  { key: 'volunteerWork', label: 'Volunteer / community service', why: 'Unlocks community-service awards.' },
  { key: 'workExperience', label: 'Work / internship experience', why: 'Unlocks career/industry scholarships.' },
  { key: 'certifications', label: 'Certifications & skills', why: 'Unlocks certification-linked scholarships.' },
  { key: 'ethnicity', label: 'Ethnicity / heritage', why: 'Unlocks heritage-specific scholarships.' },
  { key: 'languages', label: 'Languages spoken', why: 'Some scholarships value multilingual applicants.' },
  {
    key: 'specialCircumstances',
    label: 'Special circumstances',
    why: 'Unlocks awards for military families, foster youth, disability, and immigrant students.',
  },
]

export function getUnlockFields(profile) {
  return UNLOCK_FIELD_DEFS.filter((f) => {
    const v = profile[f.key]
    return Array.isArray(v) ? v.length === 0 : !nonEmpty(v)
  })
}
