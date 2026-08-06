// Spec 3.5 — Hidden Gem Discovery. Surfaces well-fitting, realistically
// admittable programs that aren't already "brand name" schools, across the
// FULL college/program catalog (curated seed + College Scorecard imports —
// see lib/api/colleges.js), not just the small hand-curated subset. A
// hand-written `gemProfile` (overlookedReason/angle text — richer copy,
// written for ~11 of the original curated schools, see
// backend/app/migrations/seed_colleges.py) is preferred verbatim when
// present; every other eligible program gets deterministic, data-driven
// text composed only from fields already on the record (ranking, admitRate,
// tier, size, type, state, dept) — never LLM-generated, so it's free and
// instant for all ~213+ programs and never invents a stat the API didn't
// send.
//
// Two independent eligibility PATHWAYS feed one merged, deduped list
// (findHiddenGems below) — a program qualifies if it clears EITHER:
//
//   PATHWAY A — "overlooked college": the school itself isn't a widely-known
//   name (see isOverlookedCollegeCandidate).
//   PATHWAY B — "niche program at a selective college" (2026-08-05, added on
//   direct product-owner instruction): a comparatively easy-to-get-into
//   program tucked inside an otherwise selective/well-known college — e.g. a
//   less-crowded major at a prestigious school that's easier to get into
//   than that school's flagship. See isNicheProgramCandidate below for the
//   full heuristic and its data-grounded thresholds. There is NO
//   applicant-volume/popularity data anywhere in this DB (checked
//   backend/app/models/college.py) — pathway B is built entirely from
//   proxies (admit-rate gap + category difference), by explicit
//   product-owner direction, not from any real "niche-ness" signal.
//
// Both pathways share the same tier gate (below) and the same
// preference-hand-written-copy-first rule.
//
// PATHWAY A ELIGIBILITY HEURISTIC (product judgment call — reasoning below):
//   1. `tier` is 'Target' or 'Safety' (from classification.js, already
//      computed per student/program — reused here, not recomputed). A
//      "hidden gem" has to be a realistically achievable option for THIS
//      student; a Reach is a stretch regardless of how underrated it is,
//      and 'Incomplete' means there's no basis to judge fit at all yet.
//   2. NOT an obvious "brand name" program:
//        - `ranking` is absent (null) — true for every Scorecard-imported
//          program (Scorecard has no ranking concept at all, see
//          scorecard_sync.py's module docstring) as well as any manually
//          curated program nobody has hand-ranked yet. No ranking data is
//          itself a reasonable "not a widely-known name" signal here.
//        - OR `ranking` IS present but falls outside GEM_RANKING_THRESHOLD.
//          Threshold picked at 40: the tightest-ranked school among the
//          original 11 hand-written gems is Case Western at #42, so 40
//          keeps every existing hand-curated gem eligible under the new
//          rule while still excluding obviously top-tier "everyone's heard
//          of it" programs (Stanford #3, Georgia Tech #8, UT Austin CS #10,
//          etc.) from ever being called "overlooked."
//   Both gates apply uniformly to EVERY program, including the 11
//   hand-curated ones — a hand-written gem whose tier is Reach for a given
//   student no longer shows up as a "great overlooked fit" for them, which
//   is more honest than the old blanket "any tier but Incomplete" rule.
const GEM_RANKING_THRESHOLD = 40

