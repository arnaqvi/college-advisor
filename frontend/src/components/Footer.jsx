const columns = [
  {
    heading: 'Product',
    links: ['Overview', 'Features', 'Comparison', 'Roadmap'],
  },
  {
    heading: 'Company',
    links: ['About', 'Careers', 'Partners', 'Contact'],
  },
  {
    heading: 'Resources',
    links: ['Help center', 'Guides', 'Case studies', 'Blog'],
  },
  {
    heading: 'Legal',
    links: ['Privacy', 'Terms', 'Security', 'Status'],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-border bg-offwhite px-6 py-16 text-text-secondary sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.1fr_2fr] lg:items-start">
        <div className="space-y-5">
          <div className="flex items-center gap-3 text-ink">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-aquamarine/10 text-lg font-bold text-ink">
              CP
            </span>
            <span className="text-lg font-semibold">CollegePath</span>
          </div>
          <p className="max-w-sm text-sm leading-6 text-text-secondary">
            The modern platform for planning undergraduate admissions across the US and Canada.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((column) => (
            <div key={column.heading}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-text-primary">
                {column.heading}
              </h3>
              <div className="mt-5 space-y-3 text-sm text-text-secondary">
                {column.links.map((link) => (
                  <a key={link} href="#" className="block transition hover:text-ink">
                    {link}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-12 border-t border-border pt-8 text-sm text-text-secondary">
        © 2026 CollegePath. All rights reserved.
      </div>
    </footer>
  )
}
