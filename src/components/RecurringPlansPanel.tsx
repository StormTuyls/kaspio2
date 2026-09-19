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
      <p className="text-sm text-ink-muted dark:text-ink-400">
        Terugkerende stortingen en domiciliëringen rond je potjes. Reserveringen
        zet Kaspio 's nachts zelf klaar, of jij bevestigt ze met één klik op het
        dashboard; de echte afhouding herkent Kaspio bij de bankimport.
      </p>

      {plans.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-300 bg-ink-50 px-4 py-6 text-center text-sm text-ink-muted dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-400">
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
      className={`rounded-lg border border-ink-200 px-3.5 py-3 dark:border-ink-800/60 ${
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
            <span className="truncate text-sm font-semibold text-sterk">
              {plan.counterparty || (isDom ? "Domiciliëring" : "Storting")}
            </span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                isDom
                  ? "bg-uit-100 text-uit-700 dark:bg-uit-700/30 dark:text-uit-400"
                  : "bg-in-100 text-in-700 dark:bg-in-700/30 dark:text-in-400"
              }`}
            >
              {isDom ? "Domiciliëring" : "Storting"}
            </span>
          </div>
          <p className="text-xs text-ink-muted dark:text-ink-400">
            {potName} · dag {plan.day_of_month}
          </p>
        </div>
        <span className="flex-shrink-0 font-num text-sm font-bold tabular-nums text-ink-900 dark:text-white">
          {formatEuro(plan.amount)}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-2 text-xs">
        {confirming ? (
          <>
            <span className="mr-auto text-ink-muted dark:text-ink-400">Verwijderen?</span>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-ink-300 px-2.5 py-1 font-semibold text-basis dark:border-ink-600"
            >
              Nee
            </button>
            <button
              onClick={onRemove}
              className="rounded-lg bg-fout-600 px-2.5 py-1 font-semibold text-white transition-colors hover:bg-fout-700"
            >
              Ja, verwijder
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onToggle}
              className="rounded-lg border border-ink-300 px-2.5 py-1 font-semibold text-basis dark:border-ink-600"
            >
              {plan.active ? "Pauzeer" : "Activeer"}
            </button>
            <button
              onClick={onEdit}
              className="rounded-lg border border-ink-300 px-2.5 py-1 font-semibold text-basis dark:border-ink-600"
            >
              Bewerk
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="rounded-lg px-2.5 py-1 font-semibold text-fout-600 hover:bg-fout-100 dark:text-fout-400 dark:hover:bg-fout-600/20"
            >
              Verwijder
            </button>
          </>
        )}
      </div>
    </li>
  );
}