// PATHWAY B THRESHOLDS — grounded against the real catalog data available in
// this DB (a scratchpad-DB verification session on 2026-08-05: 35 curated
// seed programs + 75 real College Scorecard imports, 110 programs total, one
// real school — Babson College — actually Scorecard-synced at the College
// level while also carrying a manual Program-level admit-rate override, the
// only live data point available to check either number against):
//
//   SELECTIVE_COLLEGE_ADMIT_RATE — "college is good" via admit rate alone.
//   The full catalog's admit-rate distribution has p25 ≈ 0.267, median ≈
//   0.552 (imported state-school admit rates skew the median high). 0.25 is
//   picked just under that observed 25th percentile — "meaningfully more
//   selective than 3 out of 4 schools in our own directory" — and sits
//   between classification.js's existing `< 0.15` auto-Reach cutoff (too
//   extreme — a college doesn't need lottery odds to be "good") and its
//   `> 0.5` Safety cutoff (the catalog median — clearly not selective).
//
//   NICHE_ADMIT_RATE_RATIO — how much higher a program's own admit rate must
//   be than its college's raw admit_rate_overall to count as "notably
//   higher." A ratio, not a flat percentage-point gap, because pathway B
//   only ever evaluates already-selective colleges (gated by
//   SELECTIVE_COLLEGE_ADMIT_RATE or GEM_RANKING_THRESHOLD above) where the
//   college-wide baseline is itself small (typically <25%) — a fixed pp gap
//   would either be too strict at a 5% baseline or too loose at a 22%
//   baseline, while a multiplier scales correctly either way. 1.5x is the
//   smallest clean threshold that still correctly EXCLUDES the one real
//   Scorecard-synced comparison this catalog has: Babson College's manually
//   curated Business program admits 22% vs its real Scorecard-synced
//   college-wide 17.09% — only a 1.29x ratio, and Babson has just that one
//   tracked program anyway (so it's excluded regardless by the
//   dominant-category check below; the ratio choice doesn't contradict the
//   one live data point we could check it against).
const SELECTIVE_COLLEGE_ADMIT_RATE = 0.25
const NICHE_ADMIT_RATE_RATIO = 1.5

function isOverlookedCollegeCandidate(program) {
  if (program.tier !== 'Target' && program.tier !== 'Safety') return false
  const { ranking } = program
  if (ranking == null) return true
  return ranking > GEM_RANKING_THRESHOLD
}

// Per-college aggregates used only by pathway B — built once per
// findHiddenGems() call from the FULL classified catalog (every program at
// every college we track, regardless of tier), so "this college's dominant
// category" and "does this college have a strongly-ranked program"
// correctly reflect the whole roster, not just the subset that happens to
// be Target/Safety for one student.
//
// Grouped by `program.name` (== the parent College's name in every API
// response — see backend/app/routers/colleges.py's serialize_program). Not
// a true foreign key, but it's the only college identity the frontend has,
// and matches the convention already used elsewhere in this file.
function buildCollegeIndex(allPrograms) {
  const byCollege = new Map()
  for (const program of allPrograms) {
    if (!byCollege.has(program.name)) byCollege.set(program.name, [])
    byCollege.get(program.name).push(program)
  }

  const index = new Map()
  for (const [name, programs] of byCollege) {
    // Raw, un-merged college-wide admit rate (see the new
    // `collegeAdmitRateOverall` API field) — identical across every sibling
    // program at the same college, so just take the first non-null value.
    const collegeAdmitRateOverall =
      programs.find((p) => typeof p.collegeAdmitRateOverall === 'number')?.collegeAdmitRateOverall ?? null

    const hasStronglyRankedProgram = programs.some(
      (p) => typeof p.ranking === 'number' && p.ranking <= GEM_RANKING_THRESHOLD
    )

    // Dominant category: the category that appears most often among this
    // college's OWN tracked programs. Ties broken by the category of
    // whichever tied program has the best (lowest, non-null) `ranking` — a
    // college's "flagship" identity is more about its most prestigious
    // program than an arbitrary pick — falling back to alphabetical order
    // for a fully-null-ranking tie, for a stable, deterministic result.
    const counts = new Map()
    for (const p of programs) counts.set(p.category, (counts.get(p.category) ?? 0) + 1)
    const maxCount = Math.max(...counts.values())
    const tied = [...counts.keys()].filter((c) => counts.get(c) === maxCount).sort()
    let dominantCategory = tied[0]
    if (tied.length > 1) {
      let bestRanking = Infinity
      for (const category of tied) {
        const best = Math.min(
          ...programs.filter((p) => p.category === category && typeof p.ranking === 'number').map((p) => p.ranking),
          Infinity
        )
        if (best < bestRanking) {
          bestRanking = best
          dominantCategory = category
        }
      }
    }

    index.set(name, { collegeAdmitRateOverall, hasStronglyRankedProgram, dominantCategory })
  }
  return index
}

