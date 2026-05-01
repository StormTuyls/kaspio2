import { calcBalance, formatEuro } from "../storage";
import type { Member, Pot, Transaction } from "../types";

type Props = {
  pots: Pot[];
  allTransactions: Transaction[];
  members: Member[];
  currentUser: Member;
  onSelect: (id: string) => void;
  onAddPot: () => void;
};

export function Overview({
  pots,
  allTransactions,
  members,
  currentUser,
  onSelect,
  onAddPot,
}: Props) {
  const visibleIds = new Set(pots.map((p) => p.id));
  const txInScope = allTransactions.filter((t) => visibleIds.has(t.potId));
  const total = txInScope.reduce(
    (sum, t) => sum + (t.direction === "in" ? t.amount : -t.amount),
    0,
  );
  const memberById = new Map(members.map((m) => [m.id, m] as const));
  const isAdmin = currentUser.role === "admin";

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label={isAdmin ? "Totaal saldo" : "Mijn saldo"}
          value={formatEuro(total)}
          accent="emerald"
        />
        <Stat
          label={isAdmin ? "Aantal potjes" : "Mijn potjes"}
          value={pots.length.toString()}
          accent="indigo"
        />
        <Stat label="Transacties" value={txInScope.length.toString()} accent="slate" />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {isAdmin ? "Alle potjes" : "Mijn potjes"}
        </h2>
        {isAdmin && (
          <button onClick={onAddPot} className="btn-primary">
            + Nieuw potje
          </button>
        )}
      </div>

      {pots.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="mb-1 text-lg font-medium text-gray-700">
            {isAdmin ? "Nog geen potjes" : "Je hebt nog geen potjes"}
          </p>
          <p className="mb-5 text-sm text-gray-500">
            {isAdmin
              ? "Maak je eerste potje aan om geldstromen te organiseren."
              : "Vraag de admin om je een potje toe te wijzen."}
          </p>
          {isAdmin && (
            <button onClick={onAddPot} className="btn-primary">
              + Eerste potje aanmaken
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pots.map((pot) => {
            const balance = calcBalance(allTransactions, pot.id);
            const txCount = allTransactions.filter((t) => t.potId === pot.id).length;
            const owner = memberById.get(pot.ownerId);
            const progress =
              pot.targetAmount && pot.targetAmount > 0
                ? Math.min(100, (balance / pot.targetAmount) * 100)
                : null;

            return (
              <button
                key={pot.id}
                onClick={() => onSelect(pot.id)}
                className="group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
              >
                <div className="mb-1 flex items-start justify-between">
                  <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-700">
                    {pot.name}
                  </h3>
                  <span className="text-gray-300 group-hover:text-indigo-400">→</span>
                </div>
                <p className="mb-4 text-sm text-gray-500">
                  {owner?.name ?? "Geen verantwoordelijke"}
                </p>
                <div className="text-2xl font-bold text-gray-900">{formatEuro(balance)}</div>
                {progress !== null && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-gray-500">
                      <span>Doel: {formatEuro(pot.targetAmount!)}</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="mt-3 text-xs text-gray-400">
                  {txCount} transactie{txCount === 1 ? "" : "s"}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "emerald" | "indigo" | "slate";
}) {
  const colors = {
    emerald: "text-emerald-700",
    indigo: "text-indigo-700",
    slate: "text-slate-700",
  };
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${colors[accent]}`}>{value}</p>
    </div>
  );
}
