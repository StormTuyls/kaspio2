import type { AuditRow } from "../data";

type Props = {
  entries: AuditRow[];
  loading: boolean;
};

export function AuditLogView({ entries, loading }: Props) {
  return (
    <div className="space-y-4">
      <h1 className="titel">Activiteit</h1>

      <div className="panel p-5">
        <h2 className="sectiekop mb-4">
          Alles wat er gebeurd is ({entries.length}
          {entries.length === 100 ? "+" : ""})
        </h2>

        {loading ? (
          <p className="text-sm text-zacht">Laden...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-zacht">
            Nog geen activiteit. Zodra iemand een potje of transactie aanmaakt,
            zie je het hier.
          </p>
        ) : (
          <ul className="divide-y divide-ink-200 dark:divide-ink-800">
            {entries.map((e) => (
              <AuditEntry key={e.id} entry={e} />
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-zacht">
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
        <div className="text-sm text-ink-900 dark:text-white">
          <span className="font-semibold">{entry.actor_name}</span>{" "}
          <span className="text-basis">{label}</span>
        </div>
        {detail && (
          <div className="mt-0.5 text-xs text-zacht">{detail}</div>
        )}
        <div className="mt-0.5 text-[11px] text-zacht">
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
      color: "bg-in-100 text-in-700 dark:bg-in-700/40 dark:text-in-400",
    },
    update: {
      verb: "bewerkt",
      icon: "✎",
      color: "bg-uit-100 text-uit-700 dark:bg-uit-700/40 dark:text-uit-400",
    },
    delete: {
      verb: "verwijderd",
      icon: "×",
      color: "bg-fout-100 text-fout-600 dark:bg-fout-600/40 dark:text-fout-400",
    },
  };
  const opInfo = ops[op] ?? { verb: op, icon: "·", color: "bg-ink-100" };
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
