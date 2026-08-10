import { useRef, useState } from 'react'
import { Bot, Send } from 'lucide-react'
import { sendAdvisorMessage } from '../lib/api/advisor.js'

// Capped for the same reason the backend caps `history` (see
// backend/app/routers/advisor.py) — keeps per-message cost/latency bounded
// for a sidebar chat panel; older turns just age out.
const MAX_HISTORY_TURNS = 20

export default function AdvisorChat({ initialPrompt = '' }) {
  const [messages, setMessages] = useState([])
  // Pre-fills but never auto-sends — the AI disclosure banner above is the
  // first thing the user sees either way, but sending still needs an
  // explicit click, same as typing the question themselves.
  const [input, setInput] = useState(initialPrompt)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const listRef = useRef(null)

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    setError('')

    try {
      const result = await sendAdvisorMessage(text, messages.slice(-MAX_HISTORY_TURNS))
      if (result.status === 'not_configured') {
        setNotConfigured(true)
        setError(result.message || 'The AI Advisor is not set up yet.')
        return
      }
      setMessages([...nextMessages, { role: 'assistant', content: result.reply }])
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSending(false)
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
      })
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-raised">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Bot size={18} className="text-accent-contrast" />
        <div>
          <h3 className="text-sm font-semibold text-text-primary">AI Advisor</h3>
          {/* Required disclosure per Anthropic's Usage Policy: consumer-facing
              chat features must tell users they're talking to AI, not a
              human, visible at minimum at the start of the session. */}
          <p className="text-xs text-text-secondary">
            You&apos;re chatting with an AI assistant, not a person. It only answers questions about college
            admissions, courses, scholarships, and applications — for anything else, talk to your counselor.
          </p>
        </div>
      </div>

      <div ref={listRef} className="max-h-80 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-text-secondary">
            Ask me about course selection, applications, scholarships, or how your profile stacks up.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'ml-auto bg-accent text-accent-contrast'
                : 'bg-surface text-text-primary'
            }`}
          >
            {m.content}
          </div>
        ))}
        {sending && <p className="text-xs text-text-secondary">Thinking…</p>}
      </div>

      {error && (
        <p className="border-t border-border px-4 py-2 text-xs font-medium text-reach">{error}</p>
      )}

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border px-4 py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={notConfigured ? 'AI Advisor is not set up yet' : 'Ask about admissions, courses, scholarships…'}
          disabled={sending || notConfigured}
          maxLength={4000}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending || notConfigured || !input.trim()}
          className="landing-button-dark flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
