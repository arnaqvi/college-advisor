// Shared plan list — used by Pricing.jsx and the sign-up forms (plan is
// chosen at sign-up, see StudentRegister.jsx/ParentRegister.jsx) so the
// three don't drift out of sync with each other. Matches the backend's
// Plan literal (backend/app/schemas/auth.py): free|individual|family|counselor.
// "counselor" isn't offered on self-serve sign-up (counsellor accounts are
// request-access only, see frontend/CLAUDE.md) but is a real backend value
// for whenever a counsellor account is provisioned.
export const PLANS = [
  { id: 'free', title: 'Free', price: '$0', desc: 'College List only — a great way to start' },
  { id: 'individual', title: 'Student', price: '$9/mo', desc: 'Full planning toolkit for one student' },
  { id: 'family', title: 'Family', price: '$25/mo', desc: 'Up to 4 student profiles' },
]

export const COUNSELOR_PLAN = {
  id: 'counselor',
  title: 'Counsellor',
  price: 'Custom',
  desc: 'Manage and compare college lists across your students',
}
