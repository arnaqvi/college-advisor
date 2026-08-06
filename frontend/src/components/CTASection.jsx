export default function CTASection() {
  return (
    <section className="bg-[#D0FFB7] px-6 py-20 text-[#173126]">
      <div className="mx-auto max-w-7xl rounded-[32px] border border-[#86E7B8]/55 bg-[#F2F5DE]/45 px-8 py-14 shadow-2xl shadow-[#86E7B8]/20 sm:px-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[#173126]/75">Ready to take control?</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[#173126] sm:text-5xl">
              Start your admissions plan with a tool designed for every stage.
            </h2>
          </div>
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-[#86E7B8] px-7 py-4 text-sm font-semibold text-[#173126] shadow-lg shadow-[#86E7B8]/30 transition hover:-translate-y-0.5 hover:bg-[#93FF96]"
          >
            Start your plan
          </a>
        </div>
      </div>
    </section>
  )
}
