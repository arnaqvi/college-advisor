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
  const classifiedPrograms = classifyAllPrograms(studentProfile, colleges)

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
