// Spec-derived business rules that are NOT per-college data — deliberately
// kept separate from the backend-sourced college directory (see
// lib/api/colleges.js) so this file has no dependency on the data source.
// Was previously exported from data/colleges.js (a static per-college
// fixture); moved here when that fixture was removed as the runtime
// calculation's data source (see CollegeDirectory/classification refactor).

// Departments the spec treats as competitive enough to weight toward "Reach"
// even when a student's stats land inside the school's admit band (3.1).
export const HIGHLY_COMPETITIVE_DEPTS = ['Computer Science', 'Business']
