// Shared card layout for all auth pages (login/register/request-access/forgot
// password): a centered card, two columns on desktop (illustration panel +
// form), single column near-full-width on mobile.
export default function AuthLayout({ icon: Icon, panelTitle, panelBody, children, maxWidthClassName = 'max-w-4xl' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10 sm:px-6">
      <div className={`grid w-full ${maxWidthClassName} overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_40px_rgba(16,18,16,0.08)] md:grid-cols-2`}>
        <div className="hidden flex-col justify-center gap-6 bg-gradient-to-br from-[#0E0F0C] to-[#17190F] p-12 text-white md:flex">
          {Icon && (
            <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-[var(--mint-tint)]">
              <Icon size={32} className="text-[var(--mint-deep)]" />
            </div>
          )}
          <div>
            <h2 className="font-display text-[28px] font-extrabold leading-[1.2] tracking-tight text-white">{panelTitle}</h2>
            <p className="mt-3 text-[15px] leading-7 text-white/80">{panelBody}</p>
          </div>
        </div>
        <div className="p-8 sm:p-10 lg:p-12">{children}</div>
      </div>
    </div>
  )
}
