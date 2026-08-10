// collegepath-master-prompt-spec.md Section 3.1 — College Classification Engine.
// Reach/Target/Safety is computed per PROGRAM (not per university) from the
// student's GPA/SAT/ACT against that program's admitted-student percentile
// bands (sourced from the backend college directory — see lib/api/colleges.js),
// plus its admit rate and whether its department is nationally competitive
// (see HIGHLY_COMPETITIVE_DEPTS in ./constants.js — a business rule, not
// per-college data, so it stays independent of the data source).
//
// ROBUSTNESS (2026-08-03): schools imported from the College Scorecard API
// carry real SAT/ACT bands + an admit rate but NO GPA band (the source does
// not publish GPA percentiles, and the spec forbids fabricating one). Every
// band read below is now guarded, so an imported school classifies on whatever
// signals it DOES have (test scores, else admit rate) instead of crashing on a
// missing `gpaBand`/`satBand`.
import { HIGHLY_COMPETITIVE_DEPTS } from './constants.js'
import { parseNumber } from './profileUtils.js'

// Midpoint of a {p25,p75} band, or null when the band is absent/degenerate.
function bandMid(band) {
  if (!band || typeof band.p25 !== 'number' || typeof band.p75 !== 'number') return null
  return (band.p25 + band.p75) / 2
}

function hasBand(band) {
  return band && typeof band.p25 === 'number' && typeof band.p75 === 'number'
}

export function classifyProgram(profile, program) {
  // Unweighted GPA is used for classification — it's conventionally always
  // out of 4.0, unlike weighted GPA (which varies by school), so it's the only
  // one comparable against program.gpaBand.
  const gpa = parseNumber(profile.gpaUnweighted)
  const sat = parseNumber(profile.satTotal)
  const act = parseNumber(profile.actComposite)

  // No student stats at all — the STUDENT (not the data) is incomplete.
  if (gpa === null && sat === null && act === null) {
    return {
      tier: 'Incomplete',
      reason: 'Add your GPA and test scores in Profile to see a classification.',
      fitScore: 0,
    }
  }

  const gpaBand = program.gpaBand
  const satBand = program.satBand
  const actBand = program.actBand
  const admitRate = typeof program.admitRate === 'number' ? program.admitRate : null

  // GPA signal only when BOTH the student's GPA and the program's GPA band
  // exist. Imported (Scorecard) schools have no gpaBand — they skip this.
  const normalizedGpa =
    gpa !== null && gpaBand && typeof gpaBand.scale === 'number' ? (gpa / 4.0) * gpaBand.scale : null

  const signals = []
  if (normalizedGpa !== null) {
    signals.push(normalizedGpa < gpaBand.p25 ? 'below' : normalizedGpa > gpaBand.p75 ? 'above' : 'within')
  }
  // Prefer SAT when present; fall back to ACT. Each only fires when the program
  // actually publishes that band (test-optional / imported schools may not).
  if (sat !== null && hasBand(satBand)) {
    signals.push(sat < satBand.p25 ? 'below' : sat > satBand.p75 ? 'above' : 'within')
  } else if (act !== null && hasBand(actBand)) {
    signals.push(act < actBand.p25 ? 'below' : act > actBand.p75 ? 'above' : 'within')
  }

  const belowCount = signals.filter((s) => s === 'below').length
  const aboveCount = signals.filter((s) => s === 'above').length
  const isHighlyCompetitive = HIGHLY_COMPETITIVE_DEPTS.includes(program.dept)

  let result
  if (belowCount > 0) {
    result = {
      tier: 'Reach',
      reason: "Your GPA and/or test scores fall below this program's typical admitted range.",
    }
  } else if (admitRate !== null && admitRate < 0.15) {
    result = {
      tier: 'Reach',
      reason: `This program's admit rate (${Math.round(admitRate * 100)}%) makes admission uncertain regardless of stats.`,
    }
  } else if (isHighlyCompetitive && signals.length > 0 && aboveCount < signals.length) {
    result = {
      tier: 'Reach',
      reason: `${program.dept} is a highly competitive field nationally, so admission stays uncertain within the typical admitted range.`,
    }
  } else if (
    signals.length > 0 &&
    aboveCount === signals.length &&
    admitRate !== null &&
    admitRate > 0.5 &&
    !isHighlyCompetitive
  ) {
    result = {
      tier: 'Safety',
      reason: "Your GPA and test scores are above this program's typical admitted range, and it admits over half of applicants.",
    }
  } else if (signals.length === 0) {
    // No comparable test/GPA bands (an imported test-optional school). Classify
    // on selectivity alone when known; otherwise show a neutral, honest match.
    if (admitRate === null) {
      result = {
        tier: 'Target',
        reason: 'Limited published data for this school — shown as a neutral match; verify details against the school directly.',
      }
    } else if (admitRate < 0.15) {
      result = { tier: 'Reach', reason: `This school's admit rate (${Math.round(admitRate * 100)}%) makes admission uncertain.` }
    } else if (admitRate > 0.5) {
      result = { tier: 'Safety', reason: `This school admits over half of applicants (${Math.round(admitRate * 100)}%).` }
    } else {
      result = { tier: 'Target', reason: `This school's admit rate (${Math.round(admitRate * 100)}%) is competitive but attainable.` }
    }
  } else {
    result = {
      tier: 'Target',
      reason: "Your GPA and test scores fall within this program's typical admitted range.",
    }
  }

  result.fitScore = computeFitScore(profile, program, result.tier, { sat, act, satBand, actBand })
  return result
}

