// Small link-building helpers that are not part of the deterministic
// recommendation engine (lib/engine/*.js) — these don't touch the student
// profile or classification data, they just turn an already-fetched
// college/program row into an external URL.
//
// There is no "official program page" URL anywhere in the data model
// (backend/app/models/college.py has no such field on College or Program,
// and neither the curated seed nor the Scorecard import populate one) — see
// collegepath-master-prompt-spec.md for the full data contract. Rather than
// invent/guess a direct link (which would silently 404 or land on the wrong
// page for many schools), this builds a search-engine query URL instead.
// That always resolves to something useful and needs no new data source.

// `program` only needs `name` (the college name — see
// backend/app/routers/colleges.py's `serialize_program`, which sets
// `ProgramOut.name = college.name`, not the program/department name) and
// `dept` (the department/program name). Both are present on every row
// returned by GET /api/colleges, curated or Scorecard-imported alike.
export function buildProgramSearchUrl(program) {
  const parts = [program?.name, program?.dept, 'program'].filter(Boolean)
  const query = parts.join(' ')
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}
