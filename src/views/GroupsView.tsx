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
  /** Open het potjesformulier met deze groep al ingevuld. */
  onAddPot?: (groupId: string) => void;
  /** false = potjeslimiet bereikt, dan wordt "+ Potje" een upgrade-aanzet. */
  canAddPot?: boolean;
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
  onAddPot,
  canAddPot = true,
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
        <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Groepen</h1>
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

      <p className="text-sm text-ink-700 dark:text-ink-500">
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
        <div className="rounded-lg border border-fout-100 bg-fout-100 px-3 py-2 text-sm text-fout-600">
          {error}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card border-dashed py-12 text-center text-sm text-ink-700 dark:text-ink-500">
          Nog geen groepen.{" "}
          {isAdmin ? "Maak er een aan om je potjes te bundelen." : ""}
        </div>
      ) : (
        // Twee kolommen, waarbij één cel het hele blok is: de hoofdgroep met
        // haar subgroepen eronder. Eén kolom werd bij veertien comités een
        // scrollijst waarin je niets meer terugvindt.
        //
        // items-start, anders rekt elke kaart uit tot de hoogte van de langste
        // op dezelfde rij en lijkt een groep met twee potjes even groot als een
        // comité met vijftien.
        <div className="grid items-start gap-5 sm:grid-cols-2">
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
                  canUseGroups={canUseGroups}
                  open={open}
                  onToggle={() => toggle(g.id)}
                  onUpdate={onUpdateGroup}
                  onDelete={onDeleteGroup}
                  onSelectPot={onSelectPot}
                  onOpen={onOpenGroup ? () => onOpenGroup(g.id) : undefined}
                  onAddPot={
                    onAddPot ? () => onAddPot(g.id) : undefined
                  }
                  canAddPot={canAddPot}
                  onUpgrade={onUpgrade}
                  onCreateSub={(naam) => onCreateGroup(naam, g.id)}
                />
                {open && children.length > 0 && (
                  <div className="ml-4 mt-3 space-y-3 border-l-2 border-ink-200 pl-4 dark:border-ink-800/60">
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
                        canUseGroups={canUseGroups}
                        open={!collapsed.has(c.id)}
                        onToggle={() => toggle(c.id)}
                        onUpdate={onUpdateGroup}
                        onDelete={onDeleteGroup}
                        onSelectPot={onSelectPot}
                        onOpen={onOpenGroup ? () => onOpenGroup(c.id) : undefined}
                        onAddPot={
                          onAddPot ? () => onAddPot(c.id) : undefined
                        }
                        canAddPot={canAddPot}
                        onUpgrade={onUpgrade}
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
          <h2 className="mb-2 text-sm font-bold text-ink-600">
            Niet in een groep
          </h2>
          <div className="card divide-y divide-ink-200 dark:divide-ink-800/60">
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
  canUseGroups,
  open,
  onToggle,
  onUpdate,
  onDelete,
  onSelectPot,
  onOpen,
  onAddPot,
  canAddPot,
  onUpgrade,
  onCreateSub,
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
  canUseGroups: boolean;
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
  onAddPot?: () => void;
  canAddPot: boolean;
  onUpgrade?: () => void;
  /** Alleen op een hoofdgroep: een subgroep hieronder aanmaken. */
  onCreateSub?: (name: string) => Promise<{ error: string | null }>;
}) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [busy, setBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [subName, setSubName] = useState<string | null>(null);
  const [subError, setSubError] = useState<string | null>(null);

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

  async function submitSub() {
    const naam = (subName ?? "").trim();
    if (!naam) {
      setSubError("Geef de subgroep een naam.");
      return;
    }
    setSubError(null);
    setBusy(true);
    const res = await onCreateSub!(naam);
    setBusy(false);
    if (res.error) {
      setSubError(res.error);
      return;
    }
    setSubName(null);
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
        {/* Pijltje en naam horen als één ding links te staan; zonder deze
            wrapper verdeelt justify-between de ruimte over drie kinderen en
            zweeft de naam in het midden van de kaart. */}
        <div className="flex min-w-0 flex-1 items-start gap-1">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={`${group.name} ${open ? "inklappen" : "uitklappen"}`}
            className="mt-0.5 flex-shrink-0 rounded p-1 text-ink-600 transition hover:bg-ink-50 hover:text-ink-800 dark:hover:bg-ink-900 dark:hover:text-white"
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
              className="flex min-w-0 items-baseline gap-2 text-left enabled:hover:text-in-700 dark:enabled:hover:text-in-400"
            >
              <h3
                className={`truncate font-bold text-ink-900 dark:text-white ${
                  isSub ? "text-sm" : "text-base"
                }`}
              >
                {group.name}
              </h3>
              <span className="rounded-full bg-ink-100 px-1.5 text-[11px] font-semibold text-ink-700 dark:bg-ink-900 dark:text-ink-500">
                {pots.length}
              </span>
              {childCount > 0 && (
                <span className="text-[11px] font-medium text-ink-600">
                  + {childCount} subgroep{childCount > 1 ? "en" : ""}
                </span>
              )}
              {onOpen && (
                <span className="text-xs font-medium text-in-600 dark:text-in-400">→</span>
              )}
            </button>
          )}
        </div>
        <span className="flex-shrink-0 text-base font-bold tabular-nums text-ink-900 dark:text-ink-100">
          {formatEuro(balance)}
        </span>
      </div>

      {open &&
        (pots.length === 0 ? (
          <p className="text-sm text-ink-600 dark:text-ink-600">
            {childCount > 0
              ? "Geen potjes rechtstreeks in deze groep; ze zitten in de subgroepen."
              : "Nog geen potjes in deze groep."}
          </p>
        ) : (
          <ul className="-mx-1.5 divide-y divide-ink-200 dark:divide-ink-800/60">
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
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-200 pt-3 dark:border-ink-800/60">
          {onAddPot && (
            <button
              onClick={canAddPot ? onAddPot : onUpgrade}
              className="text-xs font-semibold text-in-700 hover:underline dark:text-in-400"
            >
              {canAddPot ? "+ Potje" : "Upgrade voor meer potjes"}
            </button>
          )}
          {/* Alleen op een hoofdgroep: dieper dan twee niveaus kan niet. */}
          {onCreateSub && canUseGroups && subName === null && (
            <button
              onClick={() => {
                setSubName("");
                setSubError(null);
              }}
              className="text-xs font-semibold text-in-700 hover:underline dark:text-in-400"
            >
              + Subgroep
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-ink-700 hover:text-ink-900 dark:text-ink-500 dark:hover:text-white"
          >
            Hernoemen
          </button>
          <button
            onClick={remove}
            className="text-xs font-medium text-fout-600 hover:underline dark:text-fout-400"
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
        <p className="mt-2 text-xs text-fout-600 dark:text-fout-400">{moveError}</p>
      )}

      {subName !== null && (
        <div className="mt-3 border-t border-ink-200 pt-3 dark:border-ink-800/60">
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSub();
                if (e.key === "Escape") {
                  setSubName(null);
                  setSubError(null);
                }
              }}
              placeholder={`Subgroep onder ${group.name}`}
              maxLength={80}
              disabled={busy}
              className="input flex-1 py-1 text-sm"
            />
            <button
              onClick={() => {
                setSubName(null);
                setSubError(null);
              }}
              className="btn-secondary px-2 py-1 text-xs"
              disabled={busy}
            >
              Annuleren
            </button>
            <button
              onClick={submitSub}
              className="btn-accent px-2 py-1 text-xs"
              disabled={busy}
            >
              {busy ? "Bezig…" : "Aanmaken"}
            </button>
          </div>
          {subError && (
            <p className="mt-2 text-xs text-fout-600 dark:text-fout-400">{subError}</p>
          )}
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
      className="flex w-full items-center gap-2 px-1.5 py-2 text-left text-sm transition hover:bg-ink-50 dark:hover:bg-ink-900"
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: pot.color ?? "#1D9E75" }}
      />
      <span className="min-w-0 flex-1 truncate text-ink-800 dark:text-ink-300">
        {pot.name}
      </span>
      <span className="flex-shrink-0 tabular-nums font-medium text-ink-700 dark:text-ink-500">
        {formatEuro(balance)}
      </span>
    </button>
  );
}
