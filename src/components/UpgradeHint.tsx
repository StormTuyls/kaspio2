type Props = {
  title: string;
  description: string;
  onUpgrade?: () => void;
  /** Compact = kleine inline variant; anders een volle kaart. */
  compact?: boolean;
  /** Label op de badge (default "Pro"). Voor Team-features: "Team". */
  badge?: string;
};

/** Toont waar een Pro+ functie zou staan, met een upgrade-aanzet. */
export function UpgradeHint({ title, description, onUpgrade, compact, badge = "Pro" }: Props) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border border-dashed border-teal-300 bg-teal-50/60 ${
        compact ? "px-4 py-3" : "px-5 py-6"
      } dark:border-teal-800 dark:bg-teal-900/20`}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-teal-800 dark:text-teal-200">
          <span className="badge-amber">{badge}</span>
          {title}
        </p>
        <p className="mt-0.5 text-xs text-teal-700/80 dark:text-teal-300/80">
          {description}
        </p>
      </div>
      {onUpgrade && (
        <button
          onClick={onUpgrade}
          className="flex-shrink-0 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-600"
        >
          Upgrade
        </button>
      )}
    </div>
  );
}
