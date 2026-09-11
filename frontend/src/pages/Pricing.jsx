import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { PLANS } from '../data/plans.js'
import { applyRetentionOffer, createCheckoutSession } from '../lib/api/billing.js'

const API_BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export default function Pricing() {
  const { user, refresh } = useAuth()
  const location = useLocation()
  const [billing, setBilling] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)
  // Named `billingInterval`, not `interval` — `setInterval` would shadow the
  // global timer function of the same name.
  const [billingInterval, setBillingInterval] = useState('month')
  // Holds the plan id being canceled while the win-back modal is open, or
  // `null` when it's closed — doubles as "is the modal showing".
  const [cancelModalPlanId, setCancelModalPlanId] = useState(null)
  const [retentionOfferApplied, setRetentionOfferApplied] = useState(false)
  const [retentionError, setRetentionError] = useState(null)

  async function refreshBilling() {
    // Same-origin request — the session cookie is sent automatically, no
    // X-User-Email header needed (that placeholder is gone, see
    // backend/app/core/auth.py).
    const res = await fetch(`${API_BASE}api/billing/`)
    if (!res.ok) return
    setBilling(await res.json())
  }

  useEffect(() => {
    if (!user) return
    setLoading(true)
    refreshBilling().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Free plan only — real payment isn't involved, so this still goes through
  // the original scaffold endpoint (see backend/app/routers/billing.py's
  // module docstring: /subscribe is now locked to `plan: "free"` only).
  async function downgradeToFree() {
    if (!user) return
    setLoading(true)
    setCheckoutError(null)
    const res = await fetch(`${API_BASE}api/billing/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'free' }),
    })
    if (res.ok) {
      await refreshBilling()
      // Subscribing changes `tier`, which Layout.jsx's nav gating reads from
      // AuthContext — re-check the session so that updates without a reload.
      await refresh()
    }
    setLoading(false)
  }

  // Paid plans — real Stripe Checkout. Redirects the browser to Stripe's
  // hosted page; the plan is only actually granted server-side after
  // /pricing/success verifies payment (see PricingSuccess.jsx). No tier
  // change happens here.
  async function startCheckout(planId) {
    if (!user) return
    setLoading(true)
    setCheckoutError(null)
    try {
      const { checkout_url: checkoutUrl } = await createCheckoutSession(planId, billingInterval)
      window.location.href = checkoutUrl
    } catch (err) {
      setCheckoutError(err.message)
      setLoading(false)
    }
  }

  // Access continues until the current paid period ends — the backend
  // schedules cancellation with Stripe rather than revoking immediately
  // (see billing.py's cancel_subscription docstring), so this doesn't
  // instantly flip the user to Free.
  async function confirmCancel() {
    if (!user) return
    setLoading(true)
    await fetch(`${API_BASE}api/billing/cancel`, { method: 'POST' })
    await refreshBilling()
    await refresh()
    setLoading(false)
    setCancelModalPlanId(null)
  }

  // The win-back offer on the cancel modal — applies a one-time 50%-off
  // coupon to the next renewal and keeps the subscription as-is (no local
  // tier/status change, so no refreshBilling()/refresh() needed).
  async function keepWithDiscount() {
    setLoading(true)
    setRetentionError(null)
    try {
      await applyRetentionOffer()
      setRetentionOfferApplied(true)
    } catch (err) {
      setRetentionError(err.message)
    }
    setLoading(false)
  }

  function closeCancelModal() {
    setCancelModalPlanId(null)
    setRetentionOfferApplied(false)
    setRetentionError(null)
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">Pricing</h2>
      <p className="mt-1 text-sm text-text-secondary">Choose the plan that fits your family.</p>

      <div className="mt-4 inline-flex rounded-full border border-border bg-surface p-1 text-sm">
        <button
          type="button"
          onClick={() => setBillingInterval('month')}
          className={`rounded-full px-4 py-1.5 font-semibold transition-colors ${
            billingInterval === 'month' ? 'bg-accent text-accent-contrast' : 'text-text-secondary'
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setBillingInterval('year')}
          className={`rounded-full px-4 py-1.5 font-semibold transition-colors ${
            billingInterval === 'year' ? 'bg-accent text-accent-contrast' : 'text-text-secondary'
          }`}
        >
          Annual — 8 months free
        </button>
      </div>

      {location.state?.reason === 'upgrade' && (
        <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-text-primary">
          That page is part of a paid plan — pick one below to unlock it.
        </div>
      )}

      {checkoutError && (
        <div className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {checkoutError}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => {
          const active = billing?.subscription?.plan === p.id
          const isPaid = p.id !== 'free'
          const displayPrice = !isPaid
            ? p.price
            : billingInterval === 'year'
              ? `$${p.priceAnnual}/yr`
              : `$${p.priceMonthly}/mo`
          return (
            <div key={p.id} className={`rounded-lg border border-border p-5 bg-surface ${active ? 'ring-2 ring-accent/50' : ''}`}>
              <h3 className="text-lg font-semibold text-text-primary">{p.title}</h3>
              <p className="mt-2 text-sm text-text-secondary">{p.desc}</p>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{displayPrice}</div>
                  {isPaid && billingInterval === 'year' && (
                    <div className="text-xs text-text-secondary">
                      vs ${p.priceMonthly * 12}/yr paid monthly
                    </div>
                  )}
                  {active && (
                    <div className="mt-1 text-xs text-text-secondary">
                      Billed {billing.subscription.billing_interval === 'year' ? 'annually' : 'monthly'}
                    </div>
                  )}
                </div>
                <div>
                  {active ? (
                    <button
                      onClick={() => (p.id === 'free' ? confirmCancel() : setCancelModalPlanId(p.id))}
                      disabled={loading}
                      className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Cancel
                    </button>
                  ) : p.id === 'free' ? (
                    <button onClick={downgradeToFree} disabled={loading} className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast">
                      Downgrade
                    </button>
                  ) : (
                    <button onClick={() => startCheckout(p.id)} disabled={loading} className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast">
                      Subscribe
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {cancelModalPlanId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl">
            {retentionOfferApplied ? (
              <>
                <h3 className="text-lg font-semibold text-text-primary">Discount applied 🎉</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  Your next renewal is 50% off. Your plan continues as normal — nothing else changes.
                </p>
                <button
                  onClick={closeCancelModal}
                  className="mt-5 w-full rounded-full bg-accent px-3 py-2 text-sm font-semibold text-accent-contrast"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-text-primary">Before you go</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  Want 50% off your next renewal instead of canceling? Your plan and everything in it stays exactly the same.
                </p>
                {retentionError && (
                  <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {retentionError}
                  </div>
                )}
                <button
                  onClick={keepWithDiscount}
                  disabled={loading}
                  className="mt-4 w-full rounded-full bg-accent px-3 py-2 text-sm font-semibold text-accent-contrast"
                >
                  Keep my plan — 50% off next renewal
                </button>
                <p className="mt-4 text-xs text-text-secondary">
                  If you cancel instead, you keep full access until{' '}
                  {billing?.subscription?.current_period_end
                    ? new Date(billing.subscription.current_period_end).toLocaleDateString()
                    : 'the end of your current billing period'}
                  {' '}— you won't be billed again after that.
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={confirmCancel}
                    disabled={loading}
                    className="flex-1 rounded-full border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600"
                  >
                    No thanks, cancel my plan
                  </button>
                  <button
                    onClick={closeCancelModal}
                    disabled={loading}
                    className="flex-1 rounded-full border border-border px-3 py-2 text-sm font-semibold text-text-secondary"
                  >
                    Never mind
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