// PATHWAY B — "niche program at a selective college" (see thresholds above).
// ALL of the following must hold:
//   1. Tier gate — same as pathway A (Target/Safety only). This is the
//      mechanism doing the real work: a niche program's own higher admit
//      rate already feeds classifyProgram() in classification.js, so it can
//      independently land Target/Safety for a student even when the
//      college's flagship programs would classify that same student Reach.
//   2. The COLLEGE is "good": either its raw admit_rate_overall is under
//      SELECTIVE_COLLEGE_ADMIT_RATE, or it has at least one tracked program
//      ranked <= GEM_RANKING_THRESHOLD (reusing pathway A's "nationally
//      ranked" bar) — either signal alone is enough per spec.
//   3. THIS program is a niche pick relative to that college: its own admit
//      rate is at least NICHE_ADMIT_RATE_RATIO times the college's raw
//      admit_rate_overall (both must be present — a college that has never
//      been Scorecard-synced has no basis for this comparison at all, so
//      such programs simply aren't eligible via this pathway, per explicit
//      product-owner direction), AND its category differs from the
//      college's dominant category (so a college with only one tracked
//      program can never qualify via pathway B — there's no "flagship" to
//      be niche relative to, which is the correct, honest behavior given
//      this catalog's current shape: only one college in it,
//      "University of Texas at Austin," has more than one tracked program
//      today).
function isNicheProgramCandidate(program, collegeIndex) {
  if (program.tier !== 'Target' && program.tier !== 'Safety') return false

  const collegeInfo = collegeIndex.get(program.name)
  if (!collegeInfo) return false
  const { collegeAdmitRateOverall, hasStronglyRankedProgram, dominantCategory } = collegeInfo

  if (collegeAdmitRateOverall == null || collegeAdmitRateOverall <= 0) return false
  if (typeof program.admitRate !== 'number') return false

  const collegeIsGood = collegeAdmitRateOverall < SELECTIVE_COLLEGE_ADMIT_RATE || hasStronglyRankedProgram
  if (!collegeIsGood) return false

  const isNicheRate = program.admitRate >= collegeAdmitRateOverall * NICHE_ADMIT_RATE_RATIO
  const isDifferentCategory = dominantCategory != null && program.category !== dominantCategory
  return isNicheRate && isDifferentCategory
}

// Which pathway (if either) a program qualifies for. Pathway A is checked
// first — cheaper, and a program that clears both is more naturally
// described as "the school itself is overlooked" (pathway A's framing)
// than "niche within its own school" (pathway B only makes sense when the
// college ISN'T the overlooked part).
function classifyGemPathway(program, collegeIndex) {
  if (isOverlookedCollegeCandidate(program)) return 'overlooked-college'
  if (isNicheProgramCandidate(program, collegeIndex)) return 'niche-program'
  return null
}

function pct(rate) {
  return typeof rate === 'number' ? Math.round(rate * 100) : null
}

// "a"/"an" for a spoken percentage (e.g. "an 85% admit rate", "a 42% admit
// rate") — the numbers that read as starting with a vowel sound are 8,
// 11, 18, and 80-89 ("eight(y)...", "eleven", "eighteen").
function articleFor(n) {
  return n === 8 || n === 11 || n === 18 || (n >= 80 && n <= 89) ? 'an' : 'a'
}

// Deterministic "why overlooked" text for programs with no hand-written
// gemProfile. Composed only from fields the API actually serializes (see
// backend/app/schemas/college.py's ProgramOut) — every branch is guarded so
// a missing field (common on Scorecard imports: no ranking, "General
// Admission" dept) degrades to a still-readable sentence instead of
// "undefined"/"null" leaking into the copy.
function buildOverlookedReason(program) {
  const { dept, ranking, admitRate, size, type, state } = program
  const deptLabel = dept && dept !== 'General Admission' ? dept : null
  const admitPct = pct(admitRate)
  const sizeType = [size, type].filter(Boolean).join(' ').toLowerCase()

  const overshadow =
    ranking != null
      ? `Ranked #${ranking} nationally${deptLabel ? ` in ${deptLabel}` : ''} — well outside the handful of names most students default to`
      : sizeType
        ? `A ${sizeType} school${state ? ` in ${state}` : ''} with no big national ranking to trade on`
        : `A school with no big national ranking to trade on`

  const signal =
    admitPct != null
      ? admitPct >= 40
        ? `${articleFor(admitPct)} ${admitPct}% admit rate reads as low prestige, but that's more about visibility than outcomes${deptLabel ? ` in ${deptLabel}` : ''}`
        : `it still admits ${admitPct}% of applicants with solid outcomes for a school this under-the-radar`
      : `it's easy to overlook next to bigger names, even though it lines up well with your profile`

  return `${overshadow}, so ${signal}.`
}

