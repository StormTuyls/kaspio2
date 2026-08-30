import { useEffect, useMemo, useState } from "react";
import {
  loadCollapsedGroups,
  potsInGroup,
  rootGroups,
  saveCollapsedGroups,
  subGroups,
  ungroupedPots,
} from "../storage";
import type { Member, Pot, PotGroup, Transaction } from "../types";
import { UpgradeHint } from "../components/UpgradeHint";
import { useConfirm } from "../components/ConfirmDialog";
import { Bedrag } from "../components/Bedrag";
import { Foutmelding } from "../components/Foutmelding";
import { PotCard } from "./Overview";

/** Waarde in de <select> die "geen hoofdgroep, dit is er zelf een" betekent. */
const ROOT = "__root__";

type Props = {
  /** Nodig om de ingeklapte stand per organisatie te bewaren. */
  orgId: string;
  groups: PotGroup[];
  pots: Pot[];
  allTransactions: Transaction[];
  /** Voor de verantwoordelijke onder een potje; leeg mag. */
  members?: Member[];
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

/**
 * De groepenpagina: het comitéblad van de club.
 *
 * Deze pagina beantwoordt één vraag , waar staat het geld per tak , en het
 * antwoord is een reeks totalen die optellen tot het getal in de kop. Daarom
 * leest ze als een document en niet als een dashboard: hiërarchie komt uit
 * inspringing en haarlijnen, niet uit een doos per groep.
 *
 * Drie dingen die bewust anders zijn dan de vorige versie:
 *
 *   - Geen kaartenraster meer. Veertien comités in twee kolommen, elk met hun
 *     subgroepen als kaart binnen de cel, gaf kaarten in kaarten en kolommen
 *     die metershoog uit elkaar liepen. Eén kolom met inspringing leest zoals
 *     het rekenblad waar deze mensen vandaan komen.
 *   - De beheeracties staan achter één schakelaar. Ze stonden twintig keer op
 *     de pagina , "+ Potje  + Subgroep  Hernoemen  Verwijderen" plus een
 *     volledige keuzelijst per groep , en dat is meer formulier dan overzicht.
 *   - De potjesregel is letterlijk dezelfde component als op de potjespagina.
 *     Voorheen was het een tweede, magerder regel met bedragen in de schreefloze
 *     in plaats van in de mono, waardoor twee schermen op twee producten leken.
 */
export function GroupsView({
  orgId,
  groups,
  pots,
  allTransactions,
  members = [],
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
  const [zoek, setZoek] = useState("");
  // Beheermodus. In rust is dit een leesbaar blad; wie de indeling wil wijzigen
  // zegt dat één keer, niet twintig keer een rij knoppen op het scherm.
  const [beheer, setBeheer] = useState(false);

  const roots = rootGroups(groups);
  const ungrouped = ungroupedPots(pots, groups);
  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m] as const)),
    [members],
  );

  // Eén doorloop over de transacties in plaats van per potje opnieuw filteren.
  // Met honderdtwintig potjes en enkele duizenden verrichtingen scheelt dat een
  // merkbare hoeveelheid werk bij elke toetsaanslag in het zoekveld.
  const saldoPerPot = useMemo(() => {
    const saldi = new Map<string, number>();
    for (const p of pots) saldi.set(p.id, 0);
    for (const t of allTransactions) {
      if (!t.potId || t.status === "pending") continue;
      const huidig = saldi.get(t.potId);
      if (huidig === undefined) continue;
      saldi.set(t.potId, huidig + (t.direction === "in" ? t.amount : -t.amount));
    }
    return saldi;
  }, [pots, allTransactions]);

  const saldoVan = (lijst: Pot[]) =>
    lijst.reduce((som, p) => som + (saldoPerPot.get(p.id) ?? 0), 0);

  const totaal = saldoVan(pots);

  // Ingeklapte groepen. Een dichtgeklapte hoofdgroep verbergt haar potjes én
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

  // Zoeken. Met honderdtwintig posten is "waar stond die post ook alweer" de
  // vraag die het vaakst gesteld wordt; scrollen is daar een slecht antwoord op.
  // Een treffer op de groepsnaam toont de hele groep, een treffer op een potje
  // toont dat potje in zijn eigen tak.
  const term = zoek.trim().toLowerCase();
  const zoekt = term.length > 0;
  const raakt = (naam: string) => naam.toLowerCase().includes(term);

  const zichtbarePotjes = (groupId: string, groepRaakt: boolean) => {
    const eigen = potsInGroup(pots, groups, groupId);
    if (!zoekt || groepRaakt) return eigen;
    return eigen.filter((p) => raakt(p.name));
  };

  /** De takken die na filteren overblijven, met hun subgroepen erbij. */
  const takken = roots
    .map((g) => {
      const groepRaakt = !zoekt || raakt(g.name);
      const eigenPotjes = zichtbarePotjes(g.id, groepRaakt);
      const kinderen = subGroups(groups, g.id)
        .map((c) => {
          const kindRaakt = groepRaakt || raakt(c.name);
          return { groep: c, potjes: zichtbarePotjes(c.id, kindRaakt), kindRaakt };
        })
        .filter((k) => !zoekt || k.kindRaakt || k.potjes.length > 0);
      return { groep: g, eigenPotjes, kinderen, groepRaakt };
    })
    .filter(
      (t) =>
        !zoekt || t.groepRaakt || t.eigenPotjes.length > 0 || t.kinderen.length > 0,
    );

  const losseZichtbaar = zoekt
    ? ungrouped.filter((p) => raakt(p.name))
    : ungrouped;

  const zichtbarePotten = [
    ...takken.flatMap((t) => [...t.eigenPotjes, ...t.kinderen.flatMap((k) => k.potjes)]),
    ...losseZichtbaar,
  ];
  const gevonden = zichtbarePotten.length;
  // Uitlegbaar aan de algemene vergadering: elk getal op het scherm moet te
  // herleiden zijn tot de regels eronder. Tijdens het zoeken staan die regels
  // er maar half, dus tellen de totalen alleen wat je ziet.
  const kopBedrag = zoekt ? saldoVan(zichtbarePotten) : totaal;

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

  const potRij = (pot: Pot) => (
    <PotCard
      key={pot.id}
      pot={pot}
      owner={memberById.get(pot.ownerId)}
      transactions={allTransactions}
      onSelect={() => onSelectPot(pot.id)}
    />
  );

  return (
    <div className="space-y-6">
      {/* Kop , het getal wint. Eén bedrag beantwoordt de vraag waarom je hier
          bent; de groepstotalen eronder tellen er precies toe op. */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-b border-rand pb-4">
        <div className="min-w-0">
          <h1 className="titel">Groepen</h1>
          {pots.length > 0 && (
            <p className="meta mt-0.5">
              {pots.length} {pots.length === 1 ? "potje" : "potjes"}
              {roots.length > 0 && (
                <>
                  {" "}
                  in {roots.length} {roots.length === 1 ? "groep" : "groepen"}
                </>
              )}
            </p>
          )}
        </div>
        {pots.length > 0 && (
          <div className="text-right">
            <Bedrag
              waarde={kopBedrag}
              gekleurd={false}
              className="text-[1.375rem] font-bold sm:text-[1.5rem]"
            />
            <p className="micro mt-0.5">
              {zoekt ? "Som van de treffers" : "Som van alle potjes"}
            </p>
          </div>
        )}
      </header>

      {!canUseGroups && (
        <UpgradeHint
          badge="Team"
          title="Potgroepen"
          description="Bundel je potjes per tak, ploeg of werkgroep. Beschikbaar in het Team-plan."
          onUpgrade={onUpgrade}
        />
      )}

      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-56 md:w-72">
            <input
              type="search"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek een groep of potje"
              aria-label="Zoek een groep of potje"
              className="input"
            />
          </div>
          {roots.length > 1 && !zoekt && (
            <button onClick={toggleAll} className="btn btn--secondary text-sm">
              {anyOpen ? "Alles inklappen" : "Alles uitklappen"}
            </button>
          )}
          {isAdmin && canUseGroups && (
            <>
              <button
                onClick={() => setBeheer((b) => !b)}
                aria-pressed={beheer}
                className="btn btn--secondary text-sm"
              >
                {beheer ? "Klaar met indelen" : "Indeling bewerken"}
              </button>
              {!creating && (
                <button
                  onClick={() => {
                    setCreating(true);
                    setBeheer(true);
                  }}
                  className="btn btn--primary text-sm"
                >
                  + Nieuwe groep
                </button>
              )}
            </>
          )}
        </div>
      )}

      {zoekt && (
        <p className="meta" role="status">
          {gevonden === 0
            ? "Geen potje of groep met die naam."
            : `${gevonden} van ${pots.length} potjes`}
        </p>
      )}

      {isAdmin && creating && (
        <div className="panel flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNew()}
            placeholder="Bijv. Welpen, U12, Werkgroep Kerst"
            aria-label="Naam van de nieuwe groep"
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
              className="btn btn--secondary text-sm"
              disabled={busy}
            >
              Annuleren
            </button>
            <button onClick={submitNew} className="btn btn--primary text-sm" disabled={busy}>
              {busy ? "Bezig…" : "Aanmaken"}
            </button>
          </div>
        </div>
      )}
      {error && <Foutmelding>{error}</Foutmelding>}

      {groups.length === 0 ? (
        /* De uitleg staat alleen hier. Wie al groepen heeft, weet wat ze zijn en
           hoeft niet elke keer een alinea over zich heen te krijgen. */
        <div
          className="rounded-md border border-dashed px-5 py-8 text-center"
          style={{ borderColor: "var(--lijn-sterk)" }}
        >
          <p className="text-base font-semibold text-sterk">Nog geen groepen</p>
          <p className="prose-kaspio mx-auto mt-1 text-sm text-basis">
            Groepen bundelen potjes per tak, ploeg of werkgroep. Een potje koppel
            je aan een groep bij het aanmaken of bewerken van het potje. Hoort er
            nog een laag tussen, bijvoorbeeld een comité met blokken eronder, dan
            hang je een groep onder een andere. Dieper dan twee niveaus gaat niet.
          </p>
          {isAdmin && canUseGroups && !creating && (
            <button
              onClick={() => setCreating(true)}
              className="btn btn--primary mt-5 text-sm"
            >
              + Eerste groep aanmaken
            </button>
          )}
        </div>
      ) : (
        <div>
          {takken.map(({ groep, eigenPotjes, kinderen }) => {
            const open = zoekt || !collapsed.has(groep.id);
            const potjesDiep = potsInGroup(pots, groups, groep.id, true);
            const takZichtbaar = [
              ...eigenPotjes,
              ...kinderen.flatMap((k) => k.potjes),
            ];
            return (
              <section key={groep.id} className="mt-6 scroll-mt-24 first:mt-0">
                <GroepRij
                  groep={groep}
                  niveau="hoofd"
                  potCount={zoekt ? takZichtbaar.length : potjesDiep.length}
                  vanCount={zoekt ? potjesDiep.length : undefined}
                  childCount={subGroups(groups, groep.id).length}
                  saldo={saldoVan(zoekt ? takZichtbaar : potjesDiep)}
                  open={open}
                  onToggle={() => toggle(groep.id)}
                  onOpen={onOpenGroup ? () => onOpenGroup(groep.id) : undefined}
                  beheer={beheer}
                  roots={roots}
                  onUpdate={onUpdateGroup}
                  onDelete={onDeleteGroup}
                  onAddPot={onAddPot ? () => onAddPot(groep.id) : undefined}
                  canAddPot={canAddPot}
                  onUpgrade={onUpgrade}
                  onCreateSub={
                    canUseGroups ? (naam) => onCreateGroup(naam, groep.id) : undefined
                  }
                />
                {open && (
                  <>
                    {eigenPotjes.length > 0 && (
                      <div className="pl-5">{eigenPotjes.map(potRij)}</div>
                    )}
                    {kinderen.length > 0 && (
                      /* Eén haarlijn als tak-geleider. Inspringing alleen raakt
                         zoek bij zeven subgroepen onder elkaar. */
                      <div className="border-l border-rand pl-5">
                        {kinderen.map(({ groep: kind, potjes }) => {
                          const kindOpen = zoekt || !collapsed.has(kind.id);
                          const kindPotjes = potsInGroup(pots, groups, kind.id);
                          return (
                            <div key={kind.id}>
                              <GroepRij
                                groep={kind}
                                niveau="sub"
                                potCount={zoekt ? potjes.length : kindPotjes.length}
                                vanCount={zoekt ? kindPotjes.length : undefined}
                                childCount={0}
                                saldo={saldoVan(zoekt ? potjes : kindPotjes)}
                                open={kindOpen}
                                onToggle={() => toggle(kind.id)}
                                onOpen={
                                  onOpenGroup ? () => onOpenGroup(kind.id) : undefined
                                }
                                beheer={beheer}
                                roots={roots}
                                onUpdate={onUpdateGroup}
                                onDelete={onDeleteGroup}
                                onAddPot={
                                  onAddPot ? () => onAddPot(kind.id) : undefined
                                }
                                canAddPot={canAddPot}
                                onUpgrade={onUpgrade}
                              />
                              {kindOpen && potjes.length > 0 && (
                                <div className="pl-5">{potjes.map(potRij)}</div>
                              )}
                              {kindOpen && potjes.length === 0 && (
                                <p className="py-2 pl-5 text-[0.8125rem] text-zacht">
                                  Nog geen potjes.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Zwijgen over wat leeg is: een hoofdgroep die haar potjes
                        in de subgroepen heeft zitten, hoeft dat niet te melden.
                        Alleen een groep die echt nergens een potje heeft. */}
                    {eigenPotjes.length === 0 && kinderen.length === 0 && (
                      <p className="py-2 pl-5 text-[0.8125rem] text-zacht">
                        {zoekt ? "Geen treffer in deze groep." : "Nog geen potjes."}
                      </p>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}

      {losseZichtbaar.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between gap-3 border-b border-rand py-2.5">
            <h2 className="sectiekop truncate text-zacht">Niet in een groep</h2>
            <Bedrag
              waarde={saldoVan(losseZichtbaar)}
              gekleurd={false}
              className="text-[1.0625rem] font-semibold"
            />
          </div>
          <div className="pl-5">{losseZichtbaar.map(potRij)}</div>
        </section>
      )}
    </div>
  );
}

/**
 * De kop van één groep: pijltje, naam, wat erin zit, en het totaal.
 *
 * Bewust geen <button> om de hele rij: de toegankelijke naam wordt dan de
 * volledige inhoud, dus een schermlezer leest per groep "Onderhoud 7 potjes
 * min negenenveertigduizend...". De naam is de link, de rest is tekst.
 */
function GroepRij({
  groep,
  niveau,
  potCount,
  vanCount,
  childCount,
  saldo,
  open,
  onToggle,
  onOpen,
  beheer,
  roots,
  onUpdate,
  onDelete,
  onAddPot,
  canAddPot,
  onUpgrade,
  onCreateSub,
}: {
  groep: PotGroup;
  niveau: "hoofd" | "sub";
  /** Bij een hoofdgroep inclusief de potjes van haar subgroepen. */
  potCount: number;
  /** Tijdens het zoeken: hoeveel potjes er in totaal in deze groep zitten. */
  vanCount?: number;
  childCount: number;
  /** Saldo inclusief subgroepen, dus voor een hoofdgroep het bloktotaal. */
  saldo: number;
  open: boolean;
  onToggle: () => void;
  onOpen?: () => void;
  beheer: boolean;
  roots: PotGroup[];
  onUpdate: (
    id: string,
    patch: { name?: string; parentId?: string | null },
  ) => Promise<{ error: string | null }>;
  onDelete: (id: string) => Promise<{ error: string | null }>;
  onAddPot?: () => void;
  canAddPot: boolean;
  onUpgrade?: () => void;
  /** Alleen op een hoofdgroep: een subgroep hieronder aanmaken. */
  onCreateSub?: (name: string) => Promise<{ error: string | null }>;
}) {
  const confirm = useConfirm();
  const [naam, setNaam] = useState(groep.name);
  const [hernoemt, setHernoemt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [subNaam, setSubNaam] = useState<string | null>(null);

  const hoofd = niveau === "hoofd";
  // Een groep met subgroepen kan er zelf niet onder hangen: dat zou drie
  // niveaus geven en de databank weigert het (check_group_depth).
  const kanVerhuizen = childCount === 0;
  const bestemmingen = roots.filter((r) => r.id !== groep.id);

  async function bewaarNaam() {
    const kort = naam.trim();
    if (!kort || kort === groep.name) {
      setHernoemt(false);
      setNaam(groep.name);
      return;
    }
    setBusy(true);
    const res = await onUpdate(groep.id, { name: kort });
    setBusy(false);
    if (res.error) {
      setNaam(groep.name);
      setFout(res.error);
    }
    setHernoemt(false);
  }

  async function verhuis(waarde: string) {
    setFout(null);
    setBusy(true);
    const res = await onUpdate(groep.id, {
      parentId: waarde === ROOT ? null : waarde,
    });
    setBusy(false);
    if (res.error) setFout(res.error);
  }

  async function maakSub() {
    const kort = (subNaam ?? "").trim();
    if (!kort) {
      setFout("Geef de subgroep een naam.");
      return;
    }
    setFout(null);
    setBusy(true);
    const res = await onCreateSub!(kort);
    setBusy(false);
    if (res.error) {
      setFout(res.error);
      return;
    }
    setSubNaam(null);
  }

  async function verwijder() {
    const message =
      childCount > 0
        ? `De ${childCount} subgroep${childCount > 1 ? "en" : ""} blijven bestaan en komen bovenaan te staan. De potjes blijven waar ze zitten.`
        : "De potjes blijven bestaan en worden groepsloos.";
    if (
      !(await confirm({
        title: `Groep "${groep.name}" verwijderen?`,
        message,
        confirmLabel: "Verwijderen",
        danger: true,
      }))
    )
      return;
    await onDelete(groep.id);
  }

  const Kop = hoofd ? "h2" : "h3";

  return (
    <>
      <div
        className={`flex items-baseline gap-2 border-b border-rand ${
          hoofd ? "pb-2 pt-2" : "pb-1.5 pt-3"
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${groep.name} ${open ? "inklappen" : "uitklappen"}`}
          className="-ml-1 flex-shrink-0 self-center rounded p-1 text-zacht transition-colors hover:bg-vlak-gedempt hover:text-sterk"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`}
            aria-hidden
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {hernoemt ? (
          <input
            autoFocus
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            onBlur={bewaarNaam}
            onKeyDown={(e) => {
              if (e.key === "Enter") bewaarNaam();
              if (e.key === "Escape") {
                setNaam(groep.name);
                setHernoemt(false);
              }
            }}
            maxLength={80}
            disabled={busy}
            aria-label={`Nieuwe naam voor ${groep.name}`}
            className="input max-w-xs py-1 text-sm font-semibold"
          />
        ) : (
          <Kop
            className={`min-w-0 truncate ${
              hoofd
                ? "sectiekop"
                : "text-[0.9375rem] font-semibold text-sterk"
            }`}
          >
            {onOpen ? (
              <button
                type="button"
                onClick={onOpen}
                className="max-w-full truncate text-left underline-offset-4 hover:underline"
              >
                {groep.name}
              </button>
            ) : (
              groep.name
            )}
          </Kop>
        )}

        {/* Alleen tonen wat er is. "0 potjes" op elke comitékop is ruis. */}
        <span className="meta hidden flex-shrink-0 truncate sm:inline">
          {[
            potCount > 0
              ? vanCount !== undefined
                ? `${potCount} van ${vanCount} potjes`
                : `${potCount} ${potCount === 1 ? "potje" : "potjes"}`
              : null,
            childCount > 0
              ? `${childCount} subgroep${childCount > 1 ? "en" : ""}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>

        <Bedrag
          waarde={saldo}
          gekleurd={false}
          className={`ml-auto flex-shrink-0 ${
            hoofd ? "text-[1.0625rem] font-bold" : "text-[0.9375rem] font-semibold"
          }`}
        />
      </div>

      {/* Beheerrij. Staat er alleen in beheermodus, en dan als één stille regel
          onder de kop in plaats van als knoppenbalk in elke groep. */}
      {beheer && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2 pl-5 text-[0.8125rem]"
        >
          {onAddPot && (
            <button
              onClick={canAddPot ? onAddPot : onUpgrade}
              className="font-medium text-basis underline-offset-4 hover:text-sterk hover:underline"
            >
              {canAddPot ? "+ Potje" : "Upgrade voor meer potjes"}
            </button>
          )}
          {onCreateSub && subNaam === null && (
            <button
              onClick={() => {
                setSubNaam("");
                setFout(null);
              }}
              className="font-medium text-basis underline-offset-4 hover:text-sterk hover:underline"
            >
              + Subgroep
            </button>
          )}
          <button
            onClick={() => setHernoemt(true)}
            className="font-medium text-basis underline-offset-4 hover:text-sterk hover:underline"
          >
            Hernoemen
          </button>
          <button
            onClick={verwijder}
            className="font-medium text-fout-600 underline-offset-4 hover:underline dark:text-fout-400"
          >
            Verwijderen
          </button>
          {/* Een groep met subgroepen kan nergens onder hangen (drie niveaus
              weigert de databank), en een enige hoofdgroep heeft geen bestemming.
              Een uitgegrijsde keuzelijst uitleggen kost meer ruimte dan hem
              weglaten. */}
          {kanVerhuizen && bestemmingen.length > 0 && (
            <select
              value={groep.parentId ?? ROOT}
              onChange={(e) => verhuis(e.target.value)}
              disabled={busy}
              className="input w-full py-1 text-[0.8125rem] sm:ml-auto sm:w-auto"
              aria-label={`Hoofdgroep van ${groep.name}`}
            >
              <option value={ROOT}>Hoofdgroep</option>
              {bestemmingen.map((r) => (
                <option key={r.id} value={r.id}>
                  Onder {r.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {subNaam !== null && (
        <div className="flex flex-wrap gap-2 py-2 pl-5">
          <input
            autoFocus
            type="text"
            value={subNaam}
            onChange={(e) => setSubNaam(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") maakSub();
              if (e.key === "Escape") {
                setSubNaam(null);
                setFout(null);
              }
            }}
            placeholder={`Subgroep onder ${groep.name}`}
            aria-label={`Naam van de subgroep onder ${groep.name}`}
            maxLength={80}
            disabled={busy}
            className="input max-w-xs flex-1 py-1 text-sm"
          />
          <button
            onClick={() => {
              setSubNaam(null);
              setFout(null);
            }}
            className="btn btn--secondary px-2.5 text-[0.8125rem]"
            disabled={busy}
          >
            Annuleren
          </button>
          <button
            onClick={maakSub}
            className="btn btn--primary px-2.5 text-[0.8125rem]"
            disabled={busy}
          >
            {busy ? "Bezig…" : "Aanmaken"}
          </button>
        </div>
      )}

      {fout && (
        <p className="py-1 pl-5 text-[0.8125rem] text-fout-600 dark:text-fout-400" role="alert">
          {fout}
        </p>
      )}
    </>
  );
}
