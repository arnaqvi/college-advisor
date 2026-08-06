const stats = [
  { label: 'Programs mapped', value: '500+' },
  { label: 'States & provinces covered', value: '50+' },
  { label: 'Personalized plans created', value: '23K+' },
  { label: 'Application milestones tracked', value: '120K+' },
]

export default function StatsBand() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
      <div className="rounded-[28px] bg-[linear-gradient(135deg,_#86E7B8_0%,_#93FF96_45%,_#B2FFA8_100%)] px-8 py-14 text-[#173126] shadow-2xl shadow-[#86E7B8]/30 sm:px-12">
        <div className="grid gap-8 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="border-t border-[#173126]/15 pt-6 first:border-t-0 first:pt-0">
              <p className="text-4xl font-semibold leading-none">{stat.value}</p>
              <p className="mt-3 text-sm uppercase tracking-[0.24em] text-[#173126]/75">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
