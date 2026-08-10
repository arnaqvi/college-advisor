// Orchestrates the deterministic engine modules (lib/engine/*.js) into one
// derived-plan object per collegepath-master-prompt-spec.md Section 4's
// output contract. Called from AppContext.jsx whenever the profile or the
// (backend-fetched, see lib/api/colleges.js) college list changes.
import { classifyAllPrograms } from './engine/classification.js'
import { segmentByTypeAndState } from './engine/segmentation.js'
import { alignProgram } from './engine/programAlignment.js'
import { findHiddenGems } from './engine/hiddenGems.js'
import { analyzeActivityGaps } from './engine/ecGapAnalysis.js'
import { buildTimeline } from './engine/timelineEngine.js'
import { buildStrategy } from './engine/perProgramStrategy.js'
import { deriveEssayStatus } from './engine/essayTracker.js'
import { checkCounselorBias } from './engine/counselorBiasCheck.js'
import { gapAnalysisForCollege } from './engine/benchmarkGapAnalysis.js'
import { buildSnapshot } from './engine/snapshot.js'

export function generatePlan(studentProfile, { colleges = [] } = {}) {
  // Sorted here, once, at the source — every page below (Programs, Strategy,
  // Gap Analysis, Counselor Bias Check's suggestions) either maps this array
  // directly or filters/slices it without its own re-sort, so without this
  // they all silently fell back to raw backend array order — i.e. seed-file
  // order, which is why the same handful of schools (whichever were seeded
  // first) always appeared first regardless of the student's actual profile.
  // fitScore is the same per-student ranking signal CollegeDirectory.jsx and
  // hiddenGems.js already use; CollegeDirectory re-sorts its own filtered
  // view anyway, so this doesn't change its behavior, only the pages that
  // had no sort of their own.
  const classifiedPrograms = classifyAllPrograms(studentProfile, colleges).sort(
    (a, b) => b.fitScore - a.fitScore || a.name.localeCompare(b.name)
  )

  const programDeepDive = classifiedPrograms.map((program) => ({
    ...program,
    alignment: alignProgram(studentProfile, program),
  }))

  return {
    generatedAt: new Date().toISOString(),
    snapshot: buildSnapshot(studentProfile, classifiedPrograms),
    collegeList: segmentByTypeAndState(classifiedPrograms, studentProfile),
    programDeepDive,
    hiddenGems: findHiddenGems(studentProfile, classifiedPrograms),
    ecRecommendations: analyzeActivityGaps(studentProfile, classifiedPrograms),
    roadmap: buildTimeline(studentProfile, classifiedPrograms),
    perProgramStrategy: programDeepDive.map((p) => buildStrategy(studentProfile, p, p.alignment)),
    essayTracker: deriveEssayStatus(studentProfile),
    comparisonShortlist: classifiedPrograms.filter((p) => p.tier !== 'Incomplete'),
    counselorBiasCheck: checkCounselorBias(studentProfile, classifiedPrograms),
    gapAnalysis: classifiedPrograms.map((program) => gapAnalysisForCollege(studentProfile, program)),
    classifiedPrograms,
  }
}
