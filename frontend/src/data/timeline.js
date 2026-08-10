export const TIMELINE = [
  {
    month: 'September',
    studentTasks: [
      'Finalize reach/target/safety college list',
      'Request letters of recommendation',
      'Draft the Common App personal essay',
    ],
    parentTasks: ['Set up a shared calendar for deadlines', 'Review FAFSA requirements'],
  },
  {
    month: 'October',
    studentTasks: [
      'Submit Early Action / Early Decision applications',
      'Register for October/November SAT or ACT if retesting',
    ],
    parentTasks: ['Gather tax documents for financial aid forms'],
  },
  {
    month: 'November',
    studentTasks: ['Finish supplemental essays for Regular Decision schools'],
    parentTasks: ['Complete the CSS Profile, if required'],
  },
  {
    month: 'December',
    studentTasks: ['Submit remaining Regular Decision applications', 'File the FAFSA (opens Oct 1, due by school deadlines)'],
    parentTasks: ['Review Early Decision/Action results with student'],
  },
  {
    month: 'January',
    studentTasks: ['Submit mid-year grade reports', 'Complete any Rolling Admission applications'],
    parentTasks: ['Verify financial aid submissions are complete'],
  },
  {
    // Added for Retention Phase 2 (real per-school deadlines) — several
    // curated schools (DePauw, Indiana Bloomington, Trinity) have a real
    // February 1 Regular Decision deadline, which the original 7-month
    // skeleton had no bucket for at all.
    month: 'February',
    studentTasks: ['Submit any remaining applications with February deadlines'],
    parentTasks: ['Keep tracking decision dates as they arrive across every school'],
  },
  {
    month: 'March',
    studentTasks: ['Compare financial aid award letters as they arrive'],
    parentTasks: ['Schedule admitted-student visits'],
  },
  {
    month: 'May',
    studentTasks: ['Submit enrollment deposit by May 1 (National Decision Day)'],
    parentTasks: ['Confirm housing and orientation deadlines'],
  },
]
