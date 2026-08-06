// Demo profile for the "Try a sample profile" first-run shortcut (Profile.jsx).
// Values are realistic enough to produce a meaningful Reach/Target/Safety spread
// and non-empty Programs/Hidden Gems/Scholarships/Gap Analysis pages, so a
// brand-new visitor can explore the full app before entering their own data.
//
// `_sample: true` marks this as demo data (not a real saved profile) — Profile.jsx
// shows a banner while it's active, and any real "Save Profile" strips the flag.
export const SAMPLE_PROFILE = {
  _sample: true,

  studentName: 'Jordan Rivera',
  gpaWeighted: '4.3',
  gpaUnweighted: '3.85',
  classRank: '42',
  classSize: '410',
  highSchoolName: 'Lincoln High School',
  counselorName: 'Ms. Patel',
  counselorEmail: 'patel@lincolnhs.edu',
  apCourses: 'AP Calculus BC, AP Chemistry, AP US History, AP English Language',
  ibCourses: '',
  honorsCourses: 'Honors Physics, Honors Spanish III',
  extracurriculars: 'Varsity swim team (captain, 2 years), Robotics club (lead programmer), Student Government treasurer',
  awards: 'National Merit Commended Scholar, 1st place regional science fair (2025)',
  notes: 'Exploring engineering vs. computer science — leaning CS after robotics club.',

  gradeLevel: '12',
  gradYear: '2027',
  targetCountries: ['United States'],
  targetStates: ['CA', 'MA', 'NY', 'WA'],
  typePreference: 'No preference',
  budgetSensitivity: 'Medium',
  settingPreference: 'Suburban',
  sizePreference: 'Medium',
  satTotal: '1420',
  actComposite: '',
  plannedCourses: 'AP Physics C, AP Computer Science A',
  intendedMajors: ['Computer Science', 'Engineering'],
  activities: [],
  essays: [],
  counselorCollegeList: [],
  documents: [],

  homeState: 'CA',
  homeCity: 'Sacramento',
  householdIncomeRange: '',
  firstGen: false,
  sports: 'Varsity swimming',
  religionCulture: '',
  ethnicity: '',
  languages: 'Spanish',
  volunteerWork: 'Weekend volunteer swim coach for a youth rec league (1 year)',
  workExperience: 'Part-time tutor, algebra and geometry (school year)',
  certifications: '',
  specialCircumstances: [],
}
