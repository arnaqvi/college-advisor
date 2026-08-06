// Option lists for the College Preferences multi-select fields in Profile.jsx.

// Includes the department names ecGapAnalysis.js's ACTIVITY_SUGGESTIONS_BY_DEPT
// keys on (Computer Science, Engineering, Business, Biology, Psychology,
// English, Visual Arts, Nursing) verbatim, plus other common intended majors.
export const MAJOR_OPTIONS = [
  'Computer Science',
  'Engineering',
  'Mechanical Engineering',
  'Electrical Engineering',
  'Business',
  'Economics',
  'Biology',
  'Chemistry',
  'Physics',
  'Mathematics',
  'Psychology',
  'Political Science',
  'History',
  'English',
  'Communications',
  'Education',
  'Nursing',
  'Pre-Med',
  'Visual Arts',
  'Music',
  'Architecture',
  'Environmental Science',
  'Sociology',
  'Undecided',
]

// value = 2-letter state code, matching college.state in the backend
// directory (see backend/app/migrations/seed_colleges.py) so
// segmentation.js's stateCoverageGaps matching keeps working.
export const US_STATE_OPTIONS = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
]

// The seeded college directory is US-only today (see college.py's `country`
// column comment), but this preference is forward-looking, so it offers
// common international study destinations too.
export const COUNTRY_OPTIONS = [
  'United States',
  'Canada',
  'United Kingdom',
  'Australia',
  'Ireland',
  'Germany',
  'Netherlands',
  'Singapore',
  'New Zealand',
  'Switzerland',
]

// Background & Eligibility fields — feed scholarshipMatch.js's need-based
// criteria (see lib/engine/scholarshipMatch.js). Ranges, not exact income,
// to keep this a low-friction single select.
export const INCOME_RANGE_OPTIONS = [
  'Prefer not to say',
  'Under $30,000',
  '$30,000–$60,000',
  '$60,000–$100,000',
  '$100,000–$150,000',
  'Over $150,000',
]

export const SPECIAL_CIRCUMSTANCE_OPTIONS = [
  { value: 'military-family', label: 'Military family' },
  { value: 'disability', label: 'Disability' },
  { value: 'immigrant', label: 'Immigrant / DACA status' },
  { value: 'foster-care', label: 'Foster care experience' },
  { value: 'other-adversity', label: 'Other significant adversity' },
]
