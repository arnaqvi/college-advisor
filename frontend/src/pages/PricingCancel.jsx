import { Link } from 'react-router-dom'
import { XCircle } from 'lucide-react'

// Stripe Checkout's cancel_url — reached when the user backs out of the
// hosted Checkout page without paying. No backend call needed: nothing was
// ever granted (see backend/app/routers/billing.py — only /checkout/verify
// after a *paid* session grants a plan), so there's nothing to undo here.
export default function PricingCancel() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <XCircle size={40} className="mx-auto text-text-secondary" />
      <h2 className="mt-4 font-display text-xl font-bold text-text-primary">Checkout canceled</h2>
      <p className="mt-2 text-sm text-text-secondary">
        No payment was made and nothing changed on your account.
      </p>
      <Link to="/pricing" className="mt-6 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast">
        Back to Pricing
      </Link>
    </div>
  )
}
