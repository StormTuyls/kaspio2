import { useState } from "react";
import { calcBalance, formatEuro } from "../storage";
import type { Pot, PotGroup, Transaction } from "../types";
import { UpgradeHint } from "../components/UpgradeHint";

type Props = {
  groups: PotGroup[];
  pots: Pot[];
  allTransactions: Transaction[];
  isAdmin: boolean;
  /** Potgroepen zijn een Team-feature; anders enkel een upgrade-aanzet. */
  canUseGroups: boolean;
  onUpgrade?: () => void;
  onCreateGroup: (name: string) => Promise<{ error: string | null }>;
  onRenameGroup: (id: string, name: string) => Promise<{ error: string | null }>;
  onDeleteGroup: (id: string) => Promise<{ error: string | null }>;
  onSelectPot: (potId: string) => void;
  /** Open het dashboard van één groep. */
  onOpenGroup?: (groupId: string) => void;
};

export function GroupsView({
  groups,
  pots,
  allTransactions,
  isAdmin,
  canUseGroups,
  onUpgrade,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onSelectPot,
  onOpenGroup,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupBalance = (gp: Pot[]) =>
    gp.reduce((s, p) => s + calcBalance(allTransactions, p.id), 0);

  const ungrouped = pots.filter(
    (p) => !p.groupId || !groups.some((g) => g.id === p.groupId),
  );

  async function submitNew() {
    setError(null);
    const name = newName.trim();
    if (!name) {
      setError("Geef de groep een naam.");
      return;
    }
    setBusy(true);
    const res = await onCreateGroup(name);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNewName("");
    setCreating(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Groepen</h1>
        {isAdmin && canUseGroups && !creating && (
          <button onClick={() => setCreating(true)} className="btn-accent text-sm">
            + Nieuwe groep
          </button>
        )}
      </div>

      {!canUseGroups && (
        <UpgradeHint
          badge="Team"
          title="Potgroepen"
          description="Bundel je potjes per tak, ploeg of werkgroep. Beschikbaar in het Team-plan."
          onUpgrade={onUpgrade}
        />
      )}

      <p className="text-sm text-navy-500 dark:text-navy-300">
        Groepen bundelen potjes per tak, ploeg of werkgroep. Een potje koppel je
        aan een groep bij het aanmaken of bewerken van het potje.
      </p>

      {isAdmin && creating && (
        <div className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNew()}
            placeholder="Bijv. Welpen, U12, Werkgroep Kerst"
            maxLength={80}
            className="input flex-1"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCreating(false);
                setNewName("");
                setError(null);
              }}
              className="btn-secondary text-sm"
              disabled={busy}
            >
              Annuleren
            </button>
            <button onClick={submitNew} className="btn-accent text-sm" disabled={busy}>
              {busy ? "Bezig…" : "Aanmaken"}
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card border-dashed py-12 text-center text-sm text-navy-500 dark:text-navy-300">
          Nog geen groepen.{" "}
          {isAdmin ? "Maak er een aan om je potjes te bundelen." : ""}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              pots={pots.filter((p) => p.groupId === g.id)}
              balance={groupBalance}
              isAdmin={isAdmin}
              onRename={onRenameGroup}
              onDelete={onDeleteGroup}
              onSelectPot={onSelectPot}
              onOpen={onOpenGroup ? () => onOpenGroup(g.id) : undefined}
            />
          ))}
        </div>
      )}

      {ungrouped.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
            Niet in een groep
          </h2>
          <div className="card divide-y divide-navy-100 dark:divide-navy-700/60">
            {ungrouped.map((p) => (
              <PotRow
                key={p.id}
                pot={p}
                balance={calcBalance(allTransactions, p.id)}
                onSelect={() => onSelectPot(p.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group,
  pots,
  balance,
  isAdmin,
  onRename,
  onDelete,
  onSelectPot,
  onOpen,
}: {
  group: PotGroup;
  pots: Pot[];
  balance: (gp: Pot[]) => number;
  isAdmin: boolean;
  onRename: (id: string, name: string) => Promise<{ error: string | null }>;
  onDelete: (id: string) => Promise<{ error: string | null }>;
  onSelectPot: (potId: string) => void;
  onOpen?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [busy, setBusy] = useState(false);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === group.name) {
      setEditing(false);
      setName(group.name);
      return;
    }
    setBusy(true);
    const res = await onRename(group.id, trimmed);
    setBusy(false);
    if (res.error) {
      setName(group.name);
    }
    setEditing(false);
  }

  async function remove() {
    if (
      !window.confirm(
        `Groep "${group.name}" verwijderen? De potjes blijven bestaan en worden groepsloos.`,
      )
    )
      return;
    await onDelete(group.id);
  }

  return (
    <div className="card flex flex-col p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") {
                setName(group.name);
                setEditing(false);
              }
            }}
            maxLength={80}
            disabled={busy}
            className="input py-1 text-sm font-semibold"
          />
        ) : (
          <button
            type="button"
            onClick={onOpen}
            disabled={!onOpen}
            className="flex min-w-0 items-baseline gap-2 text-left enabled:hover:text-teal-700 dark:enabled:hover:text-teal-300"
          >
            <h3 className="truncate text-base font-bold text-navy-900 dark:text-white">
              {group.name}
            </h3>
            <span className="rounded-full bg-navy-100 px-1.5 text-[11px] font-semibold text-navy-500 dark:bg-navy-800 dark:text-navy-300">
              {pots.length}
            </span>
            {onOpen && (
              <span className="text-xs font-medium text-teal-600 dark:text-teal-400">→</span>
            )}
          </button>
        )}
        <span className="flex-shrink-0 text-base font-bold tabular-nums text-navy-900 dark:text-navy-50">
          {formatEuro(balance(pots))}
        </span>
      </div>

      {pots.length === 0 ? (
        <p className="text-sm text-navy-400 dark:text-navy-400">
          Nog geen potjes in deze groep.
        </p>
      ) : (
        <ul className="-mx-1.5 divide-y divide-navy-100 dark:divide-navy-700/60">
          {pots.map((p) => (
            <PotRow
              key={p.id}
              pot={p}
              balance={balance([p])}
              onSelect={() => onSelectPot(p.id)}
            />
          ))}
        </ul>
      )}

      {isAdmin && !editing && (
        <div className="mt-3 flex gap-2 border-t border-navy-100 pt-3 dark:border-navy-700/60">
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-navy-500 hover:text-navy-900 dark:text-navy-300 dark:hover:text-white"
          >
            Hernoemen
          </button>
          <button
            onClick={remove}
            className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
          >
            Verwijderen
          </button>
        </div>
      )}
    </div>
  );
}

function PotRow({
  pot,
  balance,
  onSelect,
}: {
  pot: Pot;
  balance: number;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="flex w-full items-center gap-2 px-1.5 py-2 text-left text-sm transition hover:bg-canvas dark:hover:bg-navy-800"
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: pot.color ?? "#1D9E75" }}
      />
      <span className="min-w-0 flex-1 truncate text-navy-700 dark:text-navy-200">
        {pot.name}
      </span>
      <span className="flex-shrink-0 tabular-nums font-medium text-navy-600 dark:text-navy-300">
        {formatEuro(balance)}
      </span>
    </button>
  );
}
