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
      className={`flex items-center justify-between gap-3 rounded-md border border-dashed border-in-300 bg-in-100/60 ${
        compact ? "px-4 py-3" : "px-5 py-6"
      } dark:border-in-600 dark:bg-in-700/20`}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-in-700 dark:text-in-300">
          <span className="badge-amber">{badge}</span>
          {title}
        </p>
        <p className="mt-0.5 text-xs text-in-700/80 dark:text-in-400/80">
          {description}
        </p>
      </div>
      {onUpgrade && (
        <button
          onClick={onUpgrade}
          className="flex-shrink-0 rounded-lg bg-in-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-in-600"
        >
          Upgrade
        </button>
      )}
    </div>
  );
}
