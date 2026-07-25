import { useMemo, useState } from "react";
import type { Pot } from "../types";
import type { RecurringPlan, RecurringPlanInput } from "../data";
import { formatEuro } from "../storage";
import { RecurringPlanForm } from "./RecurringPlanForm";

type Props = {
  pots: Pot[];
  plans: RecurringPlan[];
  onAdd: (input: RecurringPlanInput) => Promise<{ error: string | null }>;
  onUpdate: (
    id: string,
    patch: Partial<RecurringPlanInput> & { active?: boolean },
  ) => Promise<{ error: string | null }>;
  onRemove: (id: string) => Promise<{ error: string | null }>;
};

/**
 * Beheer van terugkerende boekingen (stortingen + domiciliëringen). Toont de
 * lijst; klik toevoegen/bewerken om het formulier inline te openen.
 */
export function RecurringPlansPanel({
  pots,
  plans,
  onAdd,
  onUpdate,
  onRemove,
}: Props) {
  const [mode, setMode] = useState<
    { screen: "list" } | { screen: "add" } | { screen: "edit"; plan: RecurringPlan }
  >({ screen: "list" });
  const potById = useMemo(() => new Map(pots.map((p) => [p.id, p])), [pots]);

  if (mode.screen === "add") {
    return (
      <RecurringPlanForm
        pots={pots}
        onSubmit={onAdd}
        onCancel={() => setMode({ screen: "list" })}
      />
    );
  }
  if (mode.screen === "edit") {
    return (
      <RecurringPlanForm
        pots={pots}
        initial={mode.plan}
        onSubmit={(input) => onUpdate(mode.plan.id, input)}
        onCancel={() => setMode({ screen: "list" })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted dark:text-navy-300">
        Terugkerende stortingen en domiciliëringen rond je potjes. Stortingen boek
        je met één klik op het dashboard; domiciliëringen herkent Kaspio bij import.
      </p>

      {plans.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy-200 bg-canvas px-4 py-6 text-center text-sm text-ink-muted dark:border-navy-700 dark:bg-navy-900/40 dark:text-navy-300">
          Nog geen terugkerende boekingen.
        </p>
      ) : (
        <ul className="space-y-2">
          {plans.map((p) => (
            <PlanRow
              key={p.id}
              plan={p}
              potName={potById.get(p.pot_id)?.name ?? "—"}
              potColor={potById.get(p.pot_id)?.color}
              onEdit={() => setMode({ screen: "edit", plan: p })}
              onToggle={() => onUpdate(p.id, { active: !p.active })}
              onRemove={() => onRemove(p.id)}
            />
          ))}
        </ul>
      )}

      <button
        onClick={() => setMode({ screen: "add" })}
        disabled={pots.length === 0}
        className="btn-accent w-full"
      >
        + Terugkerende boeking
      </button>
    </div>
  );
}

function PlanRow({
  plan,
  potName,
  potColor,
  onEdit,
  onToggle,
  onRemove,
}: {
  plan: RecurringPlan;
  potName: string;
  potColor?: string;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  // Touch-veilige bevestiging zonder native confirm: klik verandert in "Zeker?".
  const [confirming, setConfirming] = useState(false);
  const isDom = plan.kind === "domiciliering";

  return (
    <li
      className={`rounded-xl border border-navy-100 px-3.5 py-3 dark:border-navy-700/60 ${
        plan.active ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: potColor ?? "#1D9E75" }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-navy-900 dark:text-navy-50">
              {plan.counterparty || (isDom ? "Domiciliëring" : "Storting")}
            </span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isDom
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  : "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
              }`}
            >
              {isDom ? "Domiciliëring" : "Storting"}
            </span>
          </div>
          <p className="text-xs text-ink-muted dark:text-navy-300">
            {potName} · dag {plan.day_of_month}
          </p>
        </div>
        <span className="flex-shrink-0 font-num text-sm font-bold tabular-nums text-navy-900 dark:text-white">
          {formatEuro(plan.amount)}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-2 text-xs">
        {confirming ? (
          <>
            <span className="mr-auto text-ink-muted dark:text-navy-300">Verwijderen?</span>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-navy-200 px-2.5 py-1 font-semibold text-navy-600 dark:border-navy-600 dark:text-navy-200"
            >
              Nee
            </button>
            <button
              onClick={onRemove}
              className="rounded-lg bg-rose-600 px-2.5 py-1 font-semibold text-white hover:bg-rose-700"
            >
              Ja, verwijder
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onToggle}
              className="rounded-lg border border-navy-200 px-2.5 py-1 font-semibold text-navy-600 dark:border-navy-600 dark:text-navy-200"
            >
              {plan.active ? "Pauzeer" : "Activeer"}
            </button>
            <button
              onClick={onEdit}
              className="rounded-lg border border-navy-200 px-2.5 py-1 font-semibold text-navy-600 dark:border-navy-600 dark:text-navy-200"
            >
              Bewerk
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="rounded-lg px-2.5 py-1 font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
            >
              Verwijder
            </button>
          </>
        )}
      </div>
    </li>
  );
}
