type Variant = "default" | "light";

export function Mark({
  size = 36,
  variant = "default",
}: {
  size?: number;
  variant?: Variant;
}) {
  // Het merk draagt geen kleur meer. Groen betekent in dit systeem "geld erin",
  // en een logo is geen bedrag. De vorm doet het werk: vier vakken, één vol.
  // Op een donkere ondergrond ("light") wordt het teken zelf licht.
  const bg = variant === "light" ? "rgba(255,255,255,0.10)" : "#0a0f14";
  const divider = "rgba(255,255,255,0.16)";
  const accent = "#ffffff";
  const surface = "#ffffff";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      role="img"
      aria-label="Kaspio"
    >
      <rect x="0" y="0" width="36" height="36" rx="10" fill={bg} />
      <rect x="6" y="6" width="11" height="11" rx="3" fill={surface} fillOpacity="0.22" />
      <rect x="19" y="6" width="11" height="11" rx="3" fill={surface} fillOpacity="0.36" />
      <rect x="6" y="19" width="11" height="11" rx="3" fill={surface} fillOpacity="0.54" />
      <rect x="19" y="19" width="11" height="11" rx="3" fill={accent} />
      <line x1="18" y1="6" x2="18" y2="30" stroke={divider} strokeWidth="0.5" />
      <line x1="6" y1="18" x2="30" y2="18" stroke={divider} strokeWidth="0.5" />
    </svg>
  );
}

export function Wordmark({
  size = 36,
  variant = "default",
  subtitle,
  className = "",
}: {
  size?: number;
  variant?: Variant;
  subtitle?: string;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Mark size={size} variant={variant} />
      <span className="flex flex-col leading-none">
        <span
          className={`text-base font-extrabold tracking-tight ${
            variant === "light" ? "text-white" : "text-ink-900 dark:text-ink-100"
          }`}
        >
          Kaspio
        </span>
        {subtitle && (
          <span
            className={`mt-0.5 text-[11px] ${
              variant === "light" ? "text-ink-300" : "text-ink-600 dark:text-ink-500"
            }`}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
