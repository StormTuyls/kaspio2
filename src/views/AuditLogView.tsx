import type { AuditRow } from "../data";

type Props = {
  entries: AuditRow[];
  loading: boolean;
};

export function AuditLogView({ entries, loading }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-navy-100 bg-white p-5 dark:border-navy-700 dark:bg-navy-900">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-navy-500 dark:text-navy-300">
          Activiteit ({entries.length}
          {entries.length === 100 ? "+" : ""})
        </h3>

        {loading ? (
          <p className="text-sm text-navy-400">Laden...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-navy-400">
            Nog geen activiteit. Zodra iemand een potje of transactie aanmaakt,
            zie je het hier.
          </p>
        ) : (
          <ul className="divide-y divide-navy-100 dark:divide-navy-700">
            {entries.map((e) => (
              <AuditEntry key={e.id} entry={e} />
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-navy-400">
        Toont de laatste 100 acties. Audit-spoor wordt automatisch bijgehouden
        en kan niet worden gewijzigd.
      </p>
    </div>
  );
}

function AuditEntry({ entry }: { entry: AuditRow }) {
  const { label, icon, color } = describeAction(entry);
  const detail = describeDetail(entry);

  return (
    <li className="flex items-start gap-3 py-3">
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs ${color}`}
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-navy-900 dark:text-white">
          <span className="font-semibold">{entry.actor_name}</span>{" "}
          <span className="text-navy-500 dark:text-navy-300">{label}</span>
        </div>
        {detail && (
          <div className="mt-0.5 text-xs text-navy-400">{detail}</div>
        )}
        <div className="mt-0.5 text-[11px] text-navy-400">
          {formatDateTime(entry.created_at)}
        </div>
      </div>
    </li>
  );
}

function describeAction(entry: AuditRow): {
  label: string;
  icon: string;
  color: string;
} {
  const [entity, op] = entry.action.split("_");
  const ops: Record<string, { verb: string; icon: string; color: string }> = {
    insert: {
      verb: "aangemaakt",
      icon: "+",
      color: "bg-mint-100 text-mint-700",
    },
    update: {
      verb: "bewerkt",
      icon: "✎",
      color: "bg-azure-100 text-azure-700",
    },
    delete: {
      verb: "verwijderd",
      icon: "×",
      color: "bg-rose-100 text-rose-700",
    },
  };
  const opInfo = ops[op] ?? { verb: op, icon: "·", color: "bg-navy-100" };
  const entityLabels: Record<string, string> = {
    pots: "een potje",
    transactions: "een transactie",
    memberships: "een lidmaatschap",
  };
  const entityLabel = entityLabels[entity] ?? entity;
  return {
    label: `heeft ${entityLabel} ${opInfo.verb}`,
    icon: opInfo.icon,
    color: opInfo.color,
  };
}

function describeDetail(entry: AuditRow): string | null {
  const meta = entry.metadata;
  if (!meta || typeof meta !== "object") return null;

  // Pot: toon naam
  const after = (meta as { after?: Record<string, unknown> }).after;
  const before = (meta as { before?: Record<string, unknown> }).before;

  if (entry.entity_type === "pots") {
    const name = (after?.name ?? before?.name) as string | undefined;
    return name ? `"${name}"` : null;
  }

  if (entry.entity_type === "transactions") {
    const amount = (after?.amount ?? before?.amount) as number | undefined;
    const direction = (after?.direction ?? before?.direction) as
      | "in"
      | "out"
      | undefined;
    if (amount !== undefined && direction) {
      const sign = direction === "in" ? "+" : "−";
      return `${sign}€${Number(amount).toFixed(2)}`;
    }
    return null;
  }

  if (entry.entity_type === "memberships") {
    const role = (after?.role ?? before?.role) as string | undefined;
    return role ? `Rol: ${role}` : null;
  }

  return null;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("nl-BE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
