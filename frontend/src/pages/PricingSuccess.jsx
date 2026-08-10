import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { verifyCheckoutSession } from '../lib/api/billing.js'

// Landed on after Stripe Checkout redirects back with `?session_id=...`
// (see success_url in backend/app/routers/billing.py's create_checkout_session).
// The plan is NOT granted by anything the browser did — this page's only job
// is to ask the backend to independently verify payment with Stripe and show
// the result. If the user refreshes or revisits this URL, verification just
// re-runs (idempotent — see upsert_subscription_for_user on the backend).
export default function PricingSuccess() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const { refresh } = useAuth()
  const [state, setState] = useState({ status: 'verifying', message: null, plan: null })

  useEffect(() => {
    if (!sessionId) {
      setState({ status: 'error', message: 'No checkout session was found in the URL.', plan: null })
      return
    }
    let cancelled = false
    verifyCheckoutSession(sessionId)
      .then(async (result) => {
        if (cancelled) return
        setState({ status: result.status, message: result.message, plan: result.plan })
        if (result.status === 'paid') {
          // Plan/tier just changed server-side — re-check the session so
          // Layout.jsx's nav gating picks it up without a full reload.
          await refresh()
        }
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: err.message, plan: null })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      {state.status === 'verifying' && (
        <>
          <Loader2 size={40} className="mx-auto animate-spin text-accent" />
          <h2 className="mt-4 font-display text-xl font-bold text-text-primary">Confirming your payment…</h2>
          <p className="mt-2 text-sm text-text-secondary">This only takes a second.</p>
        </>
      )}

      {state.status === 'paid' && (
        <>
          <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
          <h2 className="mt-4 font-display text-xl font-bold text-text-primary">You're all set</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Payment confirmed — your {state.plan ? <span className="font-semibold">{state.plan}</span> : 'new'} plan is active.
          </p>
          <Link to="/dashboard" className="mt-6 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast">
            Go to Dashboard
          </Link>
        </>
      )}

      {state.status === 'pending' && (
        <>
          <Loader2 size={40} className="mx-auto text-amber-500" />
          <h2 className="mt-4 font-display text-xl font-bold text-text-primary">Payment still processing</h2>
          <p className="mt-2 text-sm text-text-secondary">
            {state.message || "Stripe hasn't confirmed this payment yet. Refresh this page in a moment, or check Pricing for your current plan."}
          </p>
          <Link to="/pricing" className="mt-6 inline-block rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary">
            Back to Pricing
          </Link>
        </>
      )}

      {(state.status === 'error' || state.status === 'not_configured') && (
        <>
          <AlertTriangle size={40} className="mx-auto text-rose-500" />
          <h2 className="mt-4 font-display text-xl font-bold text-text-primary">Couldn't confirm this payment</h2>
          <p className="mt-2 text-sm text-text-secondary">
            {state.message || 'Something went wrong verifying your checkout session.'}
          </p>
          <Link to="/pricing" className="mt-6 inline-block rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary">
            Back to Pricing
          </Link>
        </>
      )}
    </div>
  )
}
