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
    // Deze doos was groen: vulling, rand, kop, tekst en knop allemaal in de
    // "geld erin"-kleur. Dat is de enige kleur die in Kaspio een betekenis
    // heeft, en een betaalmuur is geen inkomst. Een gestippelde haarlijn zegt
    // "hier zou iets staan" net zo goed, zonder de code te vervuilen.
    <div
      className={`flex items-center justify-between gap-3 rounded-md border border-dashed ${
        compact ? "px-4 py-3" : "px-5 py-6"
      }`}
      style={{ borderColor: "var(--lijn-sterk)" }}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-sterk">
          <span className="tag tag--uit">{badge}</span>
          {title}
        </p>
        <p className="mt-0.5 text-xs text-zacht">{description}</p>
      </div>
      {onUpgrade && (
        <button onClick={onUpgrade} className="btn btn--secondary flex-shrink-0">
          Upgrade
        </button>
      )}
    </div>
  );
}
