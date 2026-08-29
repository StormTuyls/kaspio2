import { useMemo, useState } from "react";
import type { AuditEntityType, AuditEntry } from "../types";
import { formatDateTime } from "../storage";
import { useConfirm } from "../components/ConfirmDialog";
import { Avatar } from "./Overview";

type Filter = "all" | AuditEntityType;

type Props = {
  entries: AuditEntry[];
  onClear: () => void;
};

export function AuditView({ entries, onClear }: Props) {
  const confirm = useConfirm();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.entityType === filter)),
    [entries, filter],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink-600 dark:text-ink-500">
            Organisatie
          </p>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Activiteit</h1>
          <p className="mt-1 text-sm text-ink-700 dark:text-ink-500">
            Wie wijzigde wat, en wanneer. Laatste {entries.length} gebeurtenissen.
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={async () => {
              if (await confirm({ title: "Volledige activiteitenlog wissen?", confirmLabel: "Wissen", danger: true }))
                onClear();
            }}
            className="btn-secondary text-sm"
          >
            Log wissen
          </button>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 px-5 py-3 dark:border-ink-800/60">
          {(["all", "pot", "transaction", "member", "settings"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === f
                  ? "bg-ink-950 text-white dark:bg-white dark:text-ink-900"
                  : "text-ink-700 hover:bg-ink-50 dark:text-ink-500 dark:hover:bg-ink-900"
              }`}
            >
              {labelFor(f)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="mb-1 text-base font-semibold text-ink-900 dark:text-ink-100">
              Niets te tonen
            </p>
            <p className="text-sm text-ink-700 dark:text-ink-500">
              {entries.length === 0
                ? "Zodra er iets gebeurt, verschijnt het hier."
                : "Geen gebeurtenissen die overeenkomen met je filter."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-200 dark:divide-ink-800/60">
            {filtered.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-5 py-4">
                <Avatar name={e.actorName} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-semibold text-ink-900 dark:text-ink-100">
                      {e.actorName}
                    </span>
                    <span className="text-sm text-ink-700 dark:text-ink-500">
                      {actionVerb(e)} <EntityChip type={e.entityType} /> "
                      <span className="font-medium text-ink-800 dark:text-ink-200">
                        {e.entityName}
                      </span>
                      "
                    </span>
                  </div>
                  {e.details && (
                    <p className="mt-0.5 text-sm text-ink-700 dark:text-ink-600">{e.details}</p>
                  )}
                </div>
                <span className="whitespace-nowrap text-xs text-ink-600 dark:text-ink-600">
                  {formatDateTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function labelFor(f: Filter): string {
  switch (f) {
    case "all":
      return "Alles";
    case "pot":
      return "Potjes";
    case "transaction":
      return "Transacties";
    case "member":
      return "Leden";
    case "settings":
      return "Instellingen";
  }
}

function actionVerb(e: AuditEntry): string {
  if (e.action === "created") return "maakte";
  if (e.action === "updated") return "wijzigde";
  return "verwijderde";
}

function EntityChip({ type }: { type: AuditEntityType }) {
  const styles: Record<AuditEntityType, string> = {
    pot: "bg-in-100 text-in-600 dark:bg-in-700/30 dark:text-in-400",
    transaction: "bg-ink-100 text-ink-800 dark:bg-ink-800/30 dark:text-ink-600",
    member: "bg-ink-50 text-ink-800 dark:bg-ink-900 dark:text-ink-200",
    settings: "bg-uit-100 text-uit-700 dark:bg-uit-700/30 dark:text-uit-400",
  };
  const labels: Record<AuditEntityType, string> = {
    pot: "potje",
    transaction: "transactie in",
    member: "lid",
    settings: "instelling",
  };
  return (
    <span className={`mx-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}
