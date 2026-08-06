export async function trackEvent({ component, eventType, metadata = {} }) {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ component, event_type: eventType, metadata }),
    })
  } catch {
    // The /api/events endpoint lands in Phase 2 — until then, failed calls are expected and silently dropped.
  }
}
