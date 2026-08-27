// =============================================================================
// Periodefilters , gedeeld tussen de transactiepagina en het financieel rapport
// =============================================================================
// Beide plekken bieden dezelfde presets aan ("dit jaar", "vorig kwartaal", ...).
// De logica stond eerst in ReportModal; hier staat ze één keer, zodat een
// rapport over "dit kwartaal" exact dezelfde rijen bevat als de pagina.
//
// Grenzen zijn ISA-stijl ISO-datums (YYYY-MM-DD) en INCLUSIEF aan beide kanten,
// net als Transaction.occurredOn. null = geen grens.
// =============================================================================

export type PeriodPreset =
  | "all"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "last_year"
  | "custom";

export type Period = {
  start: string | null;
  end: string | null;
  /** Mensvriendelijk label voor rapportkoppen, bv. "Q3 2026". */
  label: string;
};

export const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "all", label: "Alle transacties" },
  { value: "this_month", label: "Deze maand" },
  { value: "last_month", label: "Vorige maand" },
  { value: "this_quarter", label: "Dit kwartaal" },
  { value: "this_year", label: "Dit jaar" },
  { value: "last_year", label: "Vorig jaar" },
  { value: "custom", label: "Aangepast…" },
];

const MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDay(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

function monthRange(year: number, month0: number): Period {
  return {
    start: `${year}-${pad(month0 + 1)}-01`,
    end: `${year}-${pad(month0 + 1)}-${pad(lastDay(year, month0))}`,
    label: `${MONTHS[month0]} ${year}`,
  };
}

/**
 * Zet een preset om in concrete grenzen. `now` wordt meegegeven zodat dit
 * puur en testbaar blijft; app-code geeft gewoon `new Date()` mee.
 */
export function resolvePeriod(
  preset: PeriodPreset,
  now: Date,
  custom: { start: string; end: string } = { start: "", end: "" },
): Period {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  switch (preset) {
    case "all":
      return { start: null, end: null, label: "alle transacties" };
    case "this_month":
      return monthRange(y, m);
    case "last_month":
      return m === 0 ? monthRange(y - 1, 11) : monthRange(y, m - 1);
    case "this_quarter": {
      const q = Math.floor(m / 3); // 0..3
      const sm = q * 3;
      const em = sm + 2;
      return {
        start: `${y}-${pad(sm + 1)}-01`,
        end: `${y}-${pad(em + 1)}-${pad(lastDay(y, em))}`,
        label: `Q${q + 1} ${y}`,
      };
    }
    case "this_year":
      return { start: `${y}-01-01`, end: `${y}-12-31`, label: `${y}` };
    case "last_year":
      return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31`, label: `${y - 1}` };
    case "custom":
      return {
        start: custom.start || null,
        end: custom.end || null,
        label:
          custom.start || custom.end
            ? `${custom.start || "begin"} , ${custom.end || "nu"}`
            : "aangepaste periode",
      };
  }
}

/** Valt een occurredOn (YYYY-MM-DD) binnen de periode? Grenzen inclusief. */
export function inPeriod(occurredOn: string, period: Period): boolean {
  if (period.start !== null && occurredOn < period.start) return false;
  if (period.end !== null && occurredOn > period.end) return false;
  return true;
}
