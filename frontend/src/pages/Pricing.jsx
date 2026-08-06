import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

const PLANS = [
  { id: 'free', title: 'Free', price: '$0', desc: 'Basic planning tools' },
  { id: 'individual', title: 'Individual', price: '$9/mo', desc: 'Single student premium features' },
  { id: 'family', title: 'Family', price: '$25/mo', desc: 'Up to 4 student profiles' },
]

export default function Pricing() {
  const { user } = useAuth()
  const [billing, setBilling] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchBilling() {
      if (!user?.email) return
      setLoading(true)
      const res = await fetch('/api/billing/', {
        headers: { 'X-User-Email': user.email },
      })
      const data = await res.json()
      setBilling(data)
      setLoading(false)
    }
    fetchBilling()
  }, [user])

  async function subscribe(planId) {
    if (!user?.email) return
    setLoading(true)
    const res = await fetch('/api/billing/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email },
      body: JSON.stringify({ plan: planId }),
    })
    if (res.ok) setBilling(await (await fetch('/api/billing/', { headers: { 'X-User-Email': user.email } })).json())
    setLoading(false)
  }

  async function cancel() {
    if (!user?.email) return
    setLoading(true)
    await fetch('/api/billing/cancel', { method: 'POST', headers: { 'X-User-Email': user.email } })
    setBilling(await (await fetch('/api/billing/', { headers: { 'X-User-Email': user.email } })).json())
    setLoading(false)
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">Pricing</h2>
      <p className="mt-1 text-sm text-text-secondary">Choose the plan that fits your family.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => {
          const active = billing?.subscription?.plan === p.id
          return (
            <div key={p.id} className={`rounded-lg border border-border p-5 bg-surface ${active ? 'ring-2 ring-accent/50' : ''}`}>
              <h3 className="text-lg font-semibold text-text-primary">{p.title}</h3>
              <p className="mt-2 text-sm text-text-secondary">{p.desc}</p>
              <div className="mt-4 flex items-center justify-between">
                <div className="text-2xl font-bold">{p.price}</div>
                <div>
                  {active ? (
                    <button onClick={cancel} disabled={loading} className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white">
                      Cancel
                    </button>
                  ) : (
                    <button onClick={() => subscribe(p.id)} disabled={loading} className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast">
                      {p.id === 'free' ? 'Current' : 'Subscribe'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 text-sm text-text-secondary">
        <pre className="rounded bg-surface-raised p-3 text-xs">{loading ? 'Loading...' : JSON.stringify(billing, null, 2)}</pre>
      </div>
    </div>
  )
}