// Deterministic "why overlooked" text for pathway B (niche program at an
// otherwise selective/well-known college) — distinct from buildOverlookedReason
// above because the framing is the opposite: the COLLEGE is not the
// overlooked part here, this specific program is. `collegeInfo` is this
// program's entry from buildCollegeIndex(); guaranteed by the caller
// (isNicheProgramCandidate already required these fields) to have both
// admit rates and a dominantCategory, so no null-guarding needed on those —
// only `dept` (Program.dept is a required, always-present API field, but the
// "General Admission" degenerate value still needs the same guard used
// throughout this file).
function buildNicheOverlookedReason(program, collegeInfo) {
  const { dept, name, admitRate } = program
  const { collegeAdmitRateOverall, dominantCategory } = collegeInfo
  const deptLabel = dept && dept !== 'General Admission' ? dept : 'this program'
  const programPct = pct(admitRate)
  const collegePct = pct(collegeAdmitRateOverall)
  const ratio = admitRate / collegeAdmitRateOverall
  // One decimal place is enough precision for a "roughly Nx" framing —
  // matches how a student would actually talk about this, not a stat sheet.
  const ratioLabel = `${ratio.toFixed(1)}x`

  return `Overshadowed by ${name}'s well-known ${dominantCategory} programs, but ${deptLabel} admits notably more applicants — roughly ${ratioLabel} the rate (${programPct}% vs ${collegePct}% for the school overall).`
}

// Deterministic "angle" (application-strategy) text — same guard rules as
// buildOverlookedReason above.
function buildAngle(program) {
  const { dept, size } = program
  const deptLabel = dept && dept !== 'General Admission' ? dept : 'your intended area of study'
  const settingClause =
    size === 'Small'
      ? "the kind of small-cohort, hands-on attention bigger schools can't offer"
      : size === 'Large'
        ? 'the breadth of resources a larger school can offer once you look past its name recognition'
        : 'opportunities that are easy to miss from the outside'
  return `Emphasize your interest in ${deptLabel} and ${settingClause}.`
}

function buildWhyFits(program) {
  const { dept, tier } = program
  const deptLabel = dept && dept !== 'General Admission' ? ` in ${dept}` : ''
  return `Fits your profile${deptLabel} with a ${tier.toLowerCase()}-tier likelihood of admission.`
}

export function findHiddenGems(profile, classifiedPrograms) {
  const collegeIndex = buildCollegeIndex(classifiedPrograms)

  return classifiedPrograms
    .map((p) => ({ program: p, pathway: classifyGemPathway(p, collegeIndex) }))
    .filter(({ pathway }) => pathway !== null)
    .map(({ program: p, pathway }) => ({
      ...p,
      // Not rendered by HiddenGems.jsx today — kept on the record for
      // transparency/debugging (e.g. distinguishing the two pathways in a
      // future UI) without requiring a second lookup against collegeIndex.
      gemPathway: pathway,
      whyOverlooked:
        p.gemProfile?.overlookedReason ??
        (pathway === 'niche-program' ? buildNicheOverlookedReason(p, collegeIndex.get(p.name)) : buildOverlookedReason(p)),
      whyFits: buildWhyFits(p),
      angle: p.gemProfile?.angle ?? buildAngle(p),
    }))
    // Best fit first, uncapped (spec 3.5 — no top-5 cap; fitScore is the
    // same per-student ranking signal the College List uses, reused rather
    // than recomputed — see classification.js). Ties broken alphabetically
    // for a stable, deterministic order.
    .sort((a, b) => b.fitScore - a.fitScore || a.name.localeCompare(b.name))
}
