import { useEffect, useState } from "react";
import {
  calcBalance,
  calcSpent,
  formatDate,
  formatEuro,
  potsInGroup,
  rootGroups,
  ungroupedPots,
} from "../storage";
import { potProgress } from "../potProgress";
import { POT_KLEUR_STANDAARD } from "../types";
import type { Member, Pot, PotGroup, Transaction } from "../types";
import { UpgradeHint } from "../components/UpgradeHint";
import { Bedrag } from "../components/Bedrag";

type PotsViewProps = {
  pots: Pot[];
  allTransactions: Transaction[];
  members: Member[];
  currentUser: Member;
  /** Potgroepen (takken/ploegen) voor visuele groepering. */
  groups?: PotGroup[];
  /** Groep waar de sidebar naartoe wil scrollen (id, of null = ongegroepeerde). */
  focusGroupId?: string | null;
  /** Aangeroepen nadat er gescrolld is, zodat het focus-signaal gereset wordt. */
  onFocusConsumed?: () => void;
  onSelect: (id: string) => void;
  onAddPot: () => void;
  /** Org-brede transactie toevoegen (admin). */
  onAddTransaction?: () => void;
  /** Geld verplaatsen tussen potjes (admin, minstens 2 potjes). */
  onTransfer?: () => void;
  /** Open de opzet-wizard (sjablonen) vanuit de lege staat. */
  onUseTemplate?: () => void;
  /** CSV-import (Pro). Alleen aanwezig als de licentie het toelaat. */
  onImport?: () => void;
  /** Licentie: kan er nog een potje bij? Anders upgrade-prompt. */
  canAddPot?: boolean;
  potLimit?: number;
  onUpgrade?: () => void;
};

export const NONE_KEY = "__none__";

