import { useMemo, useState } from "react";
import type { AuditEntityType, AuditEntry } from "../types";
import { formatDateTime } from "../storage";
import { Avatar } from "./Overview";

type Filter = "all" | AuditEntityType;

type Props = {
  entries: AuditEntry[];
  onClear: () => void;
};

export function AuditView({ entries, onClear }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.entityType === filter)),
    [entries, filter],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
            Organisatie
          </p>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Activiteit</h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-navy-300">
            Wie wijzigde wat, en wanneer. Laatste {entries.length} gebeurtenissen.
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={() => {
              if (confirm("Volledige activiteitenlog wissen?")) onClear();
            }}
            className="btn-secondary text-sm"
          >
            Log wissen
          </button>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-navy-100 px-5 py-3 dark:border-navy-700/60">
          {(["all", "pot", "transaction", "member", "settings"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === f
                  ? "bg-navy-900 text-white dark:bg-white dark:text-navy-900"
                  : "text-navy-500 hover:bg-navy-50 dark:text-navy-300 dark:hover:bg-navy-800"
              }`}
            >
              {labelFor(f)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="mb-1 text-base font-semibold text-navy-900 dark:text-navy-50">
              Niets te tonen
            </p>
            <p className="text-sm text-navy-500 dark:text-navy-300">
              {entries.length === 0
                ? "Zodra er iets gebeurt, verschijnt het hier."
                : "Geen gebeurtenissen die overeenkomen met je filter."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-navy-100 dark:divide-navy-700/60">
            {filtered.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-5 py-4">
                <Avatar name={e.actorName} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-semibold text-navy-900 dark:text-navy-50">
                      {e.actorName}
                    </span>
                    <span className="text-sm text-navy-500 dark:text-navy-300">
                      {actionVerb(e)} <EntityChip type={e.entityType} /> "
                      <span className="font-medium text-navy-700 dark:text-navy-100">
                        {e.entityName}
                      </span>
                      "
                    </span>
                  </div>
                  {e.details && (
                    <p className="mt-0.5 text-sm text-navy-500 dark:text-navy-400">{e.details}</p>
                  )}
                </div>
                <span className="whitespace-nowrap text-xs text-navy-400 dark:text-navy-400">
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
    pot: "bg-mint-50 text-mint-700 dark:bg-mint-900/30 dark:text-mint-300",
    transaction: "bg-azure-50 text-azure-700 dark:bg-azure-900/30 dark:text-azure-300",
    member: "bg-navy-50 text-navy-700 dark:bg-navy-800 dark:text-navy-100",
    settings: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
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
