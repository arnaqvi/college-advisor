// Spec 3.4 — Program Alignment. Cross-references the student's taken +
// planned courses against a program's recommended prerequisites.
import { parseCourseList } from './profileUtils.js'

export function alignProgram(profile, program) {
  const taken = [
    ...parseCourseList(profile.apCourses),
    ...parseCourseList(profile.ibCourses),
    ...parseCourseList(profile.honorsCourses),
  ]
  const planned = parseCourseList(profile.plannedCourses)
  const allCourses = [...taken, ...planned].map((c) => c.toLowerCase())

  const recommended = program.recommendedCourses || []
  const satisfiedCourses = recommended.filter((rc) => allCourses.includes(rc.toLowerCase()))
  const gapCourses = recommended.filter((rc) => !satisfiedCourses.includes(rc))

  let note
  if (recommended.length === 0) {
    note = 'No specific prerequisite courses listed for this program.'
  } else if (gapCourses.length === 0) {
    note = `Your coursework satisfies all of ${program.dept}'s recommended preparation.`
  } else {
    note = `Consider adding: ${gapCourses.join(', ')} to strengthen your ${program.dept} application.`
  }

  return { programId: program.id, satisfiedCourses, gapCourses, note }
}