/** De Potjes-pagina: alle potjes als kaarten, gegroepeerd + inklapbaar. */
export function PotsView({
  pots,
  allTransactions,
  members,
  currentUser,
  groups = [],
  focusGroupId,
  onFocusConsumed,
  onSelect,
  onAddPot,
  onAddTransaction,
  onTransfer,
  onUseTemplate,
  onImport,
  canAddPot = true,
  potLimit,
  onUpgrade,
}: PotsViewProps) {
  const isAdmin = currentUser.role === "admin";
  const isReader = currentUser.role === "reader";
  const seesAll = isAdmin || isReader;

  const memberById = new Map(members.map((m) => [m.id, m] as const));

  // Groepeer potjes: één sectie per hoofdgroep, rest ongegroepeerd. Subgroepen
  // krijgen hier geen eigen sectie; hun potjes tellen mee in die van hun
  // hoofdgroep. Dit is het potjesoverzicht, de opdeling in blokken staat op de
  // groepenpagina.
  const groupSections = rootGroups(groups)
    .map((g) => ({ group: g, pots: potsInGroup(pots, groups, g.id, true) }))
    .filter((s) => s.pots.length > 0);
  const ungrouped = ungroupedPots(pots, groups);
  const hasGroups = groupSections.length > 0;

  const sumBalance = (groupPots: Pot[]) =>
    groupPots.reduce((sum, p) => sum + calcBalance(allTransactions, p.id), 0);

  // Inklapbare groep-secties: ingeklapte ids in een Set.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Navigatie vanuit sidebar/dashboard: scroll naar de groep + klap 'm open.
  useEffect(() => {
    if (focusGroupId === undefined) return;
    const key = focusGroupId === null ? NONE_KEY : focusGroupId;
    setCollapsed((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    const el = document.getElementById(`grp-${key}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    onFocusConsumed?.();
  }, [focusGroupId, onFocusConsumed]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="titel">
          {seesAll ? "Alle potjes" : "Mijn potjes"}
        </h1>
        {/* Vier gelijkwaardige knoppen kostten op een telefoon twee volle
            regels, samen bijna 190px voordat je een potje zag. Nu staat de
            primaire actie apart en delen de drie hulpacties er één, kleiner.
            De hiërarchie is meteen ook eerlijker: aanmaken is wat je hier komt
            doen, importeren doe je één keer. */}
        {isAdmin && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="flex min-w-0 flex-1 gap-1.5 sm:flex-none">
              {onImport && (
                <button
                  onClick={onImport}
                  className="btn-ghost min-w-0 truncate px-2.5 text-[0.8125rem] sm:px-3.5 sm:text-sm"
                >
                  Importeer CSV
                </button>
              )}
              {onAddTransaction && (
                <button
                  onClick={onAddTransaction}
                  className="btn-ghost min-w-0 truncate px-2.5 text-[0.8125rem] sm:px-3.5 sm:text-sm"
                >
                  + Transactie
                </button>
              )}
              {onTransfer && (
                <button
                  onClick={onTransfer}
                  className="btn-ghost min-w-0 truncate px-2.5 text-[0.8125rem] sm:px-3.5 sm:text-sm"
                >
                  Verplaats
                </button>
              )}
            </div>
            {canAddPot ? (
              <button onClick={onAddPot} className="btn-primary flex-shrink-0 text-sm">
                + Nieuw potje
              </button>
            ) : (
              <button onClick={onUpgrade} className="btn-primary flex-shrink-0 text-sm">
                Upgrade
              </button>
            )}
          </div>
        )}
      </div>

      {isAdmin && !canAddPot && potLimit !== undefined && (
        <UpgradeHint
          compact
          title={`Je hebt het maximum van ${potLimit} potjes bereikt`}
          description="Upgrade naar Pro voor onbeperkt potjes."
          onUpgrade={onUpgrade}
        />
      )}

      {pots.length === 0 ? (
        <div className="card border-dashed py-14 text-center">
          <p className="mb-1 text-base font-semibold text-sterk">
            {isAdmin ? "Nog geen potjes" : "Je hebt nog geen potjes"}
          </p>
          <p className="mb-5 text-sm text-basis">
            {isAdmin
              ? "Maak je eerste potje aan om geldstromen te organiseren."
              : "Vraag de admin om je een potje toe te wijzen."}
          </p>
          {isAdmin && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {onUseTemplate && (
                <button onClick={onUseTemplate} className="btn-accent">
                  Kies een sjabloon
                </button>
              )}
              <button
                onClick={onAddPot}
                className={onUseTemplate ? "btn-secondary" : "btn-accent"}
              >
                + Eerste potje aanmaken
              </button>
            </div>
          )}
        </div>
      ) : !hasGroups ? (
        <div className="border-t border-ink-200 dark:border-ink-800">
          {pots.map((pot) => (
            <PotCard
              key={pot.id}
              pot={pot}
              owner={memberById.get(pot.ownerId)}
              transactions={allTransactions}
              onSelect={() => onSelect(pot.id)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {[
            ...groupSections.map((s) => ({
              key: s.group.id,
              label: s.group.name,
              secPots: s.pots,
              muted: false,
            })),
            ...(ungrouped.length > 0
              ? [{ key: NONE_KEY, label: "Overige potjes", secPots: ungrouped, muted: true }]
              : []),
          ].map(({ key, label, secPots, muted }) => {
            const isCollapsed = collapsed.has(key);
            return (
              <section
                key={key}
                id={`grp-${key}`}
                className="scroll-mt-24 rounded-md border border-ink-200 bg-white/40 p-2 dark:border-ink-800/60 dark:bg-ink-950/30"
              >
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-ink-50 dark:hover:bg-ink-900/50"
                  aria-expanded={!isCollapsed}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`flex-shrink-0 text-ink-600 transition-transform ${
                        isCollapsed ? "" : "rotate-90"
                      }`}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <h3
                      className={`truncate text-[0.9375rem] font-semibold ${
                        muted
                          ? "text-zacht"
                          : "text-sterk"
                      }`}
                    >
                      {label}
                    </h3>
                    <span className="rounded-full bg-ink-100 px-1.5 text-[11px] font-semibold text-basis dark:bg-ink-900">
                      {secPots.length}
                    </span>
                  </span>
                  <Bedrag
                    waarde={sumBalance(secPots)}
                    className="flex-shrink-0 text-[0.9375rem] font-semibold"
                  />
                </button>
                {!isCollapsed && (
                  <div className="mt-1 border-t border-ink-200 dark:border-ink-800">
                    {secPots.map((pot) => (
                      <PotCard
                        key={pot.id}
                        pot={pot}
                        owner={memberById.get(pot.ownerId)}
                        transactions={allTransactions}
                        onSelect={() => onSelect(pot.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Eén potje als regel in een lijst, niet als doos.
 *
 * Waarom een regel en geen kaart: deze klant heeft 120 posten. Honderdtwintig
 * witte dozen op een bijna-witte achtergrond geven geen hiërarchie, alleen
 * scrollwerk. Een geruled lijstje leest zoals het rekenblad waar deze mensen
 * vandaan komen: naam links, bedrag rechts, uitgelijnd.
 *
 * Drie dingen die bewust weg zijn ten opzichte van de vorige kaart:
 *   - de gekleurde zijstreep. De potjeskleur stond er twee keer op (bolletje
 *     en streep); één keer is genoeg en een streep van 6px is geen informatie.
 *   - "Geen verantwoordelijke" en "Nog geen inkomsten". Wat leeg is neemt geen
 *     ruimte in, anders staat er 67 keer dezelfde lege regel.
 *   - de <button> om de hele kaart. De toegankelijke naam was de volledige
 *     inhoud, dus een schermlezer las per potje een alinea voor. Nu is de naam
 *     de knop en is de rest gewone tekst.
 */
export function PotCard({
  pot,
  owner,
  transactions,
  onSelect,
}: {
  pot: Pot;
  owner: Member | undefined;
  transactions: Transaction[];
  onSelect: () => void;
}) {
  const balance = calcBalance(transactions, pot.id);
  const progress = potProgress(
    pot.targetAmount,
    pot.targetKind,
    { balance, totalOut: calcSpent(transactions, pot.id) },
    pot.forecastAmount,
  );
  // Eén fallback voor de hele app; currentColor gaf een zwarte stip in
  // lichte modus en een witte in donkere, terwijl de zijbalk hetzelfde potje
  // in het groen zette.
  const kleur = pot.color ?? POT_KLEUR_STANDAARD;

  return (
    <div className="group grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 border-b border-ink-200 py-2.5 transition-colors hover:bg-ink-50 sm:gap-x-4 dark:border-ink-800 dark:hover:bg-ink-900">
      <span
        aria-hidden
        className="h-2 w-2 translate-y-[-1px] rounded-full"
        style={{ backgroundColor: kleur }}
      />

      <div className="min-w-0">
        <button
          onClick={onSelect}
          className="max-w-full truncate text-left text-[0.9375rem] font-medium text-sterk underline-offset-4 hover:underline"
        >
          {pot.name}
        </button>
        {/* Alleen tonen wat er echt is. */}
        {(owner || progress) && (
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[0.75rem] text-zacht">
            {owner && <span className="truncate">{owner.name}</span>}
            {progress && (
              <span className="flex items-baseline gap-1.5">
                <span>{progress.label}</span>
                <span
                  className={`font-num font-semibold ${
                    progress.over ? "text-fout-600 dark:text-fout-400" : ""
                  }`}
                >
                  {progress.pct.toFixed(0)}%
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Vaste kolombreedte, anders schuift de balk mee met de lengte van het
          bedrag en lijnt er niets meer uit. */}
      <div className="flex items-baseline justify-end gap-3 justify-self-end">
        {progress && (
          /* Massieve kleur, geen verloop: een verloop over 3px is onzichtbaar.
             Kleur betekent geld, ook hier: een spaardoel vult zich met geld dat
             binnenkomt (groen), een budget met geld dat buitengaat (amber). De
             balk stond in beide gevallen op groen, waardoor een budget dat
             volloopt eruitzag als goed nieuws. Rood blijft voor de overschrijding. */
          <span
            className="hidden h-1 w-20 overflow-hidden rounded-full bg-ink-200 sm:block dark:bg-ink-800"
            aria-hidden
          >
            <span
              className={`block h-full rounded-full ${
                progress.over
                  ? "bg-fout-600"
                  : progress.kind === "budget"
                    ? "bg-uit-600"
                    : "bg-in-600"
              }`}
              style={{ width: `${progress.barPct}%` }}
            />
          </span>
        )}
        <Bedrag
          waarde={balance}
          className="min-w-[7rem] text-right text-[0.9375rem] font-semibold sm:min-w-[8.5rem]"
        />
      </div>
    </div>
  );
}

export function RecentActivity({
  recent,
  potById,
}: {
  recent: Transaction[];
  potById: Map<string, Pot>;
}) {
  return (
    <aside className="card flex h-fit flex-col p-5">
      <h2 className="mb-4 text-sm font-semibold text-zacht">
        Recente activiteit
      </h2>
      {recent.length === 0 ? (
        <p className="text-sm text-zacht">Nog geen transacties.</p>
      ) : (
        <ul className="space-y-3">
          {recent.map((tx) => {
            const pot = tx.potId ? potById.get(tx.potId) : undefined;
            const potLabel = tx.potId ? pot?.name ?? "—" : "Nog toe te wijzen";
            const positive = tx.direction === "in";
            return (
              <li key={tx.id} className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                    positive
                      ? "bg-in-100 text-in-600 dark:bg-in-700/30 dark:text-in-400"
                      : "bg-uit-100 text-uit-700 dark:bg-uit-700/30 dark:text-uit-400"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {positive ? (
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    ) : (
                      <path d="M12 5v14M19 12l-7 7-7-7" />
                    )}
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-sterk">
                      {tx.counterparty}
                    </span>
                    <span
                      className={`whitespace-nowrap text-sm font-semibold tabular-nums ${
                        positive
                          ? "text-in-700 dark:text-in-400"
                          : "text-uit-700 dark:text-uit-400"
                      }`}
                    >
                      {positive ? "+" : "−"}
                      {formatEuro(tx.amount)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 text-xs text-zacht">
                    <span className="truncate">{potLabel}</span>
                    <span className="whitespace-nowrap">{formatDate(tx.occurredOn)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export function Stat({
  label,
  value,
  accent,
  delta,
  big,
}: {
  label: string;
  value: string;
  accent: "teal-bold" | "teal" | "amber" | "rose";
  delta?: string;
  big?: boolean;
}) {
  const ring = {
    "teal-bold":
      "before:bg-gradient-to-b before:from-in-500 before:to-in-600",
    teal: "before:bg-in-300",
    amber: "before:bg-uit-600",
    rose: "before:bg-fout-600",
  }[accent];
  const isHero = accent === "teal-bold";
  return (
    <div
      className={`card relative overflow-hidden p-5 before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${ring} ${
        isHero
          ? "ring-1 ring-in-600/60 dark:ring-in-600/40"
          : ""
      }`}
    >
      <p className="mb-1 text-xs font-semibold text-zacht">
        {label}
      </p>
      <p
        className={`font-extrabold ${
          isHero
            ? "text-in-700 dark:text-in-400"
            : "text-sterk"
        } ${big ? "text-3xl" : "text-2xl"}`}
      >
        {value}
      </p>
      {delta && <p className="mt-0.5 text-xs text-basis">{delta}</p>}
    </div>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.trim().slice(0, 1).toUpperCase();
  const cls = size === "sm" ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-sm";
  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-ink-100 font-semibold text-ink-800 dark:bg-ink-900 dark:text-ink-200 ${cls}`}
    >
      {initials}
    </span>
  );
}