// A 0..1 "how good a match for THIS student" score used to RANK the College
// List so it re-orders whenever the profile changes (Spec 4 personalization).
// Deterministic and cheap. Five terms, all profile-dependent:
//   - Tier is dominant: a balanced list surfaces Targets first, then Safeties,
//     then Reaches, Incomplete last.
//   - Closeness: within a tier, schools whose published test band sits closest
//     to the student's own score rank higher (a tighter academic fit).
//   - Preference: a boost when the school is in a state the student is targeting.
//   - Major interest: a boost when the program's own dept matches one of the
//     student's stated intended majors (added 2026-08-10 — profile.intendedMajors
//     already existed and was collected but never used anywhere in scoring).
//   - Rigor: a smaller boost, only for HIGHLY_COMPETITIVE_DEPTS programs, when
//     the student has logged meaningful AP coursework — rigor matters most
//     exactly where competitiveness already does, not as a blanket boost.
//     profile.activities (extracurriculars) was considered too but left out of
//     scoring on purpose: it's a structured array with no real UI anywhere in
//     Profile.jsx to populate it (only an orphaned, unwired onboarding wizard
//     ever wrote to it — see college_advisor_onboarding_backlog memory), so
//     it's empty for effectively every real user today; scoring against a
//     field nobody can actually fill in would be pointless.
function computeFitScore(profile, program, tier, ctx) {
  const TIER_BASE = { Target: 0.7, Safety: 0.55, Reach: 0.4, Incomplete: 0 }
  let score = TIER_BASE[tier] ?? 0.4

  // Closeness of the student's score to the program's test-band midpoint.
  // ACT is rescaled to an SAT-comparable range (x44 ≈ concordance) so ACT-only
  // students still get closeness ranking; used for ORDERING only, never shown.
  const studentScore = ctx.sat ?? (ctx.act != null ? ctx.act * 44 : null)
  const band = hasBand(ctx.satBand)
    ? ctx.satBand
    : hasBand(ctx.actBand)
      ? { p25: ctx.actBand.p25 * 44, p75: ctx.actBand.p75 * 44 }
      : null
  const mid = bandMid(band)
  if (studentScore != null && mid != null) {
    const spread = Math.max(80, band.p75 - band.p25) // guard divide-by-zero / over-reward
    const closeness = Math.max(0, 1 - Math.abs(studentScore - mid) / (spread * 2))
    score += 0.15 * closeness
  }

  // Preference boost: student is targeting this school's state.
  const targetStates = Array.isArray(profile.targetStates) ? profile.targetStates : []
  if (program.state && targetStates.includes(program.state)) score += 0.15

  // Major interest boost: this program's dept matches a stated intended major.
  const intendedMajors = Array.isArray(profile.intendedMajors) ? profile.intendedMajors : []
  if (
    program.dept &&
    intendedMajors.some((major) => major.trim().toLowerCase() === program.dept.trim().toLowerCase())
  ) {
    score += 0.15
  }

  // Rigor boost: >=3 logged AP courses (comma-separated free text, see
  // Profile.jsx's "AP Calc BC, AP Bio, AP Lit" placeholder), only for programs
  // in departments already flagged nationally competitive.
  const apCourseCount =
    typeof profile.apCourses === 'string'
      ? profile.apCourses.split(',').map((c) => c.trim()).filter(Boolean).length
      : 0
  if (apCourseCount >= 3 && HIGHLY_COMPETITIVE_DEPTS.includes(program.dept)) {
    score += 0.1
  }

  return Math.min(1, score)
}

export function classifyAllPrograms(profile, programs) {
  return programs.map((program) => ({ ...program, ...classifyProgram(profile, program) }))
}
