import { useEffect, useState } from "react";
import {
  calcBalance,
  formatEuro,
  groupBalance,
  loadCollapsedGroups,
  potsInGroup,
  rootGroups,
  saveCollapsedGroups,
  subGroups,
  ungroupedPots,
} from "../storage";
import type { Pot, PotGroup, Transaction } from "../types";
import { UpgradeHint } from "../components/UpgradeHint";
import { useConfirm } from "../components/ConfirmDialog";

/** Waarde in de <select> die "geen hoofdgroep, dit is er zelf een" betekent. */
const ROOT = "__root__";

type Props = {
  /** Nodig om de ingeklapte stand per organisatie te bewaren. */
  orgId: string;
  groups: PotGroup[];
  pots: Pot[];
  allTransactions: Transaction[];
  isAdmin: boolean;
  /** Potgroepen zijn een Team-feature; anders enkel een upgrade-aanzet. */
  canUseGroups: boolean;
  onUpgrade?: () => void;
  onCreateGroup: (
    name: string,
    parentId?: string | null,
  ) => Promise<{ error: string | null }>;
  onUpdateGroup: (
    id: string,
    patch: { name?: string; parentId?: string | null },
  ) => Promise<{ error: string | null }>;
  onDeleteGroup: (id: string) => Promise<{ error: string | null }>;
  onSelectPot: (potId: string) => void;
  /** Open het dashboard van één groep. */
  onOpenGroup?: (groupId: string) => void;
};

