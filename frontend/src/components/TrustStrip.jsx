const schools = ['Pacific Heights Academy', 'Prairie State University', 'Maple Ridge Institute', 'North Shore Conservatory']

export default function TrustStrip() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
      <div className="rounded-[28px] border border-border bg-surface/80 px-6 py-8 shadow-sm shadow-ink/5 sm:px-8">
        <div className="flex flex-col gap-6 text-center sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-aquamarine">Trusted by students planning for</p>
          </div>
          <div className="grid gap-3 text-sm text-text-secondary sm:grid-cols-4 sm:gap-6">
            {schools.map((school) => (
              <div key={school} className="rounded-3xl bg-surface-raised px-4 py-3 text-ink shadow-sm shadow-ink/5">
                {school}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
