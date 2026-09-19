// =============================================================================
// Segment , keuze uit een handvol elkaar uitsluitende opties
// =============================================================================
// Het dashboard had er twee: één boven "Geldstroom" en één boven de
// cashflow-grafiek, beide met dezelfde labels (Dag/Week/Maand/Jaar), driehonderd
// pixels uit elkaar, met een andere hoogte, een andere radius en een andere
// actieve staat. Dat leest als twee verschillende besturingselementen voor
// hetzelfde soort keuze.
//
// Verder was geen van beide semantisch iets: vier losse knoppen, waarvan een
// schermlezer niet hoort welke actief is. `aria-pressed` lost dat op zonder de
// tablist-semantiek te claimen, want er hangt geen tabpanel aan.
//
// Hoogte volgt .btn: 44px op touch, compacter vanaf sm.
// =============================================================================

type Optie<T extends string> = { id: T; label: string };

export function Segment<T extends string>({
  opties,
  waarde,
  onChange,
  label,
}: {
  opties: readonly Optie<T>[];
  waarde: T;
  onChange: (id: T) => void;
  /** Waar de keuze over gaat, voor een schermlezer. */
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-md p-0.5"
      style={{ background: "var(--oppervlak-gedempt)" }}
    >
      {opties.map((o) => {
        const actief = o.id === waarde;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={actief}
            className={`min-h-11 rounded-sm px-2.5 text-xs font-semibold transition-colors sm:min-h-8 ${
              actief ? "text-sterk" : "text-zacht hover:text-sterk"
            }`}
            style={actief ? { background: "var(--oppervlak-verhoogd)" } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