export function GroupsView({
  orgId,
  groups,
  pots,
  allTransactions,
  isAdmin,
  canUseGroups,
  onUpgrade,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onSelectPot,
  onOpenGroup,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState<string>(ROOT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roots = rootGroups(groups);
  const ungrouped = ungroupedPots(pots, groups);

  // Ingeklapte kaarten. Een dichtgeklapte hoofdgroep verbergt haar potjes én
  // haar subgroepen; je houdt de kop met het bloktotaal over. Met veertien
  // comités en honderdtwintig posten is dat het verschil tussen een pagina die
  // je overziet en een die je moet doorscrollen.
  //
  // Eigen sleutel, los van de zijbalk: daar klap je in om ruimte te maken, hier
  // om overzicht te houden, en dat zijn twee verschillende beslissingen.
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    loadCollapsedGroups(`groepen:${orgId}`),
  );
  useEffect(() => {
    setCollapsed(loadCollapsedGroups(`groepen:${orgId}`));
  }, [orgId]);

  function persist(next: Set<string>) {
    saveCollapsedGroups(`groepen:${orgId}`, next);
    setCollapsed(next);
  }
  const toggle = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persist(next);
  };
  // "Alles" kijkt alleen naar de hoofdgroepen: als er nog één openstaat, klapt
  // de knop alles dicht. Anders zou hij bij een half opengeklapte pagina niets
  // zichtbaars doen.
  const anyOpen = roots.some((g) => !collapsed.has(g.id));
  const toggleAll = () =>
    persist(anyOpen ? new Set(groups.map((g) => g.id)) : new Set());

  async function submitNew() {
    setError(null);
    const name = newName.trim();
    if (!name) {
      setError("Geef de groep een naam.");
      return;
    }
    setBusy(true);
    const res = await onCreateGroup(name, newParent === ROOT ? null : newParent);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNewName("");
    setNewParent(ROOT);
    setCreating(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Groepen</h1>
        <div className="flex items-center gap-2">
          {roots.length > 1 && (
            <button onClick={toggleAll} className="btn-secondary text-sm">
              {anyOpen ? "Alles inklappen" : "Alles uitklappen"}
            </button>
          )}
          {isAdmin && canUseGroups && !creating && (
            <button onClick={() => setCreating(true)} className="btn-accent text-sm">
              + Nieuwe groep
            </button>
          )}
        </div>
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
        aan een groep bij het aanmaken of bewerken van het potje. Hoort er nog
        een laag tussen, bijvoorbeeld een comité met blokken eronder, dan hang je
        een groep onder een andere. Dieper dan twee niveaus gaat niet.
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
          <select
            value={newParent}
            onChange={(e) => setNewParent(e.target.value)}
            className="input sm:w-52"
            aria-label="Hoofdgroep"
          >
            <option value={ROOT}>Hoofdgroep</option>
            {roots.map((g) => (
              <option key={g.id} value={g.id}>
                Onder {g.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCreating(false);
                setNewName("");
                setNewParent(ROOT);
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
        // Bewust geen twee kolommen meer: een hoofdgroep met haar subgroepen
        // eronder is één blok, en dat naast elkaar zetten maakt niet duidelijk
        // wat waaronder hangt.
        <div className="space-y-5">
          {roots.map((g) => {
            const children = subGroups(groups, g.id);
            const open = !collapsed.has(g.id);
            return (
              <div key={g.id}>
                <GroupCard
                  group={g}
                  pots={potsInGroup(pots, groups, g.id)}
                  balance={groupBalance(allTransactions, pots, groups, g.id)}
                  allTransactions={allTransactions}
                  childCount={children.length}
                  roots={roots}
                  isAdmin={isAdmin}
                  open={open}
                  onToggle={() => toggle(g.id)}
                  onUpdate={onUpdateGroup}
                  onDelete={onDeleteGroup}
                  onSelectPot={onSelectPot}
                  onOpen={onOpenGroup ? () => onOpenGroup(g.id) : undefined}
                />
                {open && children.length > 0 && (
                  <div className="ml-4 mt-3 space-y-3 border-l-2 border-navy-100 pl-4 dark:border-navy-700/60">
                    {children.map((c) => (
                      <GroupCard
                        key={c.id}
                        group={c}
                        pots={potsInGroup(pots, groups, c.id)}
                        balance={groupBalance(allTransactions, pots, groups, c.id)}
                        allTransactions={allTransactions}
                        childCount={0}
                        roots={roots}
                        isAdmin={isAdmin}
                        open={!collapsed.has(c.id)}
                        onToggle={() => toggle(c.id)}
                        onUpdate={onUpdateGroup}
                        onDelete={onDeleteGroup}
                        onSelectPot={onSelectPot}
                        onOpen={onOpenGroup ? () => onOpenGroup(c.id) : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
  allTransactions,
  childCount,
  roots,
  isAdmin,
  open,
  onToggle,
  onUpdate,
  onDelete,
  onSelectPot,
  onOpen,
}: {
  group: PotGroup;
  /** Alleen de eigen potjes; de subgroepen krijgen hun eigen kaart. */
  pots: Pot[];
  /** Saldo inclusief subgroepen, dus voor een hoofdgroep het bloktotaal. */
  balance: number;
  allTransactions: Transaction[];
  childCount: number;
  roots: PotGroup[];
  isAdmin: boolean;
  /** Dicht = alleen de kop met het totaal. Bij een hoofdgroep ook zonder haar subgroepen. */
  open: boolean;
  onToggle: () => void;
  onUpdate: (
    id: string,
    patch: { name?: string; parentId?: string | null },
  ) => Promise<{ error: string | null }>;
  onDelete: (id: string) => Promise<{ error: string | null }>;
  onSelectPot: (potId: string) => void;
  onOpen?: () => void;
}) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [busy, setBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const isSub = !!group.parentId;
  // Een groep met subgroepen kan er zelf niet onder hangen: dat zou drie
  // niveaus geven en de databank weigert het (check_group_depth).
  const canMove = childCount === 0;

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === group.name) {
      setEditing(false);
      setName(group.name);
      return;
    }
    setBusy(true);
    const res = await onUpdate(group.id, { name: trimmed });
    setBusy(false);
    if (res.error) {
      setName(group.name);
    }
    setEditing(false);
  }

  async function move(value: string) {
    setMoveError(null);
    setBusy(true);
    const res = await onUpdate(group.id, {
      parentId: value === ROOT ? null : value,
    });
    setBusy(false);
    if (res.error) setMoveError(res.error);
  }

  async function remove() {
    const message =
      childCount > 0
        ? `De ${childCount} subgroep${childCount > 1 ? "en" : ""} blijven bestaan en komen bovenaan te staan. De potjes blijven waar ze zitten.`
        : "De potjes blijven bestaan en worden groepsloos.";
    if (
      !(await confirm({
        title: `Groep "${group.name}" verwijderen?`,
        message,
        confirmLabel: "Verwijderen",
        danger: true,
      }))
    )
      return;
    await onDelete(group.id);
  }

  return (
    <div className="card flex flex-col p-4">
      <div className={`flex items-start justify-between gap-2 ${open ? "mb-3" : ""}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${group.name} ${open ? "inklappen" : "uitklappen"}`}
          className="mt-0.5 flex-shrink-0 rounded p-1 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700 dark:hover:bg-navy-800 dark:hover:text-white"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${open ? "rotate-90" : ""}`}
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
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
            <h3
              className={`truncate font-bold text-navy-900 dark:text-white ${
                isSub ? "text-sm" : "text-base"
              }`}
            >
              {group.name}
            </h3>
            <span className="rounded-full bg-navy-100 px-1.5 text-[11px] font-semibold text-navy-500 dark:bg-navy-800 dark:text-navy-300">
              {pots.length}
            </span>
            {childCount > 0 && (
              <span className="text-[11px] font-medium text-navy-400">
                + {childCount} subgroep{childCount > 1 ? "en" : ""}
              </span>
            )}
            {onOpen && (
              <span className="text-xs font-medium text-teal-600 dark:text-teal-400">→</span>
            )}
          </button>
        )}
        <span className="flex-shrink-0 text-base font-bold tabular-nums text-navy-900 dark:text-navy-50">
          {formatEuro(balance)}
        </span>
      </div>

      {open &&
        (pots.length === 0 ? (
          <p className="text-sm text-navy-400 dark:text-navy-400">
            {childCount > 0
              ? "Geen potjes rechtstreeks in deze groep; ze zitten in de subgroepen."
              : "Nog geen potjes in deze groep."}
          </p>
        ) : (
          <ul className="-mx-1.5 divide-y divide-navy-100 dark:divide-navy-700/60">
            {pots.map((p) => (
              <PotRow
                key={p.id}
                pot={p}
                balance={calcBalance(allTransactions, p.id)}
                onSelect={() => onSelectPot(p.id)}
              />
            ))}
          </ul>
        ))}

      {open && isAdmin && !editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy-100 pt-3 dark:border-navy-700/60">
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
          <select
            value={group.parentId ?? ROOT}
            onChange={(e) => move(e.target.value)}
            disabled={busy || !canMove}
            className="input ml-auto w-auto py-1 text-xs disabled:opacity-50"
            aria-label={`Hoofdgroep van ${group.name}`}
            title={
              canMove
                ? "Onder welke hoofdgroep hangt deze groep?"
                : "Een groep met subgroepen kan er zelf niet onder hangen."
            }
          >
            <option value={ROOT}>Hoofdgroep</option>
            {roots
              .filter((r) => r.id !== group.id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  Onder {r.name}
                </option>
              ))}
          </select>
        </div>
      )}
      {moveError && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{moveError}</p>
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
