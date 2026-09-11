// Shared plan list — used by Pricing.jsx and the sign-up forms (plan is
// chosen at sign-up, see StudentRegister.jsx/ParentRegister.jsx) so the
// three don't drift out of sync with each other. Matches the backend's
// Plan literal (backend/app/schemas/auth.py): free|individual|family|counselor.
// "counselor" isn't offered on self-serve sign-up (counsellor accounts are
// request-access only, see frontend/CLAUDE.md) but is a real backend value
// for whenever a counsellor account is provisioned.
// `priceMonthly`/`priceAnnual` (USD, numeric) drive Pricing.jsx's
// monthly/annual toggle and must match `_CHECKOUT_PLAN_PRICING` in
// backend/app/routers/billing.py exactly — that dict is the actual source of
// truth Stripe charges from, this is just the display copy. `price` stays a
// plain monthly-display string for StudentRegister.jsx/ParentRegister.jsx,
// which only ever show the monthly rate at sign-up (annual is a Pricing-page
// upsell, not a sign-up-time decision).
export const PLANS = [
  { id: 'free', title: 'Free', price: '$0', desc: 'College List only — a great way to start' },
  {
    id: 'individual',
    title: 'Student',
    price: '$19/mo',
    priceMonthly: 19,
    priceAnnual: 79,
    desc: 'Full planning toolkit for one student',
  },
  {
    id: 'family',
    title: 'Family',
    price: '$39/mo',
    priceMonthly: 39,
    priceAnnual: 149,
    desc: 'Up to 4 student profiles',
  },
]

export const COUNSELOR_PLAN = {
  id: 'counselor',
  title: 'Counsellor',
  price: 'Custom',
  desc: 'Manage and compare college lists across your students',
}
