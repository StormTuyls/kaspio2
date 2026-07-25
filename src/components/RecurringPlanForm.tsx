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
    setBusy(true);
    setError(null);
    const res = await onSubmit({
      potId,
      kind,
      amount: amt,
      dayOfMonth: day,
      counterparty: counterparty.trim() || null,
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
          : "Reserveer elke maand geld van de kaart in dit potje. Je bevestigt de storting met één klik op het dashboard."}
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
