import { useState } from "react";
import type { Pot } from "../types";
import type { RecurringPlan, RecurringPlanInput, RecurringPlanKind } from "../data";

type Props = {
  pots: Pot[];
  /** Aanwezig bij bewerken. */
  initial?: RecurringPlan;
  onSubmit: (input: RecurringPlanInput) => Promise<{ error: string | null }>;
  onCancel: () => void;
};

/**
 * Formulier voor een terugkerende boeking: een maandelijkse storting in een
 * potje, of een domiciliëring (vaste afhouding) die aan een potje hangt.
 */
export function RecurringPlanForm({ pots, initial, onSubmit, onCancel }: Props) {
  const [kind, setKind] = useState<RecurringPlanKind>(initial?.kind ?? "storting");
  const [potId, setPotId] = useState(initial?.pot_id ?? pots[0]?.id ?? "");
  const [amount, setAmount] = useState(
    initial ? String(initial.amount) : "",
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    String(initial?.day_of_month ?? 1),
  );
  const [counterparty, setCounterparty] = useState(initial?.counterparty ?? "");
  // Zelf-financierende domiciliëring: Kaspio zet het geld vooraf klaar.
  const [reserve, setReserve] = useState(initial?.reserve_day != null);
  const [reserveDay, setReserveDay] = useState(
    String(initial?.reserve_day ?? 1),
  );
  const [autoBook, setAutoBook] = useState(initial?.auto_book ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDom = kind === "domiciliering";

  async function submit() {
    const amt = Number(amount.replace(",", "."));
    if (!potId) {
      setError("Kies een potje.");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Vul een bedrag groter dan 0 in.");
      return;
    }
    const day = Math.round(Number(dayOfMonth));
    if (!Number.isFinite(day) || day < 1 || day > 31) {
      setError("Kies een dag tussen 1 en 31.");
      return;
    }
    if (isDom && !counterparty.trim()) {
      setError("Geef de tegenpartij op zodat we de domiciliëring bij import herkennen.");
      return;
    }
    const rDay = Math.round(Number(reserveDay));
    if (isDom && reserve && (!Number.isFinite(rDay) || rDay < 1 || rDay > 31)) {
      setError("Kies een reserveerdag tussen 1 en 31.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await onSubmit({
      potId,
      kind,
      amount: amt,
      dayOfMonth: day,
      counterparty: counterparty.trim() || null,
      reserveDay: isDom && reserve ? rDay : null,
      autoBook,
    });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onCancel();
  }

  return (
    <div className="space-y-4">
      {/* Soort */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1 dark:bg-navy-800">
        {(
          [
            ["storting", "Storting in potje"],
            ["domiciliering", "Domiciliëring"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              kind === k
                ? "bg-white text-navy-900 shadow-sm dark:bg-navy-700 dark:text-white"
                : "text-navy-500 dark:text-navy-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-sm text-ink-muted dark:text-navy-300">
        {isDom
          ? "Een vaste afhouding (bv. verzekering) die de bank echt doet. Kaspio boekt ze niet zelf, maar reserveert het bedrag in dit potje en herkent de transactie bij import."
          : "Reserveer elke maand geld uit de hoofdpot in dit potje. Je bevestigt de storting met één klik op het dashboard."}
      </p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
          Potje
        </span>
        <select
          value={potId}
          onChange={(e) => setPotId(e.target.value)}
          className="input"
        >
          {pots.length === 0 && <option value="">Geen potjes</option>}
          {pots.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
            Bedrag
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-light">
              €
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input pl-7 font-num tabular-nums"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
            Dag van de maand
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            className="input font-num tabular-nums"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
          Tegenpartij{" "}
          <span className="font-normal text-ink-light">
            {isDom ? "(nodig om te herkennen)" : "(optioneel label)"}
          </span>
        </span>
        <input
          value={counterparty}
          onChange={(e) => setCounterparty(e.target.value)}
          placeholder={isDom ? "bv. AG Insurance" : "bv. Sparen voor kamp"}
          className="input"
        />
      </label>

      {/* Zelf-financierende domiciliëring: hoofdpot -> potje, vóór de afhouding. */}
      {isDom && (
        <div className="rounded-xl border border-navy-100 p-3.5 dark:border-navy-700">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={reserve}
              onChange={(e) => setReserve(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-teal-600"
            />
            <span className="text-sm">
              <span className="font-medium text-navy-800 dark:text-navy-100">
                Zet het geld vooraf klaar in dit potje
              </span>
              <span className="mt-0.5 block text-xs text-ink-muted dark:text-navy-300">
                Kaspio verschuift het bedrag uit de hoofdpot naar dit potje. De
                afhouding haalt het er daarna weer uit, dus het potje eindigt op
                nul. Zonder dit hoef je zelf een aparte storting te maken.
              </span>
            </span>
          </label>

          {reserve && (
            <label className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-navy-700 dark:text-navy-200">
                Klaarzetten op dag
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={reserveDay}
                onChange={(e) => setReserveDay(e.target.value)}
                className="input w-20 text-right font-num tabular-nums"
              />
            </label>
          )}
        </div>
      )}

      {/* Automatisch boeken van de reservering (nooit van de echte afhouding). */}
      {(!isDom || reserve) && (
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={autoBook}
            onChange={(e) => setAutoBook(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-teal-600"
          />
          <span className="text-sm">
            <span className="font-medium text-navy-800 dark:text-navy-100">
              Automatisch boeken
            </span>
            <span className="mt-0.5 block text-xs text-ink-muted dark:text-navy-300">
              Kaspio boekt dit zelf zodra de dag bereikt is. Uit? Dan verschijnt
              het onder "Te bevestigen" en klik jij op Boek.
            </span>
          </span>
        </label>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="btn-secondary" disabled={busy}>
          Annuleren
        </button>
        <button
          onClick={submit}
          disabled={busy || pots.length === 0}
          className="btn-accent"
        >
          {busy ? "Bezig…" : initial ? "Bewaren" : "Toevoegen"}
        </button>
      </div>
    </div>
  );
}
