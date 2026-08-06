// Icon + title + subtitle block at the top of the form column on auth pages.
export default function AuthFormHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-8 text-center md:text-left">
      {Icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--mint-tint)] text-[var(--mint-deep)] md:mx-0">
          <Icon size={24} />
        </div>
      )}
      <h1 className="font-display text-[28px] font-extrabold leading-[1.2] tracking-tight text-[var(--text-primary)]">{title}</h1>
      {subtitle && <p className="mt-3 text-[15px] leading-6 text-[var(--text-secondary)]">{subtitle}</p>}
    </div>
  )
}
