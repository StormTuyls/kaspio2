import { useTheme } from "../theme";
import type { Theme } from "../theme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const icons = {
    light: <SunIcon />,
    dark: <MoonIcon />,
    system: <ComputerIcon />,
  } as const;
  const labels = {
    light: "Licht",
    dark: "Donker",
    system: "Systeem",
  } as const;
  return (
    <button
      onClick={() => setTheme(next)}
      className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-basis shadow-sm transition hover:bg-ink-50 dark:border-ink-800 dark:bg-ink-900 dark:hover:bg-ink-800"
      aria-label={`Thema: ${labels[theme]}`}
      title={`Thema: ${labels[theme]}. Klik voor ${labels[next]}`}
    >
      {icons[theme]}
      <span className="hidden sm:inline">{labels[theme]}</span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ComputerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}
